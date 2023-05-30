/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-var */
"use strict";
import { deepFreeze, freeze } from "../utils/icebox";
import { Collection } from "./Collection";
import { LokiEventEmitter } from "./LokiEventEmitter";
import { Resultset } from "./Resultset";

/**
 * DynamicView class is a versatile 'live' view class which can have filters and sorts applied.
 *    Collection.addDynamicView(name) instantiates this DynamicView object and notifies it
 *    whenever documents are add/updated/removed so it can remain up-to-date. (chainable)
 *
 * @example
 * var mydv = mycollection.addDynamicView('test');  // default is non-persistent
 * mydv.applyFind({ 'doors' : 4 });
 * mydv.applyWhere(function(obj) { return obj.name === 'Toyota'; });
 * var results = mydv.data();
 *
 * @constructor DynamicView
 * @implements LokiEventEmitter
 * @param {Collection} collection - A reference to the collection to work against
 * @param {string} name - The name of this dynamic view
 * @param {object=} options - (Optional) Pass in object with 'persistent' and/or 'sortPriority' options.
 * @param {boolean} [options.persistent=false] - indicates if view is to main internal results array in 'resultdata'
 * @param {string} [options.sortPriority='passive'] - 'passive' (sorts performed on call to data) or 'active' (after updates)
 * @param {number} options.minRebuildInterval - minimum rebuild interval (need clarification to docs here)
 * @see {@link Collection#addDynamicView} to construct instances of DynamicView
 */

interface DynamicViewOptions {
  persistent: boolean;
  sortPriority: "passive" | "active";
  minRebuildInterval: number;
}

export class DynamicView extends LokiEventEmitter {
  collection: Collection;
  name: string;
  rebuildPending: boolean;
  options: Partial<DynamicViewOptions>;
  resultset: Resultset;
  resultdata: any[];
  resultsdirty: boolean;
  cachedresultset: any;
  filterPipeline: any[];
  sortFunction: any;
  sortCriteria: any;
  sortCriteriaSimple: any;
  sortDirty: boolean;
  events: { rebuild: any[]; filter: any[]; sort: any[] };

  constructor(
    collection: Collection,
    name: string,
    options?: Partial<DynamicViewOptions>
  ) {
    super();
    this.collection = collection;
    this.name = name;
    this.rebuildPending = false;
    this.options = options || {};

    if (!this.options.hasOwnProperty("persistent")) {
      this.options.persistent = false;
    }

    // 'persistentSortPriority':
    // 'passive' will defer the sort phase until they call data(). (most efficient overall)
    // 'active' will sort async whenever next idle. (prioritizes read speeds)
    if (!this.options.hasOwnProperty("sortPriority")) {
      this.options.sortPriority = "passive";
    }

    if (!this.options.hasOwnProperty("minRebuildInterval")) {
      this.options.minRebuildInterval = 1;
    }

    this.resultset = new Resultset(collection);
    this.resultdata = [];
    this.resultsdirty = false;

    this.cachedresultset = null;

    // keep ordered filter pipeline
    this.filterPipeline = [];
    if (!this.collection.disableFreeze) {
      Object.freeze(this.filterPipeline);
    }

    // sorting member variables
    // we only support one active search, applied using applySort() or applySimpleSort()
    this.sortFunction = null;
    this.sortCriteria = null;
    this.sortCriteriaSimple = null;
    this.sortDirty = false;

    // for now just have 1 event for when we finally rebuilt lazy view
    // once we refactor transactions, i will tie in certain transactional events
    this.events = {
      rebuild: [],
      filter: [],
      sort: [],
    };
  }

  /**
   * getSort() - used to get the current sort
   *
   * @returns function (sortFunction) or array (sortCriteria) or object (sortCriteriaSimple)
   */
  getSort = () => {
    return this.sortFunction || this.sortCriteria || this.sortCriteriaSimple;
  };

