/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-var */
"use strict";
import { clone } from "../utils/clone";
import { freeze, deepFreeze, unFreeze } from "../utils/icebox";
import { Utils } from "../utils/index";
import { LokiOps } from "../utils/ops";
import { Comparators } from "../utils/sort";
import { LokiEventEmitter } from "./LokiEventEmitter";
import {
  hasOwnProperty,
  isDeepProperty,
  deepProperty,
  parseBase10,
  average,
  standardDeviation,
  sub,
} from "../loki";
import { ExactIndex } from "./ExactIndex";
import { UniqueIndex } from "./UniqueIndex";
import { DynamicView } from "./DynamicView";
import { Resultset } from "./Resultset";

/**
 * Collection class that handles documents of same type
 * @constructor Collection
 * @implements LokiEventEmitter
 * @param {string} name - collection name
 * @param {(array|object)=} options - (optional) array of property names to be indicized OR a configuration object
 * @param {array=} [options.unique=[]] - array of property names to define unique constraints for
 * @param {array=} [options.exact=[]] - array of property names to define exact constraints for
 * @param {array=} [options.indices=[]] - array property names to define binary indexes for
 * @param {boolean} [options.adaptiveBinaryIndices=true] - collection indices will be actively rebuilt rather than lazily
 * @param {boolean} [options.asyncListeners=false] - whether listeners are invoked asynchronously
 * @param {boolean} [options.disableMeta=false] - set to true to disable meta property on documents
 * @param {boolean} [options.disableChangesApi=true] - set to false to enable Changes API
 * @param {boolean} [options.disableDeltaChangesApi=true] - set to false to enable Delta Changes API (requires Changes API, forces cloning)
 * @param {boolean} [options.autoupdate=false] - use Object.observe to update objects automatically
 * @param {boolean} [options.clone=false] - specify whether inserts and queries clone to/from user
 * @param {boolean} [options.serializableIndices=true[]] - converts date values on binary indexed properties to epoch time
 * @param {boolean} [options.disableFreeze=true] - when false all docs are frozen
 * @param {string} [options.cloneMethod='parse-stringify'] - 'parse-stringify', 'jquery-extend-deep', 'shallow', 'shallow-assign'
 * @param {int=} options.ttl - age of document (in ms.) before document is considered aged/stale.
 * @param {int=} options.ttlInterval - time interval for clearing out 'aged' documents; not set by default.
 * @see {@link Loki#addCollection} for normal creation of collections
 */

export class Collection extends LokiEventEmitter {
  data: { $loki: number }[];
  isIncremental: any;
  name: any;
  idIndex: any;
  binaryIndices: {};
  constraints: { unique: {}; exact: {} };
  uniqueNames: any[];
  transforms: {};
  objType: any;
  dirty: boolean;
  cachedIndex: any;
  cachedBinaryIndex: any;
  cachedData: any;
  adaptiveBinaryIndices: any;
  transactional: any;
  cloneObjects: any;
  cloneMethod: any;
  disableMeta: any;
  disableChangesApi: any;
  disableDeltaChangesApi: any;
  autoupdate: any;
  serializableIndices: any;
  disableFreeze: any;
  ttl: { age: any; ttlInterval: any; daemon: any };
  maxId: number;
  DynamicViews: any[];
  changes: any[];
  dirtyIds: any[];
  observerCallback: (changes: any) => void;
  getChangeDelta: (obj: any, old: any) => any;
  getObjectDelta: (oldObject: any, newObject: any) => any;
  getChanges: () => any;
  flushChanges: () => void;
  setChangesApi: (enabled: any) => void;
  cachedDirtyIds: any;
  stages: any;
  commitLog: any;
  contructor: typeof Collection;
  no_op: () => void;
  constructor(name, options?: Record<string, any>) {
    super();
    // the name of the collection
    this.name = name;
    // the data held by the collection
    this.data = [];
    this.idIndex = null; // position->$loki index (built lazily)
    this.binaryIndices = {}; // user defined indexes
    this.constraints = {
      unique: {},
      exact: {},
    };

    // unique contraints contain duplicate object references, so they are not persisted.
    // we will keep track of properties which have unique contraint applied here, and regenerate lazily
    this.uniqueNames = [];

    // transforms will be used to store frequently used query chains as a series of steps
    // which itself can be stored along with the database.
    this.transforms = {};

    // the object type of the collection
    this.objType = name;

    // in autosave scenarios we will use collection level dirty flags to determine whether save is needed.
    // currently, if any collection is dirty we will autosave the whole database if autosave is configured.
    // defaulting to true since this is called from addCollection and adding a collection should trigger save
    this.dirty = true;

    // private holders for cached data
    this.cachedIndex = null;
    this.cachedBinaryIndex = null;
    this.cachedData = null;
    const self = this;

    /* OPTIONS */
    options = options || {};

    // exact match and unique constraints
    if (options.hasOwnProperty("unique")) {
      if (!Array.isArray(options.unique)) {
        options.unique = [options.unique];
      }
      // save names; actual index is built lazily
      options.unique.forEach((prop) => {
        self.uniqueNames.push(prop);
      });
    }

    if (options.hasOwnProperty("exact")) {
      options.exact.forEach((prop) => {
        self.constraints.exact[prop] = new ExactIndex(prop);
      });
    }

    // if set to true we will optimally keep indices 'fresh' during insert/update/remove ops (never dirty/never needs rebuild)
    // if you frequently intersperse insert/update/remove ops between find ops this will likely be significantly faster option.
    this.adaptiveBinaryIndices = options.hasOwnProperty("adaptiveBinaryIndices")
      ? options.adaptiveBinaryIndices
      : true;

    // is collection transactional
    this.transactional = options.hasOwnProperty("transactional")
      ? options.transactional
      : false;

    // options to clone objects when inserting them
    this.cloneObjects = options.hasOwnProperty("clone") ? options.clone : false;

    // default clone method (if enabled) is parse-stringify
    this.cloneMethod = options.hasOwnProperty("cloneMethod")
      ? options.cloneMethod
      : "parse-stringify";

    // option to make event listeners async, default is sync
    this.asyncListeners = options.hasOwnProperty("asyncListeners")
      ? options.asyncListeners
      : false;

    // if set to true we will not maintain a meta property for a document
    this.disableMeta = options.hasOwnProperty("disableMeta")
      ? options.disableMeta
      : false;

    // disable track changes
    this.disableChangesApi = options.hasOwnProperty("disableChangesApi")
      ? options.disableChangesApi
      : true;

    // disable delta update object style on changes
    this.disableDeltaChangesApi = options.hasOwnProperty(
      "disableDeltaChangesApi"
    )
      ? options.disableDeltaChangesApi
      : true;
    if (this.disableChangesApi) {
      this.disableDeltaChangesApi = true;
    }

    // option to observe objects and update them automatically, ignored if Object.observe is not supported
    this.autoupdate = options.hasOwnProperty("autoupdate")
      ? options.autoupdate
      : false;

    // by default, if you insert a document into a collection with binary indices, if those indexed properties contain
    // a DateTime we will convert to epoch time format so that (across serializations) its value position will be the
    // same 'after' serialization as it was 'before'.
    this.serializableIndices = options.hasOwnProperty("serializableIndices")
      ? options.serializableIndices
      : true;

    // option to deep freeze all documents
    this.disableFreeze = options.hasOwnProperty("disableFreeze")
      ? options.disableFreeze
      : true;

    //option to activate a cleaner daemon - clears "aged" documents at set intervals.
    this.ttl = {
      age: null,
      ttlInterval: null,
      daemon: null,
    };
    this.setTTL(options.ttl || -1, options.ttlInterval);

    // currentMaxId - change manually at your own peril!
    this.maxId = 0;

    this.DynamicViews = [];

    // events
    this.events = {
      insert: [],
      update: [],
      "pre-insert": [],
      "pre-update": [],
      close: [],
      flushbuffer: [],
      error: [],
      delete: [],
      warning: [],
    };

    // changes are tracked by collection and aggregated by the db
    this.changes = [];

    // lightweight changes tracking (loki IDs only) for optimized db saving
    this.dirtyIds = [];

    // initialize optional user-supplied indices array ['age', 'lname', 'zip']
    let indices = [];
    if (options && options.indices) {
      if (
        Object.prototype.toString.call(options.indices) === "[object Array]"
      ) {
        indices = options.indices;
      } else if (typeof options.indices === "string") {
        indices = [options.indices];
      } else {
        throw new TypeError(
          "Indices needs to be a string or an array of strings"
        );
      }
    }

    for (let idx = 0; idx < indices.length; idx++) {
      this.ensureIndex(indices[idx]);
    }

    function observerCallback(changes) {
      const changedObjects = new Set();

      if (!changedObjects.add)
        changedObjects.add = function (object) {
          if (!this.includes(object)) this.push(object);
          return this;
        };

      changes.forEach(({ object }) => {
        changedObjects.add(object);
      });

      changedObjects.forEach((object) => {
        if (!hasOwnProperty.call(object, "$loki"))
          return self.removeAutoUpdateObserver(object);
        try {
          self.update(object);
        } catch (err) {
          console.log(err);
        }
      });
    }

    this.observerCallback = observerCallback;

    //Compare changed object (which is a forced clone) with existing object and return the delta
    function getChangeDelta(obj, old) {
      if (old) {
        return getObjectDelta(old, obj);
      } else {
        return JSON.parse(JSON.stringify(obj));
      }
    }

    this.getChangeDelta = getChangeDelta;

    function getObjectDelta(oldObject, newObject) {
      const propertyNames =
        newObject !== null && typeof newObject === "object"
          ? Object.keys(newObject)
          : null;
      if (
        propertyNames &&
        propertyNames.length &&
        !["string", "boolean", "number"].includes(typeof newObject)
      ) {
        const delta = {};
        for (let i = 0; i < propertyNames.length; i++) {
          const propertyName = propertyNames[i];
          if (newObject.hasOwnProperty(propertyName)) {
            if (
              !oldObject.hasOwnProperty(propertyName) ||
              self.uniqueNames.includes(propertyName) ||
              propertyName == "$loki" ||
              propertyName == "meta"
            ) {
              delta[propertyName] = newObject[propertyName];
            } else {
              const propertyDelta = getObjectDelta(
                oldObject[propertyName],
                newObject[propertyName]
              );
              if (typeof propertyDelta !== "undefined") {
                delta[propertyName] = propertyDelta;
              }
            }
          }
        }
        return Object.keys(delta).length === 0 ? undefined : delta;
      } else {
        return oldObject === newObject ? undefined : newObject;
      }
    }

    this.getObjectDelta = getObjectDelta;

    // clear all the changes
    function flushChanges() {
      self.changes = [];
    }

    this.getChanges = () => self.changes;

    this.flushChanges = flushChanges;

    this.setChangesApi = (enabled) => {
      self.disableChangesApi = !enabled;
      if (!enabled) {
        self.disableDeltaChangesApi = false;
      }
    };

    this.on("delete", function deleteCallback(obj) {
      if (!self.disableChangesApi) {
        self.createChange(self.name, "R", obj);
      }
    });

    this.on("warning", (warning) => {
      self.lokiConsoleWrapper.warn(warning);
    });
    // for de-serialization purposes
    flushChanges();
  }

