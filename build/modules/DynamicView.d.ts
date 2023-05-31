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
export declare class DynamicView extends LokiEventEmitter {
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
    events: {
        rebuild: any[];
        filter: any[];
        sort: any[];
    };
    constructor(collection: Collection, name: string, options?: Partial<DynamicViewOptions>);
    /**
     * getSort() - used to get the current sort
     *
     * @returns function (sortFunction) or array (sortCriteria) or object (sortCriteriaSimple)
     */
    getSort: () => any;
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
    rematerialize: (options: any) => this;
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
    branchResultset: (transform: any, parameters: any) => Resultset;
    /**
     * toJSON() - Override of toJSON to avoid circular references
     *
     */
    toJSON: () => DynamicView;
    /**
     * removeFilters() - Used to clear pipeline and reset dynamic view to initial state.
     *     Existing options should be retained.
     * @param {object=} options - configure removeFilter behavior
     * @param {boolean=} options.queueSortPhase - (default: false) if true we will async rebuild view (maybe set default to true in future?)
     * @memberof DynamicView
     */
    removeFilters: (options?: Record<string, any>) => void;
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
    applySort: (comparefun: any) => this;
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
    applySimpleSort: (propname: any, options: any) => this;
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
    applySortCriteria: (criteria: any) => this;
    /**
     * startTransaction() - marks the beginning of a transaction.
     *
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     */
    startTransaction: () => this;
    /**
     * commit() - commits a transaction.
     *
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     */
    commit: () => this;
    /**
     * rollback() - rolls back a transaction.
     *
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     */
    rollback: () => this;
    /**
     * Implementation detail.
     * _indexOfFilterWithId() - Find the index of a filter in the pipeline, by that filter's ID.
     *
     * @param {(string|number)} uid - The unique ID of the filter.
     * @returns {number}: index of the referenced filter in the pipeline; -1 if not found.
     */
    _indexOfFilterWithId: (uid: any) => number;
    /**
     * Implementation detail.
     * _addFilter() - Add the filter object to the end of view's filter pipeline and apply the filter to the resultset.
     *
     * @param {object} filter - The filter object. Refer to applyFilter() for extra details.
     */
    _addFilter: (filter: any) => void;
    /**
     * reapplyFilters() - Reapply all the filters in the current pipeline.
     *
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     */
    reapplyFilters: () => this;
    /**
     * applyFilter() - Adds or updates a filter in the DynamicView filter pipeline
     *
     * @param {object} filter - A filter object to add to the pipeline.
     *    The object is in the format { 'type': filter_type, 'val', filter_param, 'uid', optional_filter_id }
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     * @memberof DynamicView
     */
    applyFilter: (filter: any) => this;
    /**
     * applyFind() - Adds or updates a mongo-style query option in the DynamicView filter pipeline
     *
     * @param {object} query - A mongo-style query object to apply to pipeline
     * @param {(string|number)=} uid - Optional: The unique ID of this filter, to reference it in the future.
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     * @memberof DynamicView
     */
    applyFind: (query: any, uid: any) => this;
    /**
     * applyWhere() - Adds or updates a javascript filter function in the DynamicView filter pipeline
     *
     * @param {function} fun - A javascript filter function to apply to pipeline
     * @param {(string|number)=} uid - Optional: The unique ID of this filter, to reference it in the future.
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     * @memberof DynamicView
     */
    applyWhere: (fun: any, uid: any) => this;
    /**
     * removeFilter() - Remove the specified filter from the DynamicView filter pipeline
     *
     * @param {(string|number)} uid - The unique ID of the filter to be removed.
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     * @memberof DynamicView
     */
    removeFilter: (uid: any) => this;
    /**
     * count() - returns the number of documents representing the current DynamicView contents.
     *
     * @returns {number} The number of documents representing the current DynamicView contents.
     * @memberof DynamicView
     */
    count: () => any;
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
    data(options?: object): any[];
    /**
     * queueRebuildEvent() - When the view is not sorted we may still wish to be notified of rebuild events.
     *     This event will throttle and queue a single rebuild event when batches of updates affect the view.
     */
    queueRebuildEvent: () => void;
    /**
     * queueSortPhase : If the view is sorted we will throttle sorting to either :
     *    (1) passive - when the user calls data(), or
     *    (2) active - once they stop updating and yield js thread control
     */
    queueSortPhase: () => void;
    /**
     * performSortPhase() - invoked synchronously or asynchronously to perform final sort phase (if needed)
     *
     */
    performSortPhase: (options?: Record<string, any>) => void;
    /**
     * evaluateDocument() - internal method for (re)evaluating document inclusion.
     *    Called by : collection.insert() and collection.update().
     *
     * @param {int} objIndex - index of document to (re)run through filter pipeline.
     * @param {bool} isNew - true if the document was just added to the collection.
     */
    evaluateDocument: (objIndex: any, isNew: any) => void;
    /**
     * removeDocument() - internal function called on collection.delete()
     * @param {number|number[]} objIndex - index of document to (re)run through filter pipeline.
     */
    removeDocument: (objIndex: any) => void;
    /**
     * mapReduce() - data transformation via user supplied functions
     *
     * @param {function} mapFunction - this function accepts a single document for you to transform and return
     * @param {function} reduceFunction - this function accepts many (array of map outputs) and returns single value
     * @returns The output of your reduceFunction
     * @memberof DynamicView
     */
    mapReduce: (mapFunction: any, reduceFunction: any) => any;
}
export {};