  /**
   * rematerialize() - internally used immediately after deserialization (loading)
   *    This will clear out and reapply filterPipeline ops, recreating the view.
   *    Since where filters do not persist correctly, this method allows
   *    restoring the view to state where user can re-apply those where filters.
   *
   * @param {Object=} options - (Optional) allows specification of 'removeWhereFilters' option
   * @returns {DynamicView} This dynamic view for further chained ops.
   * @memberof DynamicView
   * @fires DynamicView.rebuild
   */
  rematerialize = (options) => {
    let fpl;
    let fpi;
    let idx;

    options = options || {};

    this.resultdata = [];
    this.resultsdirty = true;
    this.resultset = new Resultset(this.collection);

    if (this.sortFunction || this.sortCriteria || this.sortCriteriaSimple) {
      this.sortDirty = true;
    }

    const wasFrozen = Object.isFrozen(this.filterPipeline);
    if (options.hasOwnProperty("removeWhereFilters")) {
      // for each view see if it had any where filters applied... since they don't
      // serialize those functions lets remove those invalid filters
      if (wasFrozen) {
        this.filterPipeline = this.filterPipeline.slice();
      }
      fpl = this.filterPipeline.length;
      fpi = fpl;
      while (fpi--) {
        if (this.filterPipeline[fpi].type === "where") {
          if (fpi !== this.filterPipeline.length - 1) {
            this.filterPipeline[fpi] =
              this.filterPipeline[this.filterPipeline.length - 1];
          }
          this.filterPipeline.length--;
        }
      }
    }

    // back up old filter pipeline, clear filter pipeline, and reapply pipeline ops
    const ofp = this.filterPipeline;
    this.filterPipeline = [];

    // now re-apply 'find' filterPipeline ops
    fpl = ofp.length;
    for (idx = 0; idx < fpl; idx++) {
      this.applyFind(ofp[idx].val, ofp[idx].uid);
    }
    if (wasFrozen) {
      Object.freeze(this.filterPipeline);
    }

    // during creation of unit tests, i will remove this forced refresh and leave lazy
    this.data();

    // emit rebuild event in case user wants to be notified
    this.emit("rebuild", this);

    return this;
  };

  /**
   * branchResultset() - Makes a copy of the internal resultset for branched queries.
   *    Unlike this dynamic view, the branched resultset will not be 'live' updated,
   *    so your branched query should be immediately resolved and not held for future evaluation.
   *
   * @param {(string|array=)} transform - Optional name of collection transform, or an array of transform steps
   * @param {object=} parameters - optional parameters (if optional transform requires them)
   * @returns {Resultset} A copy of the internal resultset for branched queries.
   * @memberof DynamicView
   * @example
   * var db = new loki('test');
   * var coll = db.addCollection('mydocs');
   * var dv = coll.addDynamicView('myview');
   * var tx = [
   *   {
   *     type: 'offset',
   *     value: '[%lktxp]pageStart'
   *   },
   *   {
   *     type: 'limit',
   *     value: '[%lktxp]pageSize'
   *   }
   * ];
   * coll.addTransform('viewPaging', tx);
   *
   * // add some records
   *
   * var results = dv.branchResultset('viewPaging', { pageStart: 10, pageSize: 10 }).data();
   */
  branchResultset = (transform, parameters) => {
    const rs = this.resultset.branch();

    if (typeof transform === "undefined") {
      return rs;
    }

    return rs.transform(transform, parameters);
  };

  /**
   * toJSON() - Override of toJSON to avoid circular references
   *
   */
  toJSON = () => {
    const copy = new DynamicView(this.collection, this.name, this.options);
    copy.resultset = this.resultset;
    copy.resultdata = []; // let's not save data (copy) to minimize size
    copy.resultsdirty = true;
    copy.filterPipeline = this.filterPipeline;
    copy.sortFunction = this.sortFunction;
    copy.sortCriteria = this.sortCriteria;
    copy.sortCriteriaSimple = this.sortCriteriaSimple || null;
    copy.sortDirty = this.sortDirty;

    // avoid circular reference, reapply in db.loadJSON()
    copy.collection = null;

    return copy;
  };