  /*
   * For ChangeAPI default to clone entire object, for delta changes create object with only differences (+ $loki and meta)
   */
  createChange(name: string, op: string, obj: object, old?: object) {
    this.changes.push({
      name,
      operation: op,
      obj:
        op == "U" && !this.disableDeltaChangesApi
          ? this.getChangeDelta(obj, old)
          : JSON.parse(JSON.stringify(obj)),
    });
  }

  insertMeta(obj) {
    let len;
    let idx;

    if (this.disableMeta || !obj) {
      return;
    }

    // if batch insert
    if (Array.isArray(obj)) {
      len = obj.length;

      for (idx = 0; idx < len; idx++) {
        if (!obj[idx].hasOwnProperty("meta")) {
          obj[idx].meta = {};
        }

        obj[idx].meta.created = new Date().getTime();
        obj[idx].meta.revision = 0;
      }

      return;
    }

    // single object
    if (!obj.meta) {
      obj.meta = {};
    }

    obj.meta.created = new Date().getTime();
    obj.meta.revision = 0;
  }

  updateMeta(obj) {
    if (this.disableMeta || !obj) {
      return obj;
    }
    if (!this.disableFreeze) {
      obj = unFreeze(obj);
      obj.meta = unFreeze(obj.meta);
    }
    obj.meta.updated = new Date().getTime();
    obj.meta.revision += 1;
    return obj;
  }

  createInsertChange(obj) {
    this.createChange(this.name, "I", obj);
  }

  createUpdateChange(obj, old) {
    this.createChange(this.name, "U", obj, old);
  }

  insertMetaWithChange(obj) {
    this.insertMeta(obj);
    this.createInsertChange(obj);
  }

  updateMetaWithChange(obj, old) {
    obj = this.updateMeta(obj);
    this.createUpdateChange(obj, old);
    return obj;
  }

  addAutoUpdateObserver(object) {
    if (!this.autoupdate || typeof Object.observe !== "function") return;

    Object.observe(object, this.observerCallback, [
      "add",
      "update",
      "delete",
      "reconfigure",
      "setPrototype",
    ]);
  }

  removeAutoUpdateObserver(object) {
    if (!this.autoupdate || typeof Object.observe !== "function") return;

    Object.unobserve(object, this.observerCallback);
  }

  /**
   * Adds a named collection transform to the collection
   * @param {string} name - name to associate with transform
   * @param {array} transform - an array of transformation 'step' objects to save into the collection
   * @memberof Collection
   * @example
   * users.addTransform('progeny', [
   *   {
   *     type: 'find',
   *     value: {
   *       'age': {'$lte': 40}
   *     }
   *   }
   * ]);
   *
   * var results = users.chain('progeny').data();
   */
  addTransform(name, transform) {
    if (this.transforms.hasOwnProperty(name)) {
      throw new Error("a transform by that name already exists");
    }

    this.transforms[name] = transform;
  }

  /**
   * Retrieves a named transform from the collection.
   * @param {string} name - name of the transform to lookup.
   * @memberof Collection
   */
  getTransform(name) {
    return this.transforms[name];
  }

  /**
   * Updates a named collection transform to the collection
   * @param {string} name - name to associate with transform
   * @param {object} transform - a transformation object to save into collection
   * @memberof Collection
   */
  setTransform(name, transform) {
    this.transforms[name] = transform;
  }

  /**
   * Removes a named collection transform from the collection
   * @param {string} name - name of collection transform to remove
   * @memberof Collection
   */
  removeTransform(name) {
    delete this.transforms[name];
  }

  byExample(template) {
    let k;
    let obj;
    let query;
    query = [];
    for (k in template) {
      if (!template.hasOwnProperty(k)) continue;
      query.push(((obj = {}), (obj[k] = template[k]), obj));
    }
    return {
      $and: query,
    };
  }

  findObject(template) {
    return this.findOne(this.byExample(template));
  }

  findObjects(template) {
    return this.find(this.byExample(template));
  }

  /*----------------------------+
        | TTL daemon                  |
        +----------------------------*/
  ttlDaemonFuncGen() {
    const collection = this;
    const age = this.ttl.age;
    return function ttlDaemon() {
      const now = Date.now();
      const toRemove = collection.chain().where(function daemonFilter(member) {
        const timestamp = member.meta.updated || member.meta.created;
        const diff = now - timestamp;
        return age < diff;
      });
      toRemove.remove();
    };
  }

  /**
   * Updates or applies collection TTL settings.
   * @param {int} age - age (in ms) to expire document from collection
   * @param {int} interval - time (in ms) to clear collection of aged documents.
   * @memberof Collection
   */
  setTTL(age, interval) {
    if (age < 0) {
      clearInterval(this.ttl.daemon);
    } else {
      this.ttl.age = age;
      this.ttl.ttlInterval = interval;
      this.ttl.daemon = setInterval(this.ttlDaemonFuncGen(), interval);
    }
  }

  /*----------------------------+
        | INDEXING                    |
        +----------------------------*/
  /**
   * create a row filter that covers all documents in the collection
   */
  prepareFullDocIndex() {
    const len = this.data.length;
    const indexes = new Array(len);
    for (let i = 0; i < len; i += 1) {
      indexes[i] = i;
    }
    return indexes;
  }

  /**
   * Will allow reconfiguring certain collection options.
   * @param {boolean} options.adaptiveBinaryIndices - collection indices will be actively rebuilt rather than lazily
   * @memberof Collection
   */
  configureOptions = (options: Record<string, any> = {}) => {
    if (options.hasOwnProperty("adaptiveBinaryIndices")) {
      this.adaptiveBinaryIndices = options.adaptiveBinaryIndices;

      // if switching to adaptive binary indices, make sure none are 'dirty'
      if (this.adaptiveBinaryIndices) {
        this.ensureAllIndexes();
      }
    }
  };

  /**
   * Ensure binary index on a certain field
   * @param {string} property - name of property to create binary index on
   * @param {boolean=} force - (Optional) flag indicating whether to construct index immediately
   * @memberof Collection
   */
  ensureIndex(property: string, force?: boolean) {
    // optional parameter to force rebuild whether flagged as dirty or not
    if (typeof force === "undefined") {
      force = false;
    }

    if (property === null || property === undefined) {
      throw new Error("Attempting to set index without an associated property");
    }

    if (this.binaryIndices[property] && !force) {
      if (!this.binaryIndices[property].dirty) return;
    }

    // if the index is already defined and we are using adaptiveBinaryIndices and we are not forcing a rebuild, return.
    if (
      this.adaptiveBinaryIndices === true &&
      this.binaryIndices.hasOwnProperty(property) &&
      !force
    ) {
      return;
    }

    const index = {
      name: property,
      dirty: true,
      values: this.prepareFullDocIndex(),
    };
    this.binaryIndices[property] = index;

    const wrappedComparer = ((prop, data) => {
      let val1;
      let val2;
      const propPath = ~prop.indexOf(".") ? prop.split(".") : false;
      return (a, b) => {
        if (propPath) {
          val1 = Utils.getIn(data[a], propPath, true);
          val2 = Utils.getIn(data[b], propPath, true);
        } else {
          val1 = data[a][prop];
          val2 = data[b][prop];
        }

        if (val1 !== val2) {
          if (Comparators.lt(val1, val2, false)) return -1;
          if (Comparators.gt(val1, val2, false)) return 1;
        }
        return 0;
      };
    })(property, this.data);

    index.values.sort(wrappedComparer);
    index.dirty = false;

    this.dirty = true; // for autosave scenarios
  }