  /**
   * removeFilters() - Used to clear pipeline and reset dynamic view to initial state.
   *     Existing options should be retained.
   * @param {object=} options - configure removeFilter behavior
   * @param {boolean=} options.queueSortPhase - (default: false) if true we will async rebuild view (maybe set default to true in future?)
   * @memberof DynamicView
   */
  removeFilters = (options: Record<string, any> = {}) => {
    this.rebuildPending = false;
    this.resultset.reset();
    this.resultdata = [];
    this.resultsdirty = true;

    this.cachedresultset = null;

    const wasFrozen = Object.isFrozen(this.filterPipeline);
    const filterChanged = this.filterPipeline.length > 0;
    // keep ordered filter pipeline
    this.filterPipeline = [];
    if (wasFrozen) {
      Object.freeze(this.filterPipeline);
    }

    // sorting member variables
    // we only support one active search, applied using applySort() or applySimpleSort()
    this.sortFunction = null;
    this.sortCriteria = null;
    this.sortCriteriaSimple = null;
    this.sortDirty = false;

    if (options.queueSortPhase === true) {
      this.queueSortPhase();
    }

    if (filterChanged) {
      this.emit("filter");
    }
  };

  /**
   * applySort() - Used to apply a sort to the dynamic view
   * @example
   * dv.applySort(function(obj1, obj2) {
   *   if (obj1.name === obj2.name) return 0;
   *   if (obj1.name > obj2.name) return 1;
   *   if (obj1.name < obj2.name) return -1;
   * });
   *
   * @param {function} comparefun - a javascript compare function used for sorting
   * @returns {DynamicView} this DynamicView object, for further chain ops.
   * @memberof DynamicView
   */
  applySort = (comparefun) => {
    this.sortFunction = comparefun;
    this.sortCriteria = null;
    this.sortCriteriaSimple = null;

    this.queueSortPhase();
    this.emit("sort");

    return this;
  };

  /**
   * applySimpleSort() - Used to specify a property used for view translation.
   * @example
   * dv.applySimpleSort("name");
   *
   * @param {string} propname - Name of property by which to sort.
   * @param {object|boolean=} options - boolean for sort descending or options object
   * @param {boolean} [options.desc=false] - whether we should sort descending.
   * @param {boolean} [options.disableIndexIntersect=false] - whether we should explicity not use array intersection.
   * @param {boolean} [options.forceIndexIntersect=false] - force array intersection (if binary index exists).
   * @param {boolean} [options.useJavascriptSorting=false] - whether results are sorted via basic javascript sort.
   * @returns {DynamicView} this DynamicView object, for further chain ops.
   * @memberof DynamicView
   */
  applySimpleSort = (propname, options) => {
    this.sortCriteriaSimple = {
      propname,
      options: options || false,
    };
    if (!this.collection.disableFreeze) {
      deepFreeze(this.sortCriteriaSimple);
    }
    this.sortCriteria = null;
    this.sortFunction = null;

    this.queueSortPhase();
    this.emit("sort");

    return this;
  };

  /**
   * applySortCriteria() - Allows sorting a resultset based on multiple columns.
   * @example
   * // to sort by age and then name (both ascending)
   * dv.applySortCriteria(['age', 'name']);
   * // to sort by age (ascending) and then by name (descending)
   * dv.applySortCriteria(['age', ['name', true]);
   * // to sort by age (descending) and then by name (descending)
   * dv.applySortCriteria(['age', true], ['name', true]);
   *
   * @param {array} properties - array of property names or subarray of [propertyname, isdesc] used evaluate sort order
   * @returns {DynamicView} Reference to this DynamicView, sorted, for future chain operations.
   * @memberof DynamicView
   */
  applySortCriteria = (criteria) => {
    this.sortCriteria = criteria;
    if (!this.collection.disableFreeze) {
      deepFreeze(this.sortCriteria);
    }
    this.sortCriteriaSimple = null;
    this.sortFunction = null;

    this.queueSortPhase();
    this.emit("sort");
    return this;
  };

  /**
   * startTransaction() - marks the beginning of a transaction.
   *
   * @returns {DynamicView} this DynamicView object, for further chain ops.
   */
  startTransaction = () => {
    this.cachedresultset = this.resultset.copy();

    return this;
  };

  /**
   * commit() - commits a transaction.
   *
   * @returns {DynamicView} this DynamicView object, for further chain ops.
   */
  commit = () => {
    this.cachedresultset = null;

    return this;
  };

  /**
   * rollback() - rolls back a transaction.
   *
   * @returns {DynamicView} this DynamicView object, for further chain ops.
   */
  rollback = () => {
    this.resultset = this.cachedresultset;

    if (this.options.persistent) {
      // for now just rebuild the persistent dynamic view data in this worst case scenario
      // (a persistent view utilizing transactions which get rolled back), we already know the filter so not too bad.
      this.resultdata = this.resultset.data();

      this.emit("rebuild", this);
    }

    return this;
  };

  /**
   * Implementation detail.
   * _indexOfFilterWithId() - Find the index of a filter in the pipeline, by that filter's ID.
   *
   * @param {(string|number)} uid - The unique ID of the filter.
   * @returns {number}: index of the referenced filter in the pipeline; -1 if not found.
   */
  _indexOfFilterWithId = (uid) => {
    if (typeof uid === "string" || typeof uid === "number") {
      for (let idx = 0, len = this.filterPipeline.length; idx < len; idx += 1) {
        if (uid === this.filterPipeline[idx].uid) {
          return idx;
        }
      }
    }
    return -1;
  };

  /**
   * Implementation detail.
   * _addFilter() - Add the filter object to the end of view's filter pipeline and apply the filter to the resultset.
   *
   * @param {object} filter - The filter object. Refer to applyFilter() for extra details.
   */
  _addFilter = (filter) => {
    const wasFrozen = Object.isFrozen(this.filterPipeline);
    if (wasFrozen) {
      this.filterPipeline = this.filterPipeline.slice();
    }
    if (!this.collection.disableFreeze) {
      deepFreeze(filter);
    }
    this.filterPipeline.push(filter);
    if (wasFrozen) {
      Object.freeze(this.filterPipeline);
    }
    this.resultset[filter.type](filter.val);
  };

  /**
   * reapplyFilters() - Reapply all the filters in the current pipeline.
   *
   * @returns {DynamicView} this DynamicView object, for further chain ops.
   */
  reapplyFilters = () => {
    this.resultset.reset();

    this.cachedresultset = null;
    if (this.options.persistent) {
      this.resultdata = [];
      this.resultsdirty = true;
    }

    const filters = this.filterPipeline;
    const wasFrozen = Object.isFrozen(filters);
    this.filterPipeline = [];

    for (let idx = 0, len = filters.length; idx < len; idx += 1) {
      this._addFilter(filters[idx]);
    }
    if (wasFrozen) {
      Object.freeze(this.filterPipeline);
    }

    if (this.sortFunction || this.sortCriteria || this.sortCriteriaSimple) {
      this.queueSortPhase();
    } else {
      this.queueRebuildEvent();
    }
    this.emit("filter");
    return this;
  };

  /**
   * applyFilter() - Adds or updates a filter in the DynamicView filter pipeline
   *
   * @param {object} filter - A filter object to add to the pipeline.
   *    The object is in the format { 'type': filter_type, 'val', filter_param, 'uid', optional_filter_id }
   * @returns {DynamicView} this DynamicView object, for further chain ops.
   * @memberof DynamicView
   */
  applyFilter = (filter) => {
    const idx = this._indexOfFilterWithId(filter.uid);
    if (idx >= 0) {
      const wasFrozen = Object.isFrozen(this.filterPipeline);
      if (wasFrozen) {
        this.filterPipeline = this.filterPipeline.slice();
      }
      this.filterPipeline[idx] = filter;
      if (wasFrozen) {
        freeze(filter);
        Object.freeze(this.filterPipeline);
      }
      return this.reapplyFilters();
    }

    this.cachedresultset = null;
    if (this.options.persistent) {
      this.resultdata = [];
      this.resultsdirty = true;
    }

    this._addFilter(filter);

    if (this.sortFunction || this.sortCriteria || this.sortCriteriaSimple) {
      this.queueSortPhase();
    } else {
      this.queueRebuildEvent();
    }

    this.emit("filter");
    return this;
  };