  /**
   * Perform checks to determine validity/consistency of all binary indices
   * @param {object=} options - optional configuration object
   * @param {boolean} [options.randomSampling=false] - whether (faster) random sampling should be used
   * @param {number} [options.randomSamplingFactor=0.10] - percentage of total rows to randomly sample
   * @param {boolean} [options.repair=false] - whether to fix problems if they are encountered
   * @returns {string[]} array of index names where problems were found.
   * @memberof Collection
   * @example
   * // check all indices on a collection, returns array of invalid index names
   * var result = coll.checkAllIndexes({ repair: true, randomSampling: true, randomSamplingFactor: 0.15 });
   * if (result.length > 0) {
   *   results.forEach(function(name) {
   *     console.log('problem encountered with index : ' + name);
   *   });
   * }
   */
  checkAllIndexes(options) {
    let key;
    const bIndices = this.binaryIndices;
    const results = [];
    let result;

    for (key in bIndices) {
      if (hasOwnProperty.call(bIndices, key)) {
        result = this.checkIndex(key, options);
        if (!result) {
          results.push(key);
        }
      }
    }

    return results;
  }

  /**
   * Perform checks to determine validity/consistency of a binary index
   * @param {string} property - name of the binary-indexed property to check
   * @param {object=} options - optional configuration object
   * @param {boolean} [options.randomSampling=false] - whether (faster) random sampling should be used
   * @param {number} [options.randomSamplingFactor=0.10] - percentage of total rows to randomly sample
   * @param {boolean} [options.repair=false] - whether to fix problems if they are encountered
   * @returns {boolean} whether the index was found to be valid (before optional correcting).
   * @memberof Collection
   * @example
   * // full test
   * var valid = coll.checkIndex('name');
   * // full test with repair (if issues found)
   * valid = coll.checkIndex('name', { repair: true });
   * // random sampling (default is 10% of total document count)
   * valid = coll.checkIndex('name', { randomSampling: true });
   * // random sampling (sample 20% of total document count)
   * valid = coll.checkIndex('name', { randomSampling: true, randomSamplingFactor: 0.20 });
   * // random sampling (implied boolean)
   * valid = coll.checkIndex('name', { randomSamplingFactor: 0.20 });
   * // random sampling with repair (if issues found)
   * valid = coll.checkIndex('name', { repair: true, randomSampling: true });
   */
  checkIndex(property, options: Record<string, any> = {}) {
    // if 'randomSamplingFactor' specified but not 'randomSampling', assume true
    if (options.randomSamplingFactor && options.randomSampling !== false) {
      options.randomSampling = true;
    }
    options.randomSamplingFactor = options.randomSamplingFactor || 0.1;
    if (options.randomSamplingFactor < 0 || options.randomSamplingFactor > 1) {
      options.randomSamplingFactor = 0.1;
    }

    let valid = true;
    let idx;
    let iter;
    let pos;

    // make sure we are passed a valid binary index name
    if (!this.binaryIndices.hasOwnProperty(property)) {
      throw new Error(
        `called checkIndex on property without an index: ${property}`
      );
    }

    // if lazy indexing, rebuild only if flagged as dirty
    if (!this.adaptiveBinaryIndices) {
      this.ensureIndex(property);
    }

    const biv = this.binaryIndices[property].values;
    const len = biv.length;

    // if the index has an incorrect number of values
    if (len !== this.data.length) {
      if (options.repair) {
        this.ensureIndex(property, true);
      }
      return false;
    }

    if (len === 0) {
      return true;
    }

    const usingDotNotation = property.includes(".");

    if (len === 1) {
      valid = biv[0] === 0;
    } else {
      if (options.randomSampling) {
        // validate first and last
        if (
          !LokiOps.$lte(
            Utils.getIn(this.data[biv[0]], property, usingDotNotation),
            Utils.getIn(this.data[biv[1]], property, usingDotNotation)
          )
        ) {
          valid = false;
        }
        if (
          !LokiOps.$lte(
            Utils.getIn(this.data[biv[len - 2]], property, usingDotNotation),
            Utils.getIn(this.data[biv[len - 1]], property, usingDotNotation)
          )
        ) {
          valid = false;
        }

        // if first and last positions are sorted correctly with their nearest neighbor,
        // continue onto random sampling phase...
        if (valid) {
          // # random samplings = total count * sampling factor
          iter = Math.floor((len - 1) * options.randomSamplingFactor);

          // for each random sampling, validate that the binary index is sequenced properly
          // with next higher value.
          for (idx = 0; idx < iter - 1; idx++) {
            // calculate random position
            pos = Math.floor(Math.random() * (len - 1));
            if (
              !LokiOps.$lte(
                Utils.getIn(this.data[biv[pos]], property, usingDotNotation),
                Utils.getIn(this.data[biv[pos + 1]], property, usingDotNotation)
              )
            ) {
              valid = false;
              break;
            }
          }
        }
      } else {
        // validate that the binary index is sequenced properly
        for (idx = 0; idx < len - 1; idx++) {
          if (
            !LokiOps.$lte(
              Utils.getIn(this.data[biv[idx]], property, usingDotNotation),
              Utils.getIn(this.data[biv[idx + 1]], property, usingDotNotation)
            )
          ) {
            valid = false;
            break;
          }
        }
      }
    }

    // if incorrectly sequenced and we are to fix problems, rebuild index
    if (!valid && options.repair) {
      this.ensureIndex(property, true);
    }

    return valid;
  }

  getBinaryIndexValues(property) {
    let idx;
    const idxvals = this.binaryIndices[property].values;
    const result = [];

    for (idx = 0; idx < idxvals.length; idx++) {
      result.push(Utils.getIn(this.data[idxvals[idx]], property, true));
    }

    return result;
  }

  /**
   * Returns a named unique index
   * @param {string} field - indexed field name
   * @param {boolean} force - if `true`, will rebuild index; otherwise, function may return null
   */
  getUniqueIndex(field, force?: boolean) {
    const index = this.constraints.unique[field];
    if (!index && force) {
      return this.ensureUniqueIndex(field);
    }
    return index;
  }

  ensureUniqueIndex(field) {
    let index = this.constraints.unique[field];
    if (!index) {
      // keep track of new unique index for regenerate after database (re)load.
      if (!this.uniqueNames.includes(field)) {
        this.uniqueNames.push(field);
      }
    }

    // if index already existed, (re)loading it will likely cause collisions, rebuild always
    this.constraints.unique[field] = index = new UniqueIndex(field);
    this.data.forEach((obj) => {
      index.set(obj);
    });
    return index;
  }

  /**
   * Ensure all binary indices
   * @param {boolean} force - whether to force rebuild of existing lazy binary indices
   * @memberof Collection
   */
  ensureAllIndexes(force?: boolean) {
    let key;
    const bIndices = this.binaryIndices;
    for (key in bIndices) {
      if (hasOwnProperty.call(bIndices, key)) {
        this.ensureIndex(key, force);
      }
    }
  }

  /**
   * Internal method used to flag all lazy index as dirty
   */
  flagBinaryIndexesDirty() {
    let key;
    const bIndices = this.binaryIndices;
    for (key in bIndices) {
      if (hasOwnProperty.call(bIndices, key)) {
        bIndices[key].dirty = true;
      }
    }
  }

  /**
   * Internal method used to flag a lazy index as dirty
   */
  flagBinaryIndexDirty(index) {
    if (this.binaryIndices[index]) this.binaryIndices[index].dirty = true;
  }

  /**
   * Quickly determine number of documents in collection (or query)
   * @param {object=} query - (optional) query object to count results of
   * @returns {number} number of documents in the collection
   * @memberof Collection
   */
  count = (query?: Record<string, any>) => {
    if (!query) {
      return this.data.length;
    }

    return this.chain().find(query).filteredrows.length;
  };

  /**
   * Rebuild idIndex
   */
  ensureId() {
    if (this.idIndex) {
      return;
    }
    const data = this.data;
    let i = 0;
    const len = data.length;
    const index = new Array(len);
    for (i; i < len; i++) {
      index[i] = data[i].$loki;
    }
    this.idIndex = index;
  }

  /**
   * Rebuild idIndex async with callback - useful for background syncing with a remote server
   */
  ensureIdAsync(callback) {
    this.async(function () {
      this.ensureId();
    }, callback);
  }

  /**
   * Add a dynamic view to the collection
   * @param {string} name - name of dynamic view to add
   * @param {object=} options - options to configure dynamic view with
   * @param {boolean} [options.persistent=false] - indicates if view is to main internal results array in 'resultdata'
   * @param {string} [options.sortPriority='passive'] - 'passive' (sorts performed on call to data) or 'active' (after updates)
   * @param {number} options.minRebuildInterval - minimum rebuild interval (need clarification to docs here)
   * @returns {DynamicView} reference to the dynamic view added
   * @memberof Collection
   * @example
   * var pview = users.addDynamicView('progeny');
   * pview.applyFind({'age': {'$lte': 40}});
   * pview.applySimpleSort('name');
   *
   * var results = pview.data();
   **/
  addDynamicView(name, options) {
    const dv = new DynamicView(this, name, options);
    this.DynamicViews.push(dv);

    return dv;
  }

  /**
   * Remove a dynamic view from the collection
   * @param {string} name - name of dynamic view to remove
   * @memberof Collection
   **/
  removeDynamicView(name) {
    this.DynamicViews = this.DynamicViews.filter((dv) => dv.name !== name);
  }