  /**
   * applyFind() - Adds or updates a mongo-style query option in the DynamicView filter pipeline
   *
   * @param {object} query - A mongo-style query object to apply to pipeline
   * @param {(string|number)=} uid - Optional: The unique ID of this filter, to reference it in the future.
   * @returns {DynamicView} this DynamicView object, for further chain ops.
   * @memberof DynamicView
   */
  applyFind = (query, uid) => {
    this.applyFilter({
      type: "find",
      val: query,
      uid,
    });
    return this;
  };

  /**
   * applyWhere() - Adds or updates a javascript filter function in the DynamicView filter pipeline
   *
   * @param {function} fun - A javascript filter function to apply to pipeline
   * @param {(string|number)=} uid - Optional: The unique ID of this filter, to reference it in the future.
   * @returns {DynamicView} this DynamicView object, for further chain ops.
   * @memberof DynamicView
   */
  applyWhere = (fun, uid) => {
    this.applyFilter({
      type: "where",
      val: fun,
      uid,
    });
    return this;
  };

  /**
   * removeFilter() - Remove the specified filter from the DynamicView filter pipeline
   *
   * @param {(string|number)} uid - The unique ID of the filter to be removed.
   * @returns {DynamicView} this DynamicView object, for further chain ops.
   * @memberof DynamicView
   */
  removeFilter = (uid) => {
    const idx = this._indexOfFilterWithId(uid);
    if (idx < 0) {
      throw new Error(`Dynamic view does not contain a filter with ID: ${uid}`);
    }
    const wasFrozen = Object.isFrozen(this.filterPipeline);
    if (wasFrozen) {
      this.filterPipeline = this.filterPipeline.slice();
    }
    this.filterPipeline.splice(idx, 1);
    if (wasFrozen) {
      Object.freeze(this.filterPipeline);
    }
    this.reapplyFilters();
    return this;
  };

  /**
   * count() - returns the number of documents representing the current DynamicView contents.
   *
   * @returns {number} The number of documents representing the current DynamicView contents.
   * @memberof DynamicView
   */
  count = () => {
    // in order to be accurate we will pay the minimum cost (and not alter dv state management)
    // recurring resultset data resolutions should know internally its already up to date.
    // for persistent data this will not update resultdata nor fire rebuild event.
    if (this.resultsdirty) {
      this.resultdata = this.resultset.data();
    }

    return this.resultset.count();
  };

  /**
   * data() - resolves and pending filtering and sorting, then returns document array as result.
   *
   * @param {object=} options - optional parameters to pass to resultset.data() if non-persistent
   * @param {boolean} options.forceClones - Allows forcing the return of cloned objects even when
   *        the collection is not configured for clone object.
   * @param {string} options.forceCloneMethod - Allows overriding the default or collection specified cloning method.
   *        Possible values include 'parse-stringify', 'jquery-extend-deep', 'shallow', 'shallow-assign'
   * @param {bool} options.removeMeta - Will force clones and strip $loki and meta properties from documents
   * @returns {array} An array of documents representing the current DynamicView contents.
   * @memberof DynamicView
   */
  data(options?: object) {
    // using final sort phase as 'catch all' for a few use cases which require full rebuild
    if (this.sortDirty || this.resultsdirty) {
      this.performSortPhase({
        suppressRebuildEvent: true,
      });
    }
    return this.options.persistent
      ? this.resultdata
      : this.resultset.data(options);
  }

  /**
   * queueRebuildEvent() - When the view is not sorted we may still wish to be notified of rebuild events.
   *     This event will throttle and queue a single rebuild event when batches of updates affect the view.
   */
  queueRebuildEvent = () => {
    if (this.rebuildPending) {
      return;
    }
    this.rebuildPending = true;

    const self = this;
    setTimeout(() => {
      if (self.rebuildPending) {
        self.rebuildPending = false;
        self.emit("rebuild", self);
      }
    }, this.options.minRebuildInterval);
  };

  /**
   * queueSortPhase : If the view is sorted we will throttle sorting to either :
   *    (1) passive - when the user calls data(), or
   *    (2) active - once they stop updating and yield js thread control
   */
  queueSortPhase = () => {
    // already queued? exit without queuing again
    if (this.sortDirty) {
      return;
    }
    this.sortDirty = true;

    const self = this;
    if (this.options.sortPriority === "active") {
      // active sorting... once they are done and yield js thread, run async performSortPhase()
      setTimeout(() => {
        self.performSortPhase();
      }, this.options.minRebuildInterval);
    } else {
      // must be passive sorting... since not calling performSortPhase (until data call), lets use queueRebuildEvent to
      // potentially notify user that data has changed.
      this.queueRebuildEvent();
    }
  };

  /**
   * performSortPhase() - invoked synchronously or asynchronously to perform final sort phase (if needed)
   *
   */
  performSortPhase = (options?: Record<string, any>) => {
    // async call to this may have been pre-empted by synchronous call to data before async could fire
    if (!this.sortDirty && !this.resultsdirty) {
      return;
    }

    options = options || {};

    if (this.sortDirty) {
      if (this.sortFunction) {
        this.resultset.sort(this.sortFunction);
      } else if (this.sortCriteria) {
        this.resultset.compoundsort(this.sortCriteria);
      } else if (this.sortCriteriaSimple) {
        this.resultset.simplesort(
          this.sortCriteriaSimple.propname,
          this.sortCriteriaSimple.options
        );
      }

      this.sortDirty = false;
    }

    if (this.options.persistent) {
      // persistent view, rebuild local resultdata array
      this.resultdata = this.resultset.data();
      this.resultsdirty = false;
    }

    if (!options.suppressRebuildEvent) {
      this.emit("rebuild", this);
    }
  };

  /**
   * evaluateDocument() - internal method for (re)evaluating document inclusion.
   *    Called by : collection.insert() and collection.update().
   *
   * @param {int} objIndex - index of document to (re)run through filter pipeline.
   * @param {bool} isNew - true if the document was just added to the collection.
   */
  evaluateDocument = (objIndex, isNew) => {
    // if no filter applied yet, the result 'set' should remain 'everything'
    if (!this.resultset.filterInitialized) {
      if (this.options.persistent) {
        this.resultdata = this.resultset.data();
      }
      // need to re-sort to sort new document
      if (this.sortFunction || this.sortCriteria || this.sortCriteriaSimple) {
        this.queueSortPhase();
      } else {
        this.queueRebuildEvent();
      }
      return;
    }

    const ofr = this.resultset.filteredrows;
    const oldPos = isNew ? -1 : ofr.indexOf(+objIndex);
    const oldlen = ofr.length;

    // creating a 1-element resultset to run filter chain ops on to see if that doc passes filters;
    // mostly efficient algorithm, slight stack overhead price (this function is called on inserts and updates)
    const evalResultset = new Resultset(this.collection);
    evalResultset.filteredrows = [objIndex];
    evalResultset.filterInitialized = true;
    let filter;
    for (let idx = 0, len = this.filterPipeline.length; idx < len; idx++) {
      filter = this.filterPipeline[idx];
      evalResultset[filter.type](filter.val);
    }

    // not a true position, but -1 if not pass our filter(s), 0 if passed filter(s)
    const newPos = evalResultset.filteredrows.length === 0 ? -1 : 0;

    // wasn't in old, shouldn't be now... do nothing
    if (oldPos === -1 && newPos === -1) return;

    // wasn't in resultset, should be now... add
    if (oldPos === -1 && newPos !== -1) {
      ofr.push(objIndex);

      if (this.options.persistent) {
        this.resultdata.push(this.collection.data[objIndex]);
      }

      // need to re-sort to sort new document
      if (this.sortFunction || this.sortCriteria || this.sortCriteriaSimple) {
        this.queueSortPhase();
      } else {
        this.queueRebuildEvent();
      }

      return;
    }

    // was in resultset, shouldn't be now... delete
    if (oldPos !== -1 && newPos === -1) {
      if (oldPos < oldlen - 1) {
        ofr.splice(oldPos, 1);

        if (this.options.persistent) {
          this.resultdata.splice(oldPos, 1);
        }
      } else {
        ofr.length = oldlen - 1;

        if (this.options.persistent) {
          this.resultdata.length = oldlen - 1;
        }
      }

      // in case changes to data altered a sort column
      if (this.sortFunction || this.sortCriteria || this.sortCriteriaSimple) {
        this.queueSortPhase();
      } else {
        this.queueRebuildEvent();
      }

      return;
    }

    // was in resultset, should still be now... (update persistent only?)
    if (oldPos !== -1 && newPos !== -1) {
      if (this.options.persistent) {
        // in case document changed, replace persistent view data with the latest collection.data document
        this.resultdata[oldPos] = this.collection.data[objIndex];
      }

      // in case changes to data altered a sort column
      if (this.sortFunction || this.sortCriteria || this.sortCriteriaSimple) {
        this.queueSortPhase();
      } else {
        this.queueRebuildEvent();
      }

      return;
    }
  };