  /**
   * Look up dynamic view reference from within the collection
   * @param {string} name - name of dynamic view to retrieve reference of
   * @returns {DynamicView} A reference to the dynamic view with that name
   * @memberof Collection
   **/
  getDynamicView(name) {
    for (let idx = 0; idx < this.DynamicViews.length; idx++) {
      if (this.DynamicViews[idx].name === name) {
        return this.DynamicViews[idx];
      }
    }

    return null;
  }

  /**
   * Applies a 'mongo-like' find query object and passes all results to an update function.
   * For filter function querying you should migrate to [updateWhere()]{@link Collection#updateWhere}.
   *
   * @param {object|function} filterObject - 'mongo-like' query object (or deprecated filterFunction mode)
   * @param {function} updateFunction - update function to run against filtered documents
   * @memberof Collection
   */
  findAndUpdate(filterObject, updateFunction) {
    if (typeof filterObject === "function") {
      this.updateWhere(filterObject, updateFunction);
    } else {
      this.chain().find(filterObject).update(updateFunction);
    }
  }

  /**
   * Applies a 'mongo-like' find query object removes all documents which match that filter.
   *
   * @param {object} filterObject - 'mongo-like' query object
   * @memberof Collection
   */
  findAndRemove(filterObject) {
    this.chain().find(filterObject).remove();
  }

  /**
   * Adds object(s) to collection, ensure object(s) have meta properties, clone it if necessary, etc.
   * @param {(object|array)} doc - the document (or array of documents) to be inserted
   * @param {boolean=} overrideAdaptiveIndices - (optional) if `true`, adaptive indicies will be
   *   temporarily disabled and then fully rebuilt after batch. This will be faster for
   *   large inserts, but slower for small/medium inserts in large collections
   * @returns {(object|array)} document or documents inserted
   * @memberof Collection
   * @example
   * users.insert({
   *     name: 'Odin',
   *     age: 50,
   *     address: 'Asgard'
   * });
   *
   * // alternatively, insert array of documents
   * users.insert([{ name: 'Thor', age: 35}, { name: 'Loki', age: 30}]);
   */
  insert(doc, overrideAdaptiveIndices?: boolean) {
    if (!Array.isArray(doc)) {
      return this.insertOne(doc);
    }

    // holder to the clone of the object inserted if collections is set to clone objects
    let obj;
    let results = [];

    // if not cloning, disable adaptive binary indices for the duration of the batch insert,
    // followed by lazy rebuild and re-enabling adaptive indices after batch insert.
    const adaptiveBatchOverride =
      overrideAdaptiveIndices &&
      !this.cloneObjects &&
      this.adaptiveBinaryIndices &&
      Object.keys(this.binaryIndices).length > 0;

    if (adaptiveBatchOverride) {
      this.adaptiveBinaryIndices = false;
    }

    try {
      this.emit("pre-insert", doc);
      for (let i = 0, len = doc.length; i < len; i++) {
        obj = this.insertOne(doc[i], true);
        if (!obj) {
          return undefined;
        }
        results.push(obj);
      }
    } finally {
      if (adaptiveBatchOverride) {
        this.ensureAllIndexes();
        this.adaptiveBinaryIndices = true;
      }
    }

    // at the 'batch' level, if clone option is true then emitted docs are clones
    this.emit("insert", results);

    // if clone option is set, clone return values
    results = this.cloneObjects ? clone(results, this.cloneMethod) : results;

    return results.length === 1 ? results[0] : results;
  }

  /**
   * Adds a single object, ensures it has meta properties, clone it if necessary, etc.
   * @param {object} doc - the document to be inserted
   * @param {boolean} bulkInsert - quiet pre-insert and insert event emits
   * @returns {object} document or 'undefined' if there was a problem inserting it
   */
  insertOne(doc, bulkInsert?: boolean) {
    let err = null;

    if (typeof doc !== "object") {
      err = new TypeError("Document needs to be an object");
    } else if (doc === null) {
      err = new TypeError("Object cannot be null");
    }

    if (err !== null) {
      this.emit("error", err);
      throw err;
    }

    // if configured to clone, do so now... otherwise just use same obj reference
    let obj = this.cloneObjects ? clone(doc, this.cloneMethod) : doc;
    if (!this.disableFreeze) {
      obj = unFreeze(obj);
    }

    if (!this.disableMeta) {
      if (typeof obj.meta === "undefined") {
        obj.meta = {
          revision: 0,
          created: 0,
        };
      } else if (!this.disableFreeze) {
        obj.meta = unFreeze(obj.meta);
      }
    }

    // both 'pre-insert' and 'insert' events are passed internal data reference even when cloning
    // insert needs internal reference because that is where loki itself listens to add meta
    if (!bulkInsert) {
      this.emit("pre-insert", obj);
    }
    if (!this.add(obj)) {
      return undefined;
    }

    // update meta and store changes if ChangesAPI is enabled
    // (moved from "insert" event listener to allow internal reference to be used)
    if (this.disableChangesApi) {
      this.insertMeta(obj);
    } else {
      this.insertMetaWithChange(obj);
    }

    if (!this.disableFreeze) {
      deepFreeze(obj);
    }

    // if cloning is enabled, emit insert event with clone of new object
    const returnObj = this.cloneObjects ? clone(obj, this.cloneMethod) : obj;

    if (!bulkInsert) {
      this.emit("insert", returnObj);
    }

    this.addAutoUpdateObserver(returnObj);

    return returnObj;
  }

  /**
   * Empties the collection.
   * @param {object=} options - configure clear behavior
   * @param {bool=} [options.removeIndices=false] - whether to remove indices in addition to data
   * @memberof Collection
   */
  clear(options) {
    const self = this;

    options = options || {};

    this.data = [];
    this.idIndex = null;
    this.cachedIndex = null;
    this.cachedBinaryIndex = null;
    this.cachedData = null;
    this.maxId = 0;
    this.DynamicViews = [];
    this.dirty = true;
    this.constraints = {
      unique: {},
      exact: {},
    };

    // if removing indices entirely
    if (options.removeIndices === true) {
      this.binaryIndices = {};
      this.uniqueNames = [];
    }

    // clear indices but leave definitions in place
    else {
      // clear binary indices
      const keys = Object.keys(this.binaryIndices);
      keys.forEach((biname) => {
        self.binaryIndices[biname].dirty = false;
        self.binaryIndices[biname].values = [];
      });
    }
  }

  /**
   * Updates an object and notifies collection that the document has changed.
   * @param {object} doc - document to update within the collection
   * @memberof Collection
   */
  update(doc) {
    let adaptiveBatchOverride;
    let k;
    let len;

    if (Array.isArray(doc)) {
      len = doc.length;

      // if not cloning, disable adaptive binary indices for the duration of the batch update,
      // followed by lazy rebuild and re-enabling adaptive indices after batch update.
      adaptiveBatchOverride =
        !this.cloneObjects &&
        this.adaptiveBinaryIndices &&
        Object.keys(this.binaryIndices).length > 0;

      if (adaptiveBatchOverride) {
        this.adaptiveBinaryIndices = false;
      }

      try {
        for (k = 0; k < len; k += 1) {
          this.update(doc[k]);
        }
      } finally {
        if (adaptiveBatchOverride) {
          this.ensureAllIndexes();
          this.adaptiveBinaryIndices = true;
        }
      }

      return;
    }

    // verify object is a properly formed document
    if (!hasOwnProperty.call(doc, "$loki")) {
      throw new Error(
        "Trying to update unsynced document. Please save the document first by using insert() or addMany()"
      );
    }
    try {
      this.startTransaction();
      const arr = this.get(doc.$loki, true);

      let newInternal;

      const self = this;

      if (!arr) {
        throw new Error("Trying to update a document not in collection.");
      }

      const oldInternal = arr[0]; // -internal- obj ref
      const position = arr[1]; // position in data array

      // if configured to clone, do so now... otherwise just use same obj reference
      newInternal =
        this.cloneObjects ||
        (!this.disableDeltaChangesApi && this.disableFreeze)
          ? clone(doc, this.cloneMethod)
          : doc;

      this.emit("pre-update", doc);

      this.uniqueNames.forEach((key) => {
        self.getUniqueIndex(key, true).update(oldInternal, newInternal);
      });

      // operate the update
      this.data[position] = newInternal;

      if (newInternal !== doc) {
        this.addAutoUpdateObserver(doc);
      }

      // now that we can efficiently determine the data[] position of newly added document,
      // submit it for all registered DynamicViews to evaluate for inclusion/exclusion
      for (let idx = 0; idx < this.DynamicViews.length; idx++) {
        this.DynamicViews[idx].evaluateDocument(position, false);
      }

      let key;
      if (this.adaptiveBinaryIndices) {
        // for each binary index defined in collection, immediately update rather than flag for lazy rebuild
        const bIndices = this.binaryIndices;
        for (key in bIndices) {
          this.adaptiveBinaryIndexUpdate(position, key);
        }
      } else {
        this.flagBinaryIndexesDirty();
      }

      this.idIndex[position] = newInternal.$loki;
      //this.flagBinaryIndexesDirty();
      if (this.isIncremental) {
        this.dirtyIds.push(newInternal.$loki);
      }

      this.commit();
      this.dirty = true; // for autosave scenarios

      // update meta and store changes if ChangesAPI is enabled
      if (this.disableChangesApi) {
        newInternal = this.updateMeta(newInternal);
      } else {
        newInternal = this.updateMetaWithChange(newInternal, oldInternal);
      }

      if (!this.disableFreeze) {
        deepFreeze(newInternal);
      }

      let returnObj;

      // if cloning is enabled, emit 'update' event and return with clone of new object
      if (this.cloneObjects) {
        returnObj = clone(newInternal, this.cloneMethod);
      } else {
        returnObj = newInternal;
      }

      this.emit("update", returnObj);
      // this.emit("update", returnObj, oldInternal);
      return returnObj;
    } catch (err) {
      this.rollback();
      this.lokiConsoleWrapper.error(err.message);
      this.emit("error", err);
      throw err; // re-throw error so user does not think it succeeded
    }
  }

  /**
   * Add object to collection
   */
  add(obj) {
    // if parameter isn't object exit with throw
    if ("object" !== typeof obj) {
      throw new TypeError("Object being added needs to be an object");
    }
    // if object you are adding already has id column it is either already in the collection
    // or the object is carrying its own 'id' property.  If it also has a meta property,
    // then this is already in collection so throw error, otherwise rename to originalId and continue adding.
    if (typeof obj.$loki !== "undefined") {
      throw new Error("Document is already in collection, please use update()");
    }

    /*
     * try adding object to collection
     */
    try {
      this.startTransaction();
      this.maxId++;

      if (isNaN(this.maxId)) {
        this.maxId = this.data[this.data.length - 1].$loki + 1;
      }

      const newId = this.maxId;
      obj.$loki = newId;

      if (!this.disableMeta) {
        obj.meta.version = 0;
      }

      for (var i = 0, len = this.uniqueNames.length; i < len; i++) {
        this.getUniqueIndex(this.uniqueNames[i], true).set(obj);
      }

      if (this.idIndex) {
        this.idIndex.push(newId);
      }

      if (this.isIncremental) {
        this.dirtyIds.push(newId);
      }

      // add the object
      this.data.push(obj);

      const addedPos = this.data.length - 1;

      // now that we can efficiently determine the data[] position of newly added document,
      // submit it for all registered DynamicViews to evaluate for inclusion/exclusion
      const dvlen = this.DynamicViews.length;
      for (i = 0; i < dvlen; i++) {
        this.DynamicViews[i].evaluateDocument(addedPos, true);
      }

      if (this.adaptiveBinaryIndices) {
        // for each binary index defined in collection, immediately update rather than flag for lazy rebuild
        const bIndices = this.binaryIndices;
        for (const key in bIndices) {
          this.adaptiveBinaryIndexInsert(addedPos, key);
        }
      } else {
        this.flagBinaryIndexesDirty();
      }

      this.commit();
      this.dirty = true; // for autosave scenarios

      return this.cloneObjects ? clone(obj, this.cloneMethod) : obj;
    } catch (err) {
      this.rollback();
      this.lokiConsoleWrapper.error(err.message);
      this.emit("error", err);
      throw err; // re-throw error so user does not think it succeeded
    }
  }

  /**
   * Applies a filter function and passes all results to an update function.
   *
   * @param {function} filterFunction - filter function whose results will execute update
   * @param {function} updateFunction - update function to run against filtered documents
   * @memberof Collection
   */
  updateWhere(filterFunction, updateFunction) {
    const results = this.where(filterFunction);
    let i = 0;
    let obj;
    try {
      for (i; i < results.length; i++) {
        obj = updateFunction(results[i]);
        this.update(obj);
      }
    } catch (err) {
      this.rollback();
      this.lokiConsoleWrapper.error(err.message);
    }
  }

  /**
   * Remove all documents matching supplied filter function.
   * For 'mongo-like' querying you should migrate to [findAndRemove()]{@link Collection#findAndRemove}.
   * @param {function|object} query - query object to filter on
   * @memberof Collection
   */
  removeWhere(query) {
    let list;
    if (typeof query === "function") {
      list = this.data.filter(query);
      this.remove(list);
    } else {
      this.chain().find(query).remove();
    }
  }

  removeDataOnly() {
    this.remove(this.data.slice());
  }

  /**
   * Internal method to remove a batch of documents from the collection.
   * @param {number[]} positions - data/idIndex positions to remove
   */
  removeBatchByPositions(positions) {
    const len = positions.length;
    const xo = {};
    let dlen;
    let didx;
    let idx;
    const bic = Object.keys(this.binaryIndices).length;
    const uic = Object.keys(this.constraints.unique).length;
    const adaptiveOverride =
      this.adaptiveBinaryIndices && Object.keys(this.binaryIndices).length > 0;
    let doc;
    const self = this;

    try {
      this.startTransaction();

      // create hashobject for positional removal inclusion tests...
      // all keys defined in this hashobject represent $loki ids of the documents to remove.
      this.ensureId();
      for (idx = 0; idx < len; idx++) {
        xo[this.idIndex[positions[idx]]] = true;
      }

      // if we will need to notify dynamic views and/or binary indices to update themselves...
      dlen = this.DynamicViews.length;
      if (dlen > 0 || bic > 0 || uic > 0) {
        if (dlen > 0) {
          // notify dynamic views to remove relevant documents at data positions
          for (didx = 0; didx < dlen; didx++) {
            // notify dv of remove (passing batch/array of positions)
            this.DynamicViews[didx].removeDocument(positions);
          }
        }

        // notify binary indices to update
        if (this.adaptiveBinaryIndices && !adaptiveOverride) {
          // for each binary index defined in collection, immediately update rather than flag for lazy rebuild
          let key;

          const bIndices = this.binaryIndices;

          for (key in bIndices) {
            this.adaptiveBinaryIndexRemove(positions, key);
          }
        } else {
          this.flagBinaryIndexesDirty();
        }

        if (uic) {
          this.uniqueNames.forEach((key) => {
            const index = self.getUniqueIndex(key);
            if (index) {
              for (idx = 0; idx < len; idx++) {
                doc = self.data[positions[idx]];
                if (doc[key] !== null && doc[key] !== undefined) {
                  index.remove(doc[key]);
                }
              }
            }
          });
        }
      }

      // emit 'delete' events only of listeners are attached.
      // since data not removed yet, in future we can emit single delete event with array...
      // for now that might be breaking change to put in potential 1.6 or LokiDB (lokijs2) version
      if (!this.disableChangesApi || this.events.delete.length > 1) {
        for (idx = 0; idx < len; idx++) {
          this.emit("delete", this.data[positions[idx]]);
        }
      }

      // remove from data[] :
      // filter collection data for items not in inclusion hashobject
      this.data = this.data.filter(({ $loki }) => !xo[$loki]);

      if (this.isIncremental) {
        for (idx = 0; idx < len; idx++) {
          this.dirtyIds.push(this.idIndex[positions[idx]]);
        }
      }

      // remove from idIndex[] :
      // filter idIndex for items not in inclusion hashobject
      this.idIndex = this.idIndex.filter((id) => !xo[id]);

      if (this.adaptiveBinaryIndices && adaptiveOverride) {
        this.adaptiveBinaryIndices = false;
        this.ensureAllIndexes(true);
        this.adaptiveBinaryIndices = true;
      }

      this.commit();

      // flag collection as dirty for autosave
      this.dirty = true;
    } catch (err) {
      this.rollback();
      if (adaptiveOverride) {
        this.adaptiveBinaryIndices = true;
      }
      this.lokiConsoleWrapper.error(err.message);
      this.emit("error", err);
      return null;
    }
  }

  /**
   *  Internal method called by remove()
   * @param {object[]|number[]} batch - array of documents or $loki ids to remove
   */
  removeBatch(batch) {
    const len = batch.length;
    const dlen = this.data.length;
    let idx;
    const xlt = {};
    const posx = [];

    // create lookup hashobject to translate $loki id to position
    for (idx = 0; idx < dlen; idx++) {
      xlt[this.data[idx].$loki] = idx;
    }

    // iterate the batch
    for (idx = 0; idx < len; idx++) {
      if (typeof batch[idx] === "object") {
        posx.push(xlt[batch[idx].$loki]);
      } else {
        posx.push(xlt[batch[idx]]);
      }
    }

    this.removeBatchByPositions(posx);
  }

  /**
   * Remove a document from the collection
   * @param {object} doc - document to remove from collection
   * @memberof Collection
   */
  remove(doc) {
    if (typeof doc === "number") {
      doc = this.get(doc);
    }

    if ("object" !== typeof doc) {
      throw new Error("Parameter is not an object");
    }
    if (Array.isArray(doc)) {
      this.removeBatch(doc);
      return;
    }

    if (!hasOwnProperty.call(doc, "$loki")) {
      throw new Error("Object is not a document stored in the collection");
    }

    try {
      this.startTransaction();
      const arr = this.get(doc.$loki, true);

      const position = arr[1];

      const self = this;
      this.uniqueNames.forEach((key) => {
        if (doc[key] !== null && typeof doc[key] !== "undefined") {
          const index = self.getUniqueIndex(key);
          if (index) {
            index.remove(doc[key]);
          }
        }
      });
      // now that we can efficiently determine the data[] position of newly added document,
      // submit it for all registered DynamicViews to remove
      for (let idx = 0; idx < this.DynamicViews.length; idx++) {
        this.DynamicViews[idx].removeDocument(position);
      }

      if (this.adaptiveBinaryIndices) {
        // for each binary index defined in collection, immediately update rather than flag for lazy rebuild
        let key;

        const bIndices = this.binaryIndices;
        for (key in bIndices) {
          this.adaptiveBinaryIndexRemove(position, key);
        }
      } else {
        this.flagBinaryIndexesDirty();
      }

      this.data.splice(position, 1);
      this.removeAutoUpdateObserver(doc);

      // remove id from idIndex
      this.idIndex.splice(position, 1);

      if (this.isIncremental) {
        this.dirtyIds.push(doc.$loki);
      }

      this.commit();
      this.dirty = true; // for autosave scenarios
      this.emit("delete", arr[0]);

      if (!this.disableFreeze) {
        doc = unFreeze(doc);
      }
      delete doc.$loki;
      delete doc.meta;
      if (!this.disableFreeze) {
        freeze(doc);
      }
      return doc;
    } catch (err) {
      this.rollback();
      this.lokiConsoleWrapper.error(err.message);
      this.emit("error", err);
      return null;
    }
  }