  /**
   * removeDocument() - internal function called on collection.delete()
   * @param {number|number[]} objIndex - index of document to (re)run through filter pipeline.
   */
  removeDocument = (objIndex) => {
    let idx;
    let rmidx;
    let rmlen;
    const rxo = {};
    const fxo = {};
    let adjels = [];
    const drs = this.resultset;
    const fr = this.resultset.filteredrows;
    let frlen = fr.length;

    // if no filter applied yet, the result 'set' should remain 'everything'
    if (!this.resultset.filterInitialized) {
      if (this.options.persistent) {
        this.resultdata = this.resultset.data();
      }
      // in case changes to data altered a sort column
      if (this.sortFunction || this.sortCriteria || this.sortCriteriaSimple) {
        this.queueSortPhase();
      } else {
        this.queueRebuildEvent();
      }
      return;
    }

    // if passed single index, wrap in array
    if (!Array.isArray(objIndex)) {
      objIndex = [objIndex];
    }

    rmlen = objIndex.length;
    // create intersection object of data indices to remove
    for (rmidx = 0; rmidx < rmlen; rmidx++) {
      rxo[objIndex[rmidx]] = true;
    }

    // pivot remove data indices into remove filteredrows indices and dump in hashobject
    for (idx = 0; idx < frlen; idx++) {
      if (rxo[fr[idx]]) fxo[idx] = true;
    }

    // if any of the removed items were in our filteredrows...
    if (Object.keys(fxo).length > 0) {
      // remove them from filtered rows
      this.resultset.filteredrows = this.resultset.filteredrows.filter(
        (di, idx) => !fxo[idx]
      );
      // if persistent...
      if (this.options.persistent) {
        // remove from resultdata
        this.resultdata = this.resultdata.filter((obj, idx) => !fxo[idx]);
      }

      // and queue sorts
      if (this.sortFunction || this.sortCriteria || this.sortCriteriaSimple) {
        this.queueSortPhase();
      } else {
        this.queueRebuildEvent();
      }
    }

    // to remove holes, we need to 'shift down' indices, this filter function finds number of positions to shift
    const filt = (idx) => (di) => di < drs.filteredrows[idx];

    frlen = drs.filteredrows.length;
    for (idx = 0; idx < frlen; idx++) {
      // grab subset of removed elements where data index is less than current filtered row data index;
      // use this to determine how many positions iterated remaining data index needs to be 'shifted down'
      adjels = objIndex.filter(filt(idx));
      drs.filteredrows[idx] -= adjels.length;
    }
  };

  /**
   * mapReduce() - data transformation via user supplied functions
   *
   * @param {function} mapFunction - this function accepts a single document for you to transform and return
   * @param {function} reduceFunction - this function accepts many (array of map outputs) and returns single value
   * @returns The output of your reduceFunction
   * @memberof DynamicView
   */
  mapReduce = (mapFunction, reduceFunction) => {
    return reduceFunction(this.data().map(mapFunction));
  };
}