  /*---------------------+
        | Finding methods     |
        +----------------------*/
  /**
   * Get by Id - faster than other methods because of the searching algorithm
   * @param {int} id - $loki id of document you want to retrieve
   * @param {boolean} returnPosition - if 'true' we will return [object, position]
   * @returns {(object|array|null)} Object reference if document was found, null if not,
   *     or an array if 'returnPosition' was passed.
   * @memberof Collection
   */
  get(id, returnPosition?: boolean) {
    if (!this.idIndex) {
      this.ensureId();
    }

    const retpos = returnPosition || false;
    const data = this.idIndex;
    let max = data.length - 1;
    let min = 0;
    let mid = (min + max) >> 1;

    id = typeof id === "number" ? id : parseInt(id, 10);

    if (isNaN(id)) {
      throw new TypeError("Passed id is not an integer");
    }

    while (data[min] < data[max]) {
      mid = (min + max) >> 1;

      if (data[mid] < id) {
        min = mid + 1;
      } else {
        max = mid;
      }
    }

    if (max === min && data[min] === id) {
      if (retpos) {
        return [this.data[min], min];
      }
      return this.data[min];
    }
    return null;
  }

  /**
   * Perform binary range lookup for the data[dataPosition][binaryIndexName] property value
   *    Since multiple documents may contain the same value (which the index is sorted on),
   *    we hone in on range and then linear scan range to find exact index array position.
   * @param {int} dataPosition : coll.data array index/position
   * @param {string} binaryIndexName : index to search for dataPosition in
   */
  getBinaryIndexPosition(dataPosition, binaryIndexName) {
    const val = Utils.getIn(this.data[dataPosition], binaryIndexName, true);
    const index = this.binaryIndices[binaryIndexName].values;

    // i think calculateRange can probably be moved to collection
    // as it doesn't seem to need resultset.  need to verify
    const range = this.calculateRange("$eq", binaryIndexName, val);

    if (range[0] === 0 && range[1] === -1) {
      // uhoh didn't find range
      return null;
    }

    const min = range[0];
    const max = range[1];

    // narrow down the sub-segment of index values
    // where the indexed property value exactly matches our
    // value and then linear scan to find exact -index- position
    for (let idx = min; idx <= max; idx++) {
      if (index[idx] === dataPosition) return idx;
    }

    // uhoh
    return null;
  }

  /**
   * Adaptively insert a selected item to the index.
   * @param {int} dataPosition : coll.data array index/position
   * @param {string} binaryIndexName : index to search for dataPosition in
   */
  adaptiveBinaryIndexInsert(dataPosition, binaryIndexName) {
    const usingDotNotation = binaryIndexName.includes(".");
    const index = this.binaryIndices[binaryIndexName].values;
    let val = Utils.getIn(
      this.data[dataPosition],
      binaryIndexName,
      usingDotNotation
    );

    // If you are inserting a javascript Date value into a binary index, convert to epoch time
    if (this.serializableIndices === true && val instanceof Date) {
      this.data[dataPosition][binaryIndexName] = val.getTime();
      val = Utils.getIn(this.data[dataPosition], binaryIndexName);
    }

    const idxPos =
      index.length === 0
        ? 0
        : this.calculateRangeStart(
            binaryIndexName,
            val,
            true,
            usingDotNotation
          );

    // insert new data index into our binary index at the proper sorted location for relevant property calculated by idxPos.
    // doing this after adjusting dataPositions so no clash with previous item at that position.
    this.binaryIndices[binaryIndexName].values.splice(idxPos, 0, dataPosition);
  }

  /**
   * Adaptively update a selected item within an index.
   * @param {int} dataPosition : coll.data array index/position
   * @param {string} binaryIndexName : index to search for dataPosition in
   */
  adaptiveBinaryIndexUpdate(dataPosition, binaryIndexName) {
    // linear scan needed to find old position within index unless we optimize for clone scenarios later
    // within (my) node 5.6.0, the following for() loop with strict compare is -much- faster than indexOf()
    let idxPos;

    const index = this.binaryIndices[binaryIndexName].values;
    const len = index.length;

    for (idxPos = 0; idxPos < len; idxPos++) {
      if (index[idxPos] === dataPosition) break;
    }

    //var idxPos = this.binaryIndices[binaryIndexName].values.indexOf(dataPosition);
    this.binaryIndices[binaryIndexName].values.splice(idxPos, 1);

    //this.adaptiveBinaryIndexRemove(dataPosition, binaryIndexName, true);
    this.adaptiveBinaryIndexInsert(dataPosition, binaryIndexName);
  }

  /**
   * Adaptively remove a selected item from the index.
   * @param {number|number[]} dataPosition : coll.data array index/position
   * @param {string} binaryIndexName : index to search for dataPosition in
   */
  adaptiveBinaryIndexRemove(
    dataPosition,
    binaryIndexName,
    removedFromIndexOnly?: boolean
  ) {
    const bi = this.binaryIndices[binaryIndexName];
    let len;
    let idx;
    let rmidx;
    let rmlen;
    const rxo = {};
    let curr;
    let shift;

    if (Array.isArray(dataPosition)) {
      // when called from chained remove, and only one document in array,
      // it will be faster to use old algorithm
      rmlen = dataPosition.length;
      if (rmlen === 1) {
        dataPosition = dataPosition[0];
      }

      // we were passed an array (batch) of documents so use this 'batch optimized' algorithm
      else {
        for (rmidx = 0; rmidx < rmlen; rmidx++) {
          rxo[dataPosition[rmidx]] = true;
        }

        // remove document from index (with filter function)
        bi.values = bi.values.filter((di) => !rxo[di]);

        // if we passed this optional flag parameter, we are calling from adaptiveBinaryIndexUpdate,
        // in which case data positions stay the same.
        if (removedFromIndexOnly === true) {
          return;
        }

        const sortedPositions = dataPosition.slice();
        sortedPositions.sort((a, b) => a - b);

        // to remove holes, we need to 'shift down' the index's data array positions
        // we need to adjust array positions -1 for each index data positions greater than removed positions
        len = bi.values.length;
        for (idx = 0; idx < len; idx++) {
          curr = bi.values[idx];
          shift = 0;
          for (
            rmidx = 0;
            rmidx < rmlen && curr > sortedPositions[rmidx];
            rmidx++
          ) {
            shift++;
          }
          bi.values[idx] -= shift;
        }

        // batch processed, bail out
        return;
      }

      // not a batch so continue...
    }

    const idxPos = this.getBinaryIndexPosition(dataPosition, binaryIndexName);

    if (idxPos === null) {
      // throw new Error('unable to determine binary index position');
      return null;
    }

    // remove document from index (with splice)
    bi.values.splice(idxPos, 1);

    // if we passed this optional flag parameter, we are calling from adaptiveBinaryIndexUpdate,
    // in which case data positions stay the same.
    if (removedFromIndexOnly === true) {
      return;
    }

    // since index stores data array positions, if we remove a document
    // we need to adjust array positions -1 for all document positions greater than removed position
    len = bi.values.length;
    for (idx = 0; idx < len; idx++) {
      if (bi.values[idx] > dataPosition) {
        bi.values[idx]--;
      }
    }
  }

  /**
   * Internal method used for index maintenance and indexed searching.
   * Calculates the beginning of an index range for a given value.
   * For index maintainance (adaptive:true), we will return a valid index position to insert to.
   * For querying (adaptive:false/undefined), we will :
   *    return lower bound/index of range of that value (if found)
   *    return next lower index position if not found (hole)
   * If index is empty it is assumed to be handled at higher level, so
   * this method assumes there is at least 1 document in index.
   *
   * @param {string} prop - name of property which has binary index
   * @param {any} val - value to find within index
   * @param {bool?} adaptive - if true, we will return insert position
   */
  calculateRangeStart(prop, val, adaptive, usingDotNotation) {
    const rcd = this.data;
    const index = this.binaryIndices[prop].values;
    let min = 0;
    let max = index.length - 1;
    let mid = 0;

    if (index.length === 0) {
      return -1;
    }

    // hone in on start position of value
    while (min < max) {
      mid = (min + max) >> 1;

      if (
        Comparators.lt(
          Utils.getIn(rcd[index[mid]], prop, usingDotNotation),
          val,
          false
        )
      ) {
        min = mid + 1;
      } else {
        max = mid;
      }
    }

    const lbound = min;

    // found it... return it
    if (
      Comparators.aeq(
        val,
        Utils.getIn(rcd[index[lbound]], prop, usingDotNotation)
      )
    ) {
      return lbound;
    }

    // if not in index and our value is less than the found one
    if (
      Comparators.lt(
        val,
        Utils.getIn(rcd[index[lbound]], prop, usingDotNotation),
        false
      )
    ) {
      return adaptive ? lbound : lbound - 1;
    }

    // not in index and our value is greater than the found one
    return adaptive ? lbound + 1 : lbound;
  }

  /**
   * Internal method used for indexed $between.  Given a prop (index name), and a value
   * (which may or may not yet exist) this will find the final position of that upper range value.
   */
  calculateRangeEnd(prop, val, usingDotNotation) {
    const rcd = this.data;
    const index = this.binaryIndices[prop].values;
    let min = 0;
    let max = index.length - 1;
    let mid = 0;

    if (index.length === 0) {
      return -1;
    }

    // hone in on start position of value
    while (min < max) {
      mid = (min + max) >> 1;

      if (
        Comparators.lt(
          val,
          Utils.getIn(rcd[index[mid]], prop, usingDotNotation),
          false
        )
      ) {
        max = mid;
      } else {
        min = mid + 1;
      }
    }

    const ubound = max;

    // only eq if last element in array is our val
    if (
      Comparators.aeq(
        val,
        Utils.getIn(rcd[index[ubound]], prop, usingDotNotation)
      )
    ) {
      return ubound;
    }

    // if not in index and our value is less than the found one
    if (
      Comparators.gt(
        val,
        Utils.getIn(rcd[index[ubound]], prop, usingDotNotation),
        false
      )
    ) {
      return ubound + 1;
    }

    // either hole or first nonmatch
    if (
      Comparators.aeq(
        val,
        Utils.getIn(rcd[index[ubound - 1]], prop, usingDotNotation)
      )
    ) {
      return ubound - 1;
    }

    // hole, so ubound if nearest gt than the val we were looking for
    return ubound;
  }

  /**
   * calculateRange() - Binary Search utility method to find range/segment of values matching criteria.
   *    this is used for collection.find() and first find filter of resultset/dynview
   *    slightly different than get() binary search in that get() hones in on 1 value,
   *    but we have to hone in on many (range)
   * @param {string} op - operation, such as $eq
   * @param {string} prop - name of property to calculate range for
   * @param {object} val - value to use for range calculation.
   * @returns {array} [start, end] index array positions
   */
  calculateRange(op, prop, val) {
    const rcd = this.data;
    const index = this.binaryIndices[prop].values;
    const min = 0;
    const max = index.length - 1;
    let lbound;
    let lval;
    let ubound;
    let uval;

    // when no documents are in collection, return empty range condition
    if (rcd.length === 0) {
      return [0, -1];
    }

    const usingDotNotation = prop.includes(".");

    const minVal = Utils.getIn(rcd[index[min]], prop, usingDotNotation);
    const maxVal = Utils.getIn(rcd[index[max]], prop, usingDotNotation);

    // if value falls outside of our range return [0, -1] to designate no results
    switch (op) {
      case "$eq":
      case "$aeq":
        if (
          Comparators.lt(val, minVal, false) ||
          Comparators.gt(val, maxVal, false)
        ) {
          return [0, -1];
        }
        break;
      case "$dteq":
        if (
          Comparators.lt(val, minVal, false) ||
          Comparators.gt(val, maxVal, false)
        ) {
          return [0, -1];
        }
        break;
      case "$gt":
        // none are within range
        if (Comparators.gt(val, maxVal, true)) {
          return [0, -1];
        }
        // all are within range
        if (Comparators.gt(minVal, val, false)) {
          return [min, max];
        }
        break;
      case "$gte":
        // none are within range
        if (Comparators.gt(val, maxVal, false)) {
          return [0, -1];
        }
        // all are within range
        if (Comparators.gt(minVal, val, true)) {
          return [min, max];
        }
        break;
      case "$lt":
        // none are within range
        if (Comparators.lt(val, minVal, true)) {
          return [0, -1];
        }
        // all are within range
        if (Comparators.lt(maxVal, val, false)) {
          return [min, max];
        }
        break;
      case "$lte":
        // none are within range
        if (Comparators.lt(val, minVal, false)) {
          return [0, -1];
        }
        // all are within range
        if (Comparators.lt(maxVal, val, true)) {
          return [min, max];
        }
        break;
      case "$between":
        // none are within range (low range is greater)
        if (Comparators.gt(val[0], maxVal, false)) {
          return [0, -1];
        }
        // none are within range (high range lower)
        if (Comparators.lt(val[1], minVal, false)) {
          return [0, -1];
        }

        lbound = this.calculateRangeStart(
          prop,
          val[0],
          false,
          usingDotNotation
        );
        ubound = this.calculateRangeEnd(prop, val[1], usingDotNotation);

        if (lbound < 0) lbound++;
        if (ubound > max) ubound--;

        if (
          !Comparators.gt(
            Utils.getIn(rcd[index[lbound]], prop, usingDotNotation),
            val[0],
            true
          )
        )
          lbound++;
        if (
          !Comparators.lt(
            Utils.getIn(rcd[index[ubound]], prop, usingDotNotation),
            val[1],
            true
          )
        )
          ubound--;

        if (ubound < lbound) return [0, -1];

        return [lbound, ubound];
      case "$in": {
        const idxset = [];
        const segResult = [];
        // query each value '$eq' operator and merge the seqment results.
        for (let j = 0, len = val.length; j < len; j++) {
          const seg = this.calculateRange("$eq", prop, val[j]);

          for (let i = seg[0]; i <= seg[1]; i++) {
            if (idxset[i] === undefined) {
              idxset[i] = true;
              segResult.push(i);
            }
          }
        }
        return segResult;
      }
    }

    // determine lbound where needed
    switch (op) {
      case "$eq":
      case "$aeq":
      case "$dteq":
      case "$gte":
      case "$lt":
        lbound = this.calculateRangeStart(prop, val, false, usingDotNotation);
        lval = Utils.getIn(rcd[index[lbound]], prop, usingDotNotation);
        break;
      default:
        break;
    }

    // determine ubound where needed
    switch (op) {
      case "$eq":
      case "$aeq":
      case "$dteq":
      case "$lte":
      case "$gt":
        ubound = this.calculateRangeEnd(prop, val, usingDotNotation);
        uval = Utils.getIn(rcd[index[ubound]], prop, usingDotNotation);
        break;
      default:
        break;
    }

    switch (op) {
      case "$eq":
      case "$aeq":
      case "$dteq":
        // if hole (not found)
        if (!Comparators.aeq(lval, val)) {
          return [0, -1];
        }

        return [lbound, ubound];

      case "$gt":
        // if hole (not found) ub position is already greater
        if (
          !Comparators.aeq(
            Utils.getIn(rcd[index[ubound]], prop, usingDotNotation),
            val
          )
        ) {
          return [ubound, max];
        }
        // otherwise (found) so ubound is still equal, get next
        return [ubound + 1, max];

      case "$gte":
        // if hole (not found) lb position marks left outside of range
        if (
          !Comparators.aeq(
            Utils.getIn(rcd[index[lbound]], prop, usingDotNotation),
            val
          )
        ) {
          return [lbound + 1, max];
        }
        // otherwise (found) so lb is first position where its equal
        return [lbound, max];

      case "$lt":
        // if hole (not found) position already is less than
        if (
          !Comparators.aeq(
            Utils.getIn(rcd[index[lbound]], prop, usingDotNotation),
            val
          )
        ) {
          return [min, lbound];
        }
        // otherwise (found) so lb marks left inside of eq range, get previous
        return [min, lbound - 1];

      case "$lte":
        // if hole (not found) ub position marks right outside so get previous
        if (
          !Comparators.aeq(
            Utils.getIn(rcd[index[ubound]], prop, usingDotNotation),
            val
          )
        ) {
          return [min, ubound - 1];
        }
        // otherwise (found) so ub is last position where its still equal
        return [min, ubound];

      default:
        return [0, rcd.length - 1];
    }
  }

  /**
   * Retrieve doc by Unique index
   * @param {string} field - name of uniquely indexed property to use when doing lookup
   * @param {value} value - unique value to search for
   * @returns {object} document matching the value passed
   * @memberof Collection
   */
  by(field, value) {
    let self;
    if (value === undefined) {
      self = this;
      return (value) => self.by(field, value);
    }

    const result = this.getUniqueIndex(field, true).get(value);
    if (!this.cloneObjects) {
      return result;
    } else {
      return clone(result, this.cloneMethod);
    }
  }

  /**
   * Find one object by index property, by property equal to value
   * @param {object} query - query object used to perform search with
   * @returns {(object|null)} First matching document, or null if none
   * @memberof Collection
   */
  findOne(query = {}) {
    // Instantiate Resultset and exec find op passing firstOnly = true param
    const result = this.chain().find(query, true).data();

    if (Array.isArray(result) && result.length === 0) {
      return null;
    } else {
      if (!this.cloneObjects) {
        return result[0];
      } else {
        return clone(result[0], this.cloneMethod);
      }
    }
  }

  /**
   * Chain method, used for beginning a series of chained find() and/or view() operations
   * on a collection.
   *
   * @param {string|array=} transform - named transform or array of transform steps
   * @param {object=} parameters - Object containing properties representing parameters to substitute
   * @returns {Resultset} (this) resultset, or data array if any map or join functions where called
   * @memberof Collection
   */
  chain(transform?: unknown, parameters?: unknown) {
    const rs = new Resultset(this);

    if (typeof transform === "undefined") {
      return rs;
    }

    return rs.transform(transform, parameters);
  }

  /**
   * Find method, api is similar to mongodb.
   * for more complex queries use [chain()]{@link Collection#chain} or [where()]{@link Collection#where}.
   * @example {@tutorial Query Examples}
   * @param {object} query - 'mongo-like' query object
   * @returns {array} Array of matching documents
   * @memberof Collection
   */
  find(query) {
    return this.chain().find(query).data();
  }

  /**
   * Find object by unindexed field by property equal to value,
   * simply iterates and returns the first element matching the query
   */
  findOneUnindexed(prop, value) {
    let i = this.data.length;
    let doc;
    while (i--) {
      if (Utils.getIn(this.data[i], prop, true) === value) {
        doc = this.data[i];
        return doc;
      }
    }
    return null;
  }

  /**
   * Transaction methods
   */
  /** start the transation */
  startTransaction = () => {
    if (this.transactional) {
      this.cachedData = clone(this.data, this.cloneMethod);
      this.cachedIndex = this.idIndex;
      this.cachedBinaryIndex = this.binaryIndices;
      this.cachedDirtyIds = this.dirtyIds;

      // propagate startTransaction to dynamic views
      for (let idx = 0; idx < this.DynamicViews.length; idx++) {
        this.DynamicViews[idx].startTransaction();
      }
    }
  };

  /** commit the transation */
  commit = () => {
    if (this.transactional) {
      this.cachedData = null;
      this.cachedIndex = null;
      this.cachedBinaryIndex = null;
      this.cachedDirtyIds = null;

      // propagate commit to dynamic views
      for (let idx = 0; idx < this.DynamicViews.length; idx++) {
        this.DynamicViews[idx].commit();
      }
    }
  };

  /** roll back the transation */
  rollback = () => {
    if (this.transactional) {
      if (this.cachedData !== null && this.cachedIndex !== null) {
        this.data = this.cachedData;
        this.idIndex = this.cachedIndex;
        this.binaryIndices = this.cachedBinaryIndex;
        this.dirtyIds = this.cachedDirtyIds;
      }

      // propagate rollback to dynamic views
      for (let idx = 0; idx < this.DynamicViews.length; idx++) {
        this.DynamicViews[idx].rollback();
      }
    }
  };

  // async executor. This is only to enable callbacks at the end of the execution.
  async(fun, callback) {
    setTimeout(() => {
      if (typeof fun === "function") {
        fun();
        callback();
      } else {
        throw new TypeError(
          "Argument passed for async execution is not a function"
        );
      }
    }, 0);
  }

  /**
   * Query the collection by supplying a javascript filter function.
   * @example
   * var results = coll.where(function(obj) {
   *   return obj.legs === 8;
   * });
   *
   * @param {function} fun - filter function to run against all collection docs
   * @returns {array} all documents which pass your filter function
   * @memberof Collection
   */
  where(fun) {
    return this.chain().where(fun).data();
  }

  /**
   * Map Reduce operation
   *
   * @param {function} mapFunction - function to use as map function
   * @param {function} reduceFunction - function to use as reduce function
   * @returns {data} The result of your mapReduce operation
   * @memberof Collection
   */
  mapReduce = (mapFunction, reduceFunction) => {
    return reduceFunction(this.data.map(mapFunction));
  };

  /**
   * Join two collections on specified properties
   *
   * @param {array|Resultset|Collection} joinData - array of documents to 'join' to this collection
   * @param {string} leftJoinProp - property name in collection
   * @param {string} rightJoinProp - property name in joinData
   * @param {function=} mapFun - (Optional) map function to use
   * @param {object=} dataOptions - options to data() before input to your map function
   * @param {bool} dataOptions.removeMeta - allows removing meta before calling mapFun
   * @param {boolean} dataOptions.forceClones - forcing the return of cloned objects to your map object
   * @param {string} dataOptions.forceCloneMethod - Allows overriding the default or collection specified cloning method.
   * @returns {Resultset} Result of the mapping operation
   * @memberof Collection
   */
  eqJoin(joinData, leftJoinProp, rightJoinProp, mapFun, dataOptions) {
    // logic in Resultset class
    return new Resultset(this).eqJoin(
      joinData,
      leftJoinProp,
      rightJoinProp,
      mapFun,
      dataOptions
    );
  }

  /**
   * (Staging API) create a stage and/or retrieve it
   * @memberof Collection
   */
  getStage(name) {
    if (!this.stages[name]) {
      this.stages[name] = {};
    }
    return this.stages[name];
  }

  /**
   * (Staging API) create a copy of an object and insert it into a stage
   * @memberof Collection
   */
  stage(stageName, obj) {
    const copy = JSON.parse(JSON.stringify(obj));
    this.getStage(stageName)[obj.$loki] = copy;
    return copy;
  }

  /**
   * (Staging API) re-attach all objects to the original collection, so indexes and views can be rebuilt
   * then create a message to be inserted in the commitlog
   * @param {string} stageName - name of stage
   * @param {string} message
   * @memberof Collection
   */
  commitStage(stageName, message) {
    const stage = this.getStage(stageName);
    let prop;
    const timestamp = new Date().getTime();

    for (prop in stage) {
      this.update(stage[prop]);
      this.commitLog.push({
        timestamp,
        message,
        data: JSON.parse(JSON.stringify(stage[prop])),
      });
    }
    this.stages[stageName] = {};
  }

  /**
   * @memberof Collection
   */
  extract(field) {
    let i = 0;
    const len = this.data.length;
    const isDotNotation = isDeepProperty(field);
    const result = [];
    for (i; i < len; i += 1) {
      result.push(deepProperty(this.data[i], field, isDotNotation));
    }
    return result;
  }

  /**
   * @memberof Collection
   */
  max(field) {
    return Math.max.apply(null, this.extract(field));
  }

  /**
   * @memberof Collection
   */
  min(field) {
    return Math.min.apply(null, this.extract(field));
  }

  /**
   * @memberof Collection
   */
  maxRecord(field) {
    let i = 0;
    const len = this.data.length;
    const deep = isDeepProperty(field);

    const result = {
      index: 0,
      value: undefined,
    };

    let max;

    for (i; i < len; i += 1) {
      if (max !== undefined) {
        if (max < deepProperty(this.data[i], field, deep)) {
          max = deepProperty(this.data[i], field, deep);
          result.index = this.data[i].$loki;
        }
      } else {
        max = deepProperty(this.data[i], field, deep);
        result.index = this.data[i].$loki;
      }
    }
    result.value = max;
    return result;
  }

  /**
   * @memberof Collection
   */
  minRecord(field) {
    let i = 0;
    const len = this.data.length;
    const deep = isDeepProperty(field);

    const result = {
      index: 0,
      value: undefined,
    };

    let min;

    for (i; i < len; i += 1) {
      if (min !== undefined) {
        if (min > deepProperty(this.data[i], field, deep)) {
          min = deepProperty(this.data[i], field, deep);
          result.index = this.data[i].$loki;
        }
      } else {
        min = deepProperty(this.data[i], field, deep);
        result.index = this.data[i].$loki;
      }
    }
    result.value = min;
    return result;
  }

  /**
   * @memberof Collection
   */
  extractNumerical(field) {
    return this.extract(field)
      .map(parseBase10)
      .filter(Number)
      .filter((n) => !isNaN(n));
  }

  /**
   * Calculates the average numerical value of a property
   *
   * @param {string} field - name of property in docs to average
   * @returns {number} average of property in all docs in the collection
   * @memberof Collection
   */
  avg(field) {
    return average(this.extractNumerical(field));
  }

  /**
   * Calculate standard deviation of a field
   * @memberof Collection
   * @param {string} field
   */
  stdDev(field) {
    return standardDeviation(this.extractNumerical(field));
  }

  /**
   * @memberof Collection
   * @param {string} field
   */
  mode(field) {
    const dict = {};
    const data = this.extract(field);
    data.forEach((obj) => {
      if (dict[obj]) {
        dict[obj] += 1;
      } else {
        dict[obj] = 1;
      }
    });
    let max;
    let prop;
    let mode;
    for (prop in dict) {
      if (max) {
        if (max < dict[prop]) {
          mode = prop;
        }
      } else {
        mode = prop;
        max = dict[prop];
      }
    }
    return mode;
  }

  /**
   * @memberof Collection
   * @param {string} field - property name
   */
  median(field) {
    const values = this.extractNumerical(field);
    values.sort(sub);

    const half = Math.floor(values.length / 2);

    if (values.length % 2) {
      return values[half];
    } else {
      return (values[half - 1] + values[half]) / 2.0;
    }
  }
  lokiConsoleWrapper = {
    log(message: string) {},
    warn(message: string) {},
    error(message: string) {},
  };
}

Collection.prototype.contructor = Collection;

/* ------ STAGING API -------- */
/**
 * stages: a map of uniquely identified 'stages', which hold copies of objects to be
 * manipulated without affecting the data in the original collection
 */
Collection.prototype.stages = {};

/**
 * a collection of objects recording the changes applied through a commmitStage
 */
Collection.prototype.commitLog = [];

Collection.prototype.no_op = function () {
  return;
};
