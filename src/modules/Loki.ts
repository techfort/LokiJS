/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-var */
"use strict";

import { LokiFsAdapter } from "./loki-storage-adapter/LokiFsAdapter";
import { Collection } from "./Collection";
import { deepFreeze, freeze, unFreeze } from "../utils/icebox";
import { Utils } from "../utils/index";
import { LokiEventEmitter } from "./LokiEventEmitter";
import { LokiOps } from "../utils/ops";
import { aeqHelper, ltHelper, gtHelper, Comparators } from "../utils/sort";
import { DynamicView } from "./DynamicView";
import { KeyValueStore } from "./KeyValueStore";
import { Resultset } from "./Resultset";
import { LokiLocalStorageAdapter } from "./loki-storage-adapter/LokiLocalStorageAdapter";
import { LokiMemoryAdapter } from "./loki-storage-adapter/LokiMemoryAdapter";
import { LokiPartitioningAdapter } from "./loki-storage-adapter/LokiPartitioningAdapter";
import { LokiPersistenceAdapter } from "./loki-storage-adapter/LokiPersistenceAdapter";

export interface ChangeOps {
  name: string;
  operation: string;
  obj: Obj;
}

export interface Obj {
  name?: string;
  owner?: string;
  maker?: string | { count: number };
  count: number;
  meta: Meta;
  $loki: number;
}

export interface Meta {
  revision: number;
  created: number;
  version: number;
  updated?: number;
}

interface SerializationOptions {
  partitioned: boolean;
  partition: number;
  delimited: boolean;
  delimiter: string;
}

interface LokiConstructorOptions {
  verbose: boolean;
  env: "NATIVESCRIPT" | "NODEJS" | "CORDOVA" | "BROWSER" | "NA";
}

interface LokiConfigOptions {
  adapter: LokiPersistenceAdapter | null;
  autoload: boolean;
  autoloadCallback: (err: any) => void;
  autosave: boolean;
  autosaveCallback: (err?: any) => void;
  autosaveInterval: string | number;
  persistenceMethod: "fs" | "localStorage" | "memory" | null;
  destructureDelimiter: string;
  serializationMethod: "normal" | "pretty" | "destructured" | null;
  throttledSaves: boolean;
}

/**
   * Loki: The main database class
   * @constructor Loki
   * @implements LokiEventEmitter
   * @param {string} filename - name of the file to be saved to
   * @param {object=} options - (Optional) config options object
   * @param {string} options.env - override environment detection as 'NODEJS', 'BROWSER', 'CORDOVA'
   * @param {boolean} [options.verbose=false] - enable console output
   * @param {boolean} [options.autosave=false] - enables autosave
   * @param {int} [options.autosaveInterval=5000] - time interval (in milliseconds) between saves (if dirty)
   * @param {boolean} [options.autoload=false] - enables autoload on loki instantiation
   * @param {function} options.autoloadCallback - user callback called after database load
   * @param {adapter} options.adapter - an instance of a loki persistence adapter
   * @param {string} [options.serializationMethod='normal'] - ['normal', 'pretty', 'destructured']
   * @param {string} options.destructureDelimiter - string delimiter used for destructured serialization
   * @param {boolean} [options.throttledSaves=true] - debounces multiple calls to to saveDatabase reducing number of disk I/O operations
                                              and guaranteeing proper serialization of the calls.
   */
export default class Loki extends LokiEventEmitter {
  filename: any;
  collections: any[];
  databaseVersion: number;
  engineVersion: number;
  autosave: boolean;
  autosaveInterval: number;
  autosaveHandle: any;
  throttledSaves: boolean;
  options?: Partial<LokiConfigOptions & LokiConstructorOptions>;
  persistenceMethod: any;
  persistenceAdapter: any;
  throttledSavePending: boolean;
  throttledCallbacks: any[];
  verbose: any;
  ENV: any;
  isIncremental: boolean;
  name: any;
  ignoreAutosave: boolean;
  static deepFreeze: (obj: object) => void;
  static freeze: (obj: object) => void;
  static unFreeze: (obj: object) => any;
  static LokiOps: {
    $eq: (a: any, b: any) => boolean;
    $aeq: (a: any, b: any) => boolean;
    $ne: (a: any, b: any) => boolean;
    $dteq: (a: any, b: any) => boolean;
    $gt: (a: any, b: any) => any;
    $gte: (a: any, b: any) => any;
    $lt: (a: any, b: any) => any;
    $lte: (a: any, b: any) => any;
    $jgt: (a: any, b: any) => boolean;
    $jgte: (a: any, b: any) => boolean;
    $jlt: (a: any, b: any) => boolean;
    $jlte: (a: any, b: any) => boolean;
    $between: (a: any, vals: any) => any;
    $jbetween: (a: any, vals: any) => boolean;
    $in: (a: any, b: any) => boolean;
    $inSet: (a: any, b: any) => any;
    $nin: (a: any, b: any) => boolean;
    $keyin: (a: any, b: any) => boolean;
    $nkeyin: (a: any, b: any) => boolean;
    $definedin: (a: any, b: any) => boolean;
    $undefinedin: (a: any, b: any) => boolean;
    $regex: (a: any, b: any) => any;
    $containsString: (a: any, b: any) => boolean;
    $containsNone: (a: any, b: any) => boolean;
    $containsAny: (a: any, b: any) => boolean;
    $contains: (a: any, b: any) => boolean;
    $elemMatch: (a: any, b: any) => boolean;
    $type: (a: any, b: any, record: any) => any;
    $finite: (a: any, b: any) => boolean;
    $size: (a: any, b: any, record: any) => any;
    $len: (a: any, b: any, record: any) => any;
    $where: (a: any, b: any) => boolean;
    $not: (a: any, b: any, record: any) => boolean;
    $and: (a: any, b: any, record: any) => boolean;
    $or: (a: any, b: any, record: any) => boolean;
    $exists: (a: any, b: any) => boolean;
  };
  static Collection: typeof Collection;
  static DynamicView: typeof DynamicView;
  static Resultset: typeof Resultset;
  static KeyValueStore: () => void;
  static LokiMemoryAdapter: typeof LokiMemoryAdapter;
  static LokiPartitioningAdapter: (adapter: any, options: any) => void;
  static LokiLocalStorageAdapter: typeof LokiLocalStorageAdapter;
  static LokiFsAdapter: typeof LokiFsAdapter;
  static persistenceAdapters: {
    fs: typeof LokiFsAdapter;
    localStorage: typeof LokiLocalStorageAdapter;
  };
  static aeq: (prop1: any, prop2: any) => boolean;
  static lt: (prop1: any, prop2: any, equal: any) => any;
  static gt: (prop1: any, prop2: any, equal: any) => any;
  static Comparators: {
    aeq: (prop1: any, prop2: any) => boolean;
    lt: (prop1: any, prop2: any, equal: any) => any;
    gt: (prop1: any, prop2: any, equal: any) => any;
  };
  constructor(
    filename?: string,
    options?: Partial<LokiConfigOptions & LokiConstructorOptions>
  ) {
    super();
    this.filename = filename || "loki.db";
    this.collections = [];

    // persist version of code which created the database to the database.
    // could use for upgrade scenarios
    this.databaseVersion = 1.5;
    this.engineVersion = 1.5;

    // autosave support (disabled by default)
    // pass autosave: true, autosaveInterval: 6000 in options to set 6 second autosave
    this.autosave = false;
    this.autosaveInterval = 5000;
    this.autosaveHandle = null;
    this.throttledSaves = true;

    this.options = {};

    // currently keeping persistenceMethod and persistenceAdapter as loki level properties that
    // will not or cannot be deserialized.  You are required to configure persistence every time
    // you instantiate a loki object (or use default environment detection) in order to load the database anyways.
    // persistenceMethod could be 'fs', 'localStorage', or 'adapter'
    // this is optional option param, otherwise environment detection will be used
    // if user passes their own adapter we will force this method to 'adapter' later, so no need to pass method option.
    this.persistenceMethod = null;

    // retain reference to optional (non-serializable) persistenceAdapter 'instance'
    this.persistenceAdapter = null;

    // flags used to throttle saves
    this.throttledSavePending = false;
    this.throttledCallbacks = [];

    // enable console output if verbose flag is set (disabled by default)
    this.verbose =
      options && Object.hasOwn(options, "verbose") ? options.verbose : false;

    this.events = {
      init: [],
      loaded: [],
      flushChanges: [],
      close: [],
      changes: [],
      warning: [],
    };

    const getENV = () => {
      if (
        typeof global !== "undefined" &&
        (global.android || global.NSObject)
      ) {
        // If no adapter assume nativescript which needs adapter to be passed manually
        return "NATIVESCRIPT"; //nativescript
      }

      if (typeof window === "undefined") {
        return "NODEJS";
      }

      if (
        typeof global !== "undefined" &&
        global.window &&
        typeof process !== "undefined"
      ) {
        return "NODEJS"; //node-webkit
      }

      if (typeof document !== "undefined") {
        if (
          !document.URL.includes("http://") &&
          !document.URL.includes("https://")
        ) {
          return "CORDOVA";
        }
        return "BROWSER";
      }
      return "CORDOVA";
    };

    // refactored environment detection due to invalid detection for browser environments.
    // if they do not specify an options.env we want to detect env rather than default to nodejs.
    // currently keeping two properties for similar thing (options.env and options.persistenceMethod)
    //   might want to review whether we can consolidate.
    if (options && Object.hasOwn(options, "env")) {
      this.ENV = options.env;
    } else {
      this.ENV = getENV();
    }

    // not sure if this is necessary now that i have refactored the line above
    if (this.ENV === "undefined") {
      this.ENV = "NODEJS";
    }

    this.configureOptions(options, true);

    this.on("init", this.clearChanges);
  }

  // experimental support for browserify's abstract syntax scan to pick up dependency of indexed adapter.
  // Hopefully, once this hits npm a browserify require of lokijs should scan the main file and detect this indexed adapter reference.
  getIndexedAdapter = () => {
    let adapter;

    if (typeof require === "function") {
      adapter = require("../loki-indexed-adapter.js");
    }

    return adapter;
  };

  /**
   * Allows reconfiguring database options
   *
   * @param {object} options - configuration options to apply to loki db object
   * @param {string} options.env - override environment detection as 'NODEJS', 'BROWSER', 'CORDOVA'
   * @param {boolean} options.verbose - enable console output (default is 'false')
   * @param {boolean} options.autosave - enables autosave
   * @param {int} options.autosaveInterval - time interval (in milliseconds) between saves (if dirty)
   * @param {boolean} options.autoload - enables autoload on loki instantiation
   * @param {function} options.autoloadCallback - user callback called after database load
   * @param {adapter} options.adapter - an instance of a loki persistence adapter
   * @param {string} options.serializationMethod - ['normal', 'pretty', 'destructured']
   * @param {string} options.destructureDelimiter - string delimiter used for destructured serialization
   * @param {boolean} initialConfig - (internal) true is passed when loki ctor is invoking
   * @memberof Loki
   */
  configureOptions = (options, initialConfig) => {
    const defaultPersistence = {
      NODEJS: "fs",
      BROWSER: "localStorage",
      CORDOVA: "localStorage",
      MEMORY: "memory",
    };

    const persistenceMethods = {
      fs: LokiFsAdapter,
      localStorage: LokiLocalStorageAdapter,
      memory: LokiMemoryAdapter,
    };

    this.options = {};

    this.persistenceMethod = null;
    // retain reference to optional persistence adapter 'instance'
    // currently keeping outside options because it can't be serialized
    this.persistenceAdapter = null;

    // process the options
    if (typeof options !== "undefined") {
      this.options = options;

      if (Object.hasOwn(this.options, "persistenceMethod")) {
        // check if the specified persistence method is known
        if (
          typeof persistenceMethods[options.persistenceMethod] == "function"
        ) {
          this.persistenceMethod = options.persistenceMethod;
          this.persistenceAdapter = new persistenceMethods[
            options.persistenceMethod
          ]();
        }
        // should be throw an error here, or just fall back to defaults ??
      }

      // if user passes adapter, set persistence mode to adapter and retain persistence adapter instance
      if (Object.hasOwn(this.options, "adapter")) {
        this.persistenceMethod = "adapter";
        this.persistenceAdapter = options.adapter;
        this.options.adapter = null;

        // if true, will keep track of dirty ids
        this.isIncremental = this.persistenceAdapter.mode === "incremental";
      }

      // if they want to load database on loki instantiation, now is a good time to load... after adapter set and before possible autosave initiation
      if (options.autoload && initialConfig) {
        // for autoload, let the constructor complete before firing callback
        const self = this;
        setTimeout(() => {
          self.loadDatabase(options, options.autoloadCallback);
        }, 1);
      }

      if (Object.hasOwn(this.options, "autosaveInterval")) {
        this.autosaveDisable();
        this.autosaveInterval = parseInt(
          this.options.autosaveInterval as string,
          10
        );
      }

      if (Object.hasOwn(this.options, "autosave") && this.options.autosave) {
        this.autosaveDisable();
        this.autosave = true;

        if (Object.hasOwn(this.options, "autosaveCallback")) {
          this.autosaveEnable(options, options.autosaveCallback);
        } else {
          this.autosaveEnable();
        }
      }

      if (Object.hasOwn(this.options, "throttledSaves")) {
        this.throttledSaves = this.options.throttledSaves;
      }
    } // end of options processing

    // ensure defaults exists for options which were not set
    if (!Object.hasOwn(this.options, "serializationMethod")) {
      this.options.serializationMethod = "normal";
    }

    // ensure passed or default option exists
    if (!Object.hasOwn(this.options, "destructureDelimiter")) {
      this.options.destructureDelimiter = "$<\n";
    }

    // if by now there is no adapter specified by user nor derived from persistenceMethod: use sensible defaults
    if (this.persistenceAdapter === null) {
      this.persistenceMethod = defaultPersistence[this.ENV];
      if (this.persistenceMethod) {
        this.persistenceAdapter = new persistenceMethods[
          this.persistenceMethod
        ]();
      }
    }
  };

  /**
   * Copies 'this' database into a new Loki instance. Object references are shared to make lightweight.
   *
   * @param {object} options - apply or override collection level settings
   * @param {bool} options.removeNonSerializable - nulls properties not safe for serialization.
   * @memberof Loki
   */
  copy = (options) => {
    // in case running in an environment without accurate environment detection, pass 'NA'
    const databaseCopy = new Loki(this.filename, { env: "NA" });
    let clen;
    let idx;

    options = options || {};

    // currently inverting and letting loadJSONObject do most of the work
    databaseCopy.loadJSONObject(this, { retainDirtyFlags: true });

    // since our JSON serializeReplacer is not invoked for reference database adapters, this will let us mimic
    if (
      options.hasOwnProperty("removeNonSerializable") &&
      options.removeNonSerializable === true
    ) {
      databaseCopy.autosaveHandle = null;
      databaseCopy.persistenceAdapter = null;

      clen = databaseCopy.collections.length;
      for (idx = 0; idx < clen; idx++) {
        databaseCopy.collections[idx].constraints = null;
        databaseCopy.collections[idx].ttl = null;
      }
    }

    return databaseCopy;
  };

  /**
   * Adds a collection to the database.
   * @param {string} name - name of collection to add
   * @param {object=} options - (optional) options to configure collection with.
   * @param {array=} [options.unique=[]] - array of property names to define unique constraints for
   * @param {array=} [options.exact=[]] - array of property names to define exact constraints for
   * @param {array=} [options.indices=[]] - array property names to define binary indexes for
   * @param {boolean} [options.asyncListeners=false] - whether listeners are called asynchronously
   * @param {boolean} [options.disableMeta=false] - set to true to disable meta property on documents
   * @param {boolean} [options.disableChangesApi=true] - set to false to enable Changes Api
   * @param {boolean} [options.disableDeltaChangesApi=true] - set to false to enable Delta Changes API (requires Changes API, forces cloning)
   * @param {boolean} [options.autoupdate=false] - use Object.observe to update objects automatically
   * @param {boolean} [options.clone=false] - specify whether inserts and queries clone to/from user
   * @param {string} [options.cloneMethod='parse-stringify'] - 'parse-stringify', 'jquery-extend-deep', 'shallow, 'shallow-assign'
   * @param {int=} options.ttl - age of document (in ms.) before document is considered aged/stale.
   * @param {int=} options.ttlInterval - time interval for clearing out 'aged' documents; not set by default.
   * @returns {Collection} a reference to the collection which was just added
   * @memberof Loki
   */
  addCollection = (name, options?: Record<string, any>) => {
    let i;
    const len = this.collections.length;

    if (options && options.disableMeta === true) {
      if (options.disableChangesApi === false) {
        throw new Error(
          "disableMeta option cannot be passed as true when disableChangesApi is passed as false"
        );
      }
      if (options.disableDeltaChangesApi === false) {
        throw new Error(
          "disableMeta option cannot be passed as true when disableDeltaChangesApi is passed as false"
        );
      }
      if (typeof options.ttl === "number" && options.ttl > 0) {
        throw new Error(
          "disableMeta option cannot be passed as true when ttl is enabled"
        );
      }
    }

    for (i = 0; i < len; i += 1) {
      if (this.collections[i].name === name) {
        return this.collections[i];
      }
    }

    const collection = new Collection(name, options);
    collection.isIncremental = this.isIncremental;
    this.collections.push(collection);

    if (this.verbose) collection.lokiConsoleWrapper = console;

    return collection;
  };

  loadCollection = (collection) => {
    if (!collection.name) {
      throw new Error("Collection must have a name property to be loaded");
    }
    this.collections.push(collection);
  };

  /**
   * Retrieves reference to a collection by name.
   * @param {string} collectionName - name of collection to look up
   * @returns {Collection} Reference to collection in database by that name, or null if not found
   * @memberof Loki
   */
  getCollection = (collectionName) => {
    let i;
    const len = this.collections.length;

    for (i = 0; i < len; i += 1) {
      if (this.collections[i].name === collectionName) {
        return this.collections[i];
      }
    }

    // no such collection
    this.emit("warning", `collection ${collectionName} not found`);
    return null;
  };

  /**
   * Renames an existing loki collection
   * @param {string} oldName - name of collection to rename
   * @param {string} newName - new name of collection
   * @returns {Collection} reference to the newly renamed collection
   * @memberof Loki
   */
  renameCollection = (oldName, newName) => {
    const c = this.getCollection(oldName);

    if (c) {
      c.name = newName;
    }

    return c;
  };

  /**
   * Returns a list of collections in the database.
   * @returns {object[]} array of objects containing 'name', 'type', and 'count' properties.
   * @memberof Loki
   */
  listCollections = () => {
    let i = this.collections.length;
    const colls = [];

    while (i--) {
      colls.push({
        name: this.collections[i].name,
        type: this.collections[i].objType,
        count: this.collections[i].data.length,
      });
    }
    return colls;
  };

  /**
   * Removes a collection from the database.
   * @param {string} collectionName - name of collection to remove
   * @memberof Loki
   */
  removeCollection = (collectionName) => {
    let i;
    const len = this.collections.length;

    for (i = 0; i < len; i += 1) {
      if (this.collections[i].name === collectionName) {
        const tmpcol = new Collection(collectionName, {});
        const curcol = this.collections[i];
        for (const prop in curcol) {
          if (curcol.hasOwnProperty(prop) && tmpcol.hasOwnProperty(prop)) {
            curcol[prop] = tmpcol[prop];
          }
        }
        this.collections.splice(i, 1);
        return;
      }
    }
  };

  getName = () => {
    return this.name;
  };

  /**
   * serializeReplacer - used to prevent certain properties from being serialized
   *
   */
  serializeReplacer = (key, value) => {
    switch (key) {
      case "autosaveHandle":
      case "persistenceAdapter":
      case "constraints":
      case "ttl":
        return null;
      case "throttledSavePending":
      case "throttledCallbacks":
        return undefined;
      case "lokiConsoleWrapper":
        return null;
      default:
        return value;
    }
  };

  /**
   * Serialize database to a string which can be loaded via {@link Loki#loadJSON}
   *
   * @returns {string} Stringified representation of the loki database.
   * @memberof Loki
   */
  serialize = (options: Partial<LokiConfigOptions> = {}) => {
    if (!options.hasOwnProperty("serializationMethod")) {
      options.serializationMethod = this.options.serializationMethod;
    }

    switch (options.serializationMethod) {
      case "normal":
        return JSON.stringify(this, this.serializeReplacer);
      case "pretty":
        return JSON.stringify(this, this.serializeReplacer, 2);
      case "destructured":
        return this.serializeDestructured(); // use default options
      default:
        return JSON.stringify(this, this.serializeReplacer);
    }
  };

  /**
   * Database level destructured JSON serialization routine to allow alternate serialization methods.
   * Internally, Loki supports destructuring via loki "serializationMethod' option and
   * the optional LokiPartitioningAdapter class. It is also available if you wish to do
   * your own structured persistence or data exchange.
   *
   * @param {object=} options - output format options for use externally to loki
   * @param {bool=} options.partitioned - (default: false) whether db and each collection are separate
   * @param {int=} options.partition - can be used to only output an individual collection or db (-1)
   * @param {bool=} options.delimited - (default: true) whether subitems are delimited or subarrays
   * @param {string=} options.delimiter - override default delimiter
   *
   * @returns {string|array} A custom, restructured aggregation of independent serializations.
   * @memberof Loki
   */
  serializeDestructured = (options?: Partial<SerializationOptions>) => {
    let idx;
    let sidx;
    let result;
    let resultlen;
    const reconstruct = [];
    let dbcopy;

    options = options || {};

    if (!options.hasOwnProperty("partitioned")) {
      options.partitioned = false;
    }

    if (!options.hasOwnProperty("delimited")) {
      options.delimited = true;
    }

    if (!options.hasOwnProperty("delimiter")) {
      options.delimiter = this.options.destructureDelimiter;
    }

    // 'partitioned' along with 'partition' of 0 or greater is a request for single collection serialization
    if (
      options.partitioned === true &&
      options.hasOwnProperty("partition") &&
      options.partition >= 0
    ) {
      return this.serializeCollection({
        delimited: options.delimited,
        delimiter: options.delimiter,
        collectionIndex: options.partition,
      });
    }

    // not just an individual collection, so we will need to serialize db container via shallow copy
    dbcopy = new Loki(this.filename);
    dbcopy.loadJSONObject(this);

    for (idx = 0; idx < dbcopy.collections.length; idx++) {
      dbcopy.collections[idx].data = [];
    }

    // if we -only- wanted the db container portion, return it now
    if (options.partitioned === true && options.partition === -1) {
      // since we are deconstructing, override serializationMethod to normal for here
      return dbcopy.serialize({
        serializationMethod: "normal",
      });
    }

    // at this point we must be deconstructing the entire database
    // start by pushing db serialization into first array element
    reconstruct.push(
      dbcopy.serialize({
        serializationMethod: "normal",
      })
    );

    dbcopy = null;

    // push collection data into subsequent elements
    for (idx = 0; idx < this.collections.length; idx++) {
      result = this.serializeCollection({
        delimited: options.delimited,
        delimiter: options.delimiter,
        collectionIndex: idx,
      });

      // NDA : Non-Delimited Array : one iterable concatenated array with empty string collection partitions
      if (options.partitioned === false && options.delimited === false) {
        if (!Array.isArray(result)) {
          throw new Error(
            "a nondelimited, non partitioned collection serialization did not return an expected array"
          );
        }

        // Array.concat would probably duplicate memory overhead for copying strings.
        // Instead copy each individually, and clear old value after each copy.
        // Hopefully this will allow g.c. to reduce memory pressure, if needed.
        resultlen = result.length;

        for (sidx = 0; sidx < resultlen; sidx++) {
          reconstruct.push(result[sidx]);
          result[sidx] = null;
        }

        reconstruct.push("");
      } else {
        reconstruct.push(result);
      }
    }

    // Reconstruct / present results according to four combinations : D, DA, NDA, NDAA
    if (options.partitioned) {
      // DA : Delimited Array of strings [0] db [1] collection [n] collection { partitioned: true, delimited: true }
      // useful for simple future adaptations of existing persistence adapters to save collections separately
      if (options.delimited) {
        return reconstruct;
      }
      // NDAA : Non-Delimited Array with subArrays. db at [0] and collection subarrays at [n] { partitioned: true, delimited : false }
      // This format might be the most versatile for 'rolling your own' partitioned sync or save.
      // Memory overhead can be reduced by specifying a specific partition, but at this code path they did not, so its all.
      else {
        return reconstruct;
      }
    } else {
      // D : one big Delimited string { partitioned: false, delimited : true }
      // This is the method Loki will use internally if 'destructured'.
      // Little memory overhead improvements but does not require multiple asynchronous adapter call scheduling
      if (options.delimited) {
        // indicate no more collections
        reconstruct.push("");

        return reconstruct.join(options.delimiter);
      }
      // NDA : Non-Delimited Array : one iterable array with empty string collection partitions { partitioned: false, delimited: false }
      // This format might be best candidate for custom synchronous syncs or saves
      else {
        // indicate no more collections
        reconstruct.push("");

        return reconstruct;
      }
    }
  };

  /**
   * Collection level utility method to serialize a collection in a 'destructured' format
   *
   * @param {object=} options - used to determine output of method
   * @param {int} options.delimited - whether to return single delimited string or an array
   * @param {string} options.delimiter - (optional) if delimited, this is delimiter to use
   * @param {int} options.collectionIndex -  specify which collection to serialize data for
   *
   * @returns {string|array} A custom, restructured aggregation of independent serializations for a single collection.
   * @memberof Loki
   */
  serializeCollection = (options) => {
    let docidx;
    let resultlines = [];

    options = options || {};

    if (!options.hasOwnProperty("delimited")) {
      options.delimited = true;
    }

    if (!options.hasOwnProperty("collectionIndex")) {
      throw new Error(
        "serializeCollection called without 'collectionIndex' option"
      );
    }

    const doccount = this.collections[options.collectionIndex].data.length;

    resultlines = [];

    for (docidx = 0; docidx < doccount; docidx++) {
      resultlines.push(
        JSON.stringify(this.collections[options.collectionIndex].data[docidx])
      );
    }

    // D and DA
    if (options.delimited) {
      // indicate no more documents in collection (via empty delimited string)
      resultlines.push("");

      return resultlines.join(options.delimiter);
    } else {
      // NDAA and NDA
      return resultlines;
    }
  };

  /**
   * Database level destructured JSON deserialization routine to minimize memory overhead.
   * Internally, Loki supports destructuring via loki "serializationMethod' option and
   * the optional LokiPartitioningAdapter class. It is also available if you wish to do
   * your own structured persistence or data exchange.
   *
   * @param {string|array} destructuredSource - destructured json or array to deserialize from
   * @param {object=} options - source format options
   * @param {bool=} [options.partitioned=false] - whether db and each collection are separate
   * @param {int=} options.partition - can be used to deserialize only a single partition
   * @param {bool=} [options.delimited=true] - whether subitems are delimited or subarrays
   * @param {string=} options.delimiter - override default delimiter
   *
   * @returns {object|array} An object representation of the deserialized database, not yet applied to 'this' db or document array
   * @memberof Loki
   */
  deserializeDestructured = (
    destructuredSource,
    options?: Partial<SerializationOptions>
  ) => {
    let workarray = [];
    let len;
    let cdb;
    let collIndex = 0;
    let collCount;
    let lineIndex = 1;
    let done = false;
    let currLine;
    let currObject;

    options = options || {};

    if (!options.hasOwnProperty("partitioned")) {
      options.partitioned = false;
    }

    if (!options.hasOwnProperty("delimited")) {
      options.delimited = true;
    }

    if (!options.hasOwnProperty("delimiter")) {
      options.delimiter = this.options.destructureDelimiter;
    }

    // Partitioned
    // DA : Delimited Array of strings [0] db [1] collection [n] collection { partitioned: true, delimited: true }
    // NDAA : Non-Delimited Array with subArrays. db at [0] and collection subarrays at [n] { partitioned: true, delimited : false }
    // -or- single partition
    if (options.partitioned) {
      // handle single partition
      if (options.hasOwnProperty("partition")) {
        // db only
        if (options.partition === -1) {
          cdb = JSON.parse(destructuredSource[0]);

          return cdb;
        }

        // single collection, return doc array
        return this.deserializeCollection(
          destructuredSource[options.partition + 1],
          options
        );
      }

      // Otherwise we are restoring an entire partitioned db
      cdb = JSON.parse(destructuredSource[0]);
      collCount = cdb.collections.length;
      for (collIndex = 0; collIndex < collCount; collIndex++) {
        // attach each collection docarray to container collection data, add 1 to collection array index since db is at 0
        cdb.collections[collIndex].data = this.deserializeCollection(
          destructuredSource[collIndex + 1],
          options
        );
      }

      return cdb;
    }

    // Non-Partitioned
    // D : one big Delimited string { partitioned: false, delimited : true }
    // NDA : Non-Delimited Array : one iterable array with empty string collection partitions { partitioned: false, delimited: false }

    // D
    if (options.delimited) {
      workarray = destructuredSource.split(options.delimiter);
      destructuredSource = null; // lower memory pressure
      len = workarray.length;

      if (len === 0) {
        return null;
      }
    }
    // NDA
    else {
      workarray = destructuredSource;
    }

    // first line is database and collection shells
    cdb = JSON.parse(workarray[0]);
    collCount = cdb.collections.length;
    workarray[0] = null;

    while (!done) {
      currLine = workarray[lineIndex];

      // empty string indicates either end of collection or end of file
      if (workarray[lineIndex] === "") {
        // if no more collections to load into, we are done
        if (++collIndex > collCount) {
          done = true;
        }
      } else {
        currObject = JSON.parse(workarray[lineIndex]);
        cdb.collections[collIndex].data.push(currObject);
      }

      // lower memory pressure and advance iterator
      workarray[lineIndex++] = null;
    }

    return cdb;
  };

  /**
   * Collection level utility function to deserializes a destructured collection.
   *
   * @param {string|array} destructuredSource - destructured representation of collection to inflate
   * @param {object=} options - used to describe format of destructuredSource input
   * @param {int=} [options.delimited=false] - whether source is delimited string or an array
   * @param {string=} options.delimiter - if delimited, this is delimiter to use (if other than default)
   *
   * @returns {array} an array of documents to attach to collection.data.
   * @memberof Loki
   */
  deserializeCollection = (
    destructuredSource,
    options?: Partial<{
      partitioned: boolean;
      delimited: boolean;
      delimiter: string;
    }>
  ) => {
    let workarray = [];
    let idx;

    options = options || {};

    if (!options.hasOwnProperty("partitioned")) {
      options.partitioned = false;
    }

    if (!options.hasOwnProperty("delimited")) {
      options.delimited = true;
    }

    if (!options.hasOwnProperty("delimiter")) {
      options.delimiter = this.options.destructureDelimiter;
    }

    if (options.delimited) {
      workarray = destructuredSource.split(options.delimiter);
      workarray.pop();
    } else {
      workarray = destructuredSource;
    }

    const len = workarray.length;
    for (idx = 0; idx < len; idx++) {
      workarray[idx] = JSON.parse(workarray[idx]);
    }

    return workarray;
  };

  /**
   * Inflates a loki database from a serialized JSON string
   *
   * @param {string} serializedDb - a serialized loki database string
   * @param {object=} options - apply or override collection level settings
   * @param {bool} options.retainDirtyFlags - whether collection dirty flags will be preserved
   * @memberof Loki
   */
  loadJSON = (serializedDb, options?: { retainDirtyFlags: boolean }) => {
    let dbObject;
    if (serializedDb.length === 0) {
      dbObject = {};
    } else {
      // using option defined in instantiated db not what was in serialized db
      switch (this.options.serializationMethod) {
        case "normal":
        case "pretty":
          dbObject = JSON.parse(serializedDb);
          break;
        case "destructured":
          dbObject = this.deserializeDestructured(serializedDb);
          break;
        default:
          dbObject = JSON.parse(serializedDb);
          break;
      }
    }

    this.loadJSONObject(dbObject, options);
  };

  /**
   * Inflates a loki database from a JS object
   *
   * @param {object} dbObject - a serialized loki database string
   * @param {object=} options - apply or override collection level settings
   * @param {bool} options.retainDirtyFlags - whether collection dirty flags will be preserved
   * @memberof Loki
   */
  loadJSONObject = (dbObject, options) => {
    let i = 0;
    const len = dbObject.collections ? dbObject.collections.length : 0;
    let coll;
    let copyColl;
    let clen;
    let j;
    let loader;
    let collObj;

    this.name = dbObject.name;

    // restore save throttled boolean only if not defined in options
    if (
      dbObject.hasOwnProperty("throttledSaves") &&
      options &&
      !options.hasOwnProperty("throttledSaves")
    ) {
      this.throttledSaves = dbObject.throttledSaves;
    }

    this.collections = [];

    function makeLoader({ name }) {
      const collOptions = options[name];
      let inflater;

      if (collOptions.proto) {
        inflater = collOptions.inflate || Utils.copyProperties;

        return (data) => {
          const collObj = new collOptions.proto();
          inflater(data, collObj);
          return collObj;
        };
      }

      return collOptions.inflate;
    }

    for (i; i < len; i += 1) {
      coll = dbObject.collections[i];

      copyColl = this.addCollection(coll.name, {
        disableChangesApi: coll.disableChangesApi,
        disableDeltaChangesApi: coll.disableDeltaChangesApi,
        disableMeta: coll.disableMeta,
        disableFreeze: coll.hasOwnProperty("disableFreeze")
          ? coll.disableFreeze
          : true,
      });

      copyColl.adaptiveBinaryIndices = coll.hasOwnProperty(
        "adaptiveBinaryIndices"
      )
        ? coll.adaptiveBinaryIndices === true
        : false;
      copyColl.transactional = coll.transactional;
      copyColl.asyncListeners = coll.asyncListeners;
      copyColl.cloneObjects = coll.cloneObjects;
      copyColl.cloneMethod = coll.cloneMethod || "parse-stringify";
      copyColl.autoupdate = coll.autoupdate;
      copyColl.changes = coll.changes;
      copyColl.dirtyIds = coll.dirtyIds || [];

      if (options && options.retainDirtyFlags === true) {
        copyColl.dirty = coll.dirty;
      } else {
        copyColl.dirty = false;
      }

      if (coll.getData) {
        if (
          (options && options.hasOwnProperty(coll.name)) ||
          !copyColl.disableFreeze ||
          copyColl.autoupdate
        ) {
          throw new Error(
            `this collection cannot be loaded lazily: ${coll.name}`
          );
        }
        copyColl.getData = coll.getData;
        Object.defineProperty(copyColl, "data", {
          /* jshint loopfunc:true */
          get() {
            const data = this.getData();
            this.getData = null;
            Object.defineProperty(this, "data", { value: data });
            return data;
          },
          /* jshint loopfunc:false */
        });
      } else {
        // load each element individually
        clen = coll.data.length;
        j = 0;
        if (options && options.hasOwnProperty(coll.name)) {
          loader = makeLoader(coll);

          for (j; j < clen; j++) {
            collObj = loader(coll.data[j]);
            copyColl.data[j] = collObj;
            copyColl.addAutoUpdateObserver(collObj);
            if (!copyColl.disableFreeze) {
              deepFreeze(copyColl.data[j]);
            }
          }
        } else {
          for (j; j < clen; j++) {
            copyColl.data[j] = coll.data[j];
            copyColl.addAutoUpdateObserver(copyColl.data[j]);
            if (!copyColl.disableFreeze) {
              deepFreeze(copyColl.data[j]);
            }
          }
        }
      }

      copyColl.maxId = typeof coll.maxId === "undefined" ? 0 : coll.maxId;
      if (typeof coll.binaryIndices !== "undefined") {
        copyColl.binaryIndices = coll.binaryIndices;
      }
      if (typeof coll.transforms !== "undefined") {
        copyColl.transforms = coll.transforms;
      }

      // regenerate unique indexes
      copyColl.uniqueNames = [];
      if (coll.hasOwnProperty("uniqueNames")) {
        copyColl.uniqueNames = coll.uniqueNames;
      }

      // in case they are loading a database created before we added dynamic views, handle undefined
      if (typeof coll.DynamicViews === "undefined") continue;

      // reinflate DynamicViews and attached Resultsets
      for (let idx = 0; idx < coll.DynamicViews.length; idx++) {
        const colldv = coll.DynamicViews[idx];

        const dv = copyColl.addDynamicView(colldv.name, colldv.options);
        dv.resultdata = colldv.resultdata;
        dv.resultsdirty = colldv.resultsdirty;
        dv.filterPipeline = colldv.filterPipeline;
        dv.sortCriteriaSimple = colldv.sortCriteriaSimple;
        dv.sortCriteria = colldv.sortCriteria;
        dv.sortFunction = null;
        dv.sortDirty = colldv.sortDirty;
        if (!copyColl.disableFreeze) {
          deepFreeze(dv.filterPipeline);
          if (dv.sortCriteriaSimple) {
            deepFreeze(dv.sortCriteriaSimple);
          } else if (dv.sortCriteria) {
            deepFreeze(dv.sortCriteria);
          }
        }
        dv.resultset.filteredrows = colldv.resultset.filteredrows;
        dv.resultset.filterInitialized = colldv.resultset.filterInitialized;

        dv.rematerialize({
          removeWhereFilters: true,
        });
      }

      // Upgrade Logic for binary index refactoring at version 1.5
      if (dbObject.databaseVersion < 1.5) {
        // rebuild all indices
        copyColl.ensureAllIndexes(true);
        copyColl.dirty = true;
      }
    }
  };

  /**
   * Emits the close event. In autosave scenarios, if the database is dirty, this will save and disable timer.
   * Does not actually destroy the db.
   *
   * @param {function=} callback - (Optional) if supplied will be registered with close event before emitting.
   * @memberof Loki
   */
  close = (callback) => {
    // for autosave scenarios, we will let close perform final save (if dirty)
    // For web use, you might call from window.onbeforeunload to shutdown database, saving pending changes
    if (this.autosave) {
      this.autosaveDisable();
      if (this.autosaveDirty()) {
        this.saveDatabase(callback);
        callback = undefined;
      }
    }

    if (callback) {
      this.on("close", callback);
    }
    this.emit("close");
  };

  /**-------------------------+
  | Changes API               |
  +--------------------------*/

  /**
   * The Changes API enables the tracking the changes occurred in the collections since the beginning of the session,
   * so it's possible to create a differential dataset for synchronization purposes (possibly to a remote db)
   */

  /**
   * (Changes API) : takes all the changes stored in each
   * collection and creates a single array for the entire database. If an array of names
   * of collections is passed then only the included collections will be tracked.
   *
   * @param {array=} optional array of collection names. No arg means all collections are processed.
   * @returns {array} array of changes
   * @see private method createChange() in Collection
   * @memberof Loki
   */
  generateChangesNotification = (
    arrayOfCollectionNames?: string[]
  ): ChangeOps[] => {
    function getCollName({ name }) {
      return name;
    }
    let changes = [];

    const selectedCollections =
      arrayOfCollectionNames || this.collections.map(getCollName);

    this.collections.forEach((coll) => {
      if (selectedCollections.includes(getCollName(coll))) {
        changes = changes.concat(coll.getChanges());
      }
    });
    return changes;
  };

  /**
   * (Changes API) - stringify changes for network transmission
   * @returns {string} string representation of the changes
   * @memberof Loki
   */
  serializeChanges = (collectionNamesArray): string => {
    return JSON.stringify(
      this.generateChangesNotification(collectionNamesArray)
    );
  };

  /**
   * (Changes API) - deserialize a serialized changes array
   * @returns {ChangeOps[]} string representation of the changes
   * @memberof Loki
   */
  deserializeChanges = (collectionString): ChangeOps[] => {
    return JSON.parse(collectionString);
  };

  /**
   * (Changes API) : clears all the changes in all collections.
   * @memberof Loki
   */
  clearChanges = () => {
    this.collections.forEach((coll) => {
      if (coll.flushChanges) {
        coll.flushChanges();
      }
    });
  };

  /**
   * Wait for throttledSaves to complete and invoke your callback when drained or duration is met.
   *
   * @param {function} callback - callback to fire when save queue is drained, it is passed a sucess parameter value
   * @param {object=} options - configuration options
   * @param {boolean} options.recursiveWait - (default: true) if after queue is drained, another save was kicked off, wait for it
   * @param {bool} options.recursiveWaitLimit - (default: false) limit our recursive waiting to a duration
   * @param {int} options.recursiveWaitLimitDelay - (default: 2000) cutoff in ms to stop recursively re-draining
   * @memberof Loki
   */
  throttledSaveDrain = (callback, options) => {
    const self = this;
    const now = new Date().getTime();

    if (!this.throttledSaves) {
      callback(true);
    }

    options = options || {};
    if (!options.hasOwnProperty("recursiveWait")) {
      options.recursiveWait = true;
    }
    if (!options.hasOwnProperty("recursiveWaitLimit")) {
      options.recursiveWaitLimit = false;
    }
    if (!options.hasOwnProperty("recursiveWaitLimitDuration")) {
      options.recursiveWaitLimitDuration = 2000;
    }
    if (!options.hasOwnProperty("started")) {
      options.started = new Date().getTime();
    }

    // if save is pending
    if (this.throttledSaves && this.throttledSavePending) {
      // if we want to wait until we are in a state where there are no pending saves at all
      if (options.recursiveWait) {
        // queue the following meta callback for when it completes
        this.throttledCallbacks.push(() => {
          // if there is now another save pending...
          if (self.throttledSavePending) {
            // if we wish to wait only so long and we have exceeded limit of our waiting, callback with false success value
            if (
              options.recursiveWaitLimit &&
              now - options.started > options.recursiveWaitLimitDuration
            ) {
              callback(false);
              return;
            }
            // it must be ok to wait on next queue drain
            self.throttledSaveDrain(callback, options);
            return;
          }
          // no pending saves so callback with true success
          else {
            callback(true);
            return;
          }
        });
      }
      // just notify when current queue is depleted
      else {
        this.throttledCallbacks.push(callback);
        return;
      }
    }
    // no save pending, just callback
    else {
      callback(true);
    }
  };

  /**
   * Internal load logic, decoupled from throttling/contention logic
   *
   * @param {object} options - not currently used (remove or allow overrides?)
   * @param {function=} callback - (Optional) user supplied async callback / error handler
   */
  loadDatabaseInternal = (options, callback) => {
    const cFun =
      callback ||
      ((err) => {
        if (err) {
          throw err;
        }
      });

    const self = this;

    // the persistenceAdapter should be present if all is ok, but check to be sure.
    if (this.persistenceAdapter !== null) {
      this.persistenceAdapter.loadDatabase(
        this.filename,
        function loadDatabaseCallback(dbString) {
          if (typeof dbString === "string") {
            let parseSuccess = false;
            try {
              self.loadJSON(dbString, options || {});
              parseSuccess = true;
            } catch (err) {
              cFun(err);
            }
            if (parseSuccess) {
              cFun(null);
              self.emit("loaded", `database ${self.filename} loaded`);
            }
          } else {
            // falsy result means new database
            if (!dbString) {
              cFun(null);
              self.emit("loaded", `empty database ${self.filename} loaded`);
              return;
            }

            // instanceof error means load faulted
            if (dbString instanceof Error) {
              cFun(dbString);
              return;
            }

            // if adapter has returned an js object (other than null or error) attempt to load from JSON object
            if (typeof dbString === "object") {
              self.loadJSONObject(dbString, options || {});
              cFun(null); // return null on success
              self.emit("loaded", `database ${self.filename} loaded`);
              return;
            }

            cFun(`unexpected adapter response : ${dbString}`);
          }
        }
      );
    } else {
      cFun(new Error("persistenceAdapter not configured"));
    }
  };

  /**
   * Handles manually loading from file system, local storage, or adapter (such as indexeddb)
   *    This method utilizes loki configuration options (if provided) to determine which
   *    persistence method to use, or environment detection (if configuration was not provided).
   *    To avoid contention with any throttledSaves, we will drain the save queue first.
   *
   * If you are configured with autosave, you do not need to call this method yourself.
   *
   * @param {object} options - if throttling saves and loads, this controls how we drain save queue before loading
   * @param {boolean} options.recursiveWait - (default: true) wait recursively until no saves are queued
   * @param {bool} options.recursiveWaitLimit - (default: false) limit our recursive waiting to a duration
   * @param {int} options.recursiveWaitLimitDelay - (default: 2000) cutoff in ms to stop recursively re-draining
   * @param {function=} callback - (Optional) user supplied async callback / error handler
   * @memberof Loki
   * @example
   * db.loadDatabase({}, function(err) {
   *   if (err) {
   *     console.log("error : " + err);
   *   }
   *   else {
   *     console.log("database loaded.");
   *   }
   * });
   */
  loadDatabase = (options, callback) => {
    const self = this;

    // if throttling disabled, just call internal
    if (!this.throttledSaves) {
      this.loadDatabaseInternal(options, callback);
      return;
    }

    // try to drain any pending saves in the queue to lock it for loading
    this.throttledSaveDrain((success) => {
      if (success) {
        // pause/throttle saving until loading is done
        self.throttledSavePending = true;

        self.loadDatabaseInternal(options, (err) => {
          // now that we are finished loading, if no saves were throttled, disable flag
          if (self.throttledCallbacks.length === 0) {
            self.throttledSavePending = false;
          }
          // if saves requests came in while loading, kick off new save to kick off resume saves
          else {
            self.saveDatabase();
          }

          if (typeof callback === "function") {
            callback(err);
          }
        });
        return;
      } else {
        if (typeof callback === "function") {
          callback(
            new Error(
              "Unable to pause save throttling long enough to read database"
            )
          );
        }
      }
    }, options);
  };

  /**
   * Internal save logic, decoupled from save throttling logic
   */
  saveDatabaseInternal = (callback) => {
    const cFun =
      callback ||
      ((err) => {
        if (err) {
          throw err;
        }
        return;
      });
    const self = this;

    // the persistenceAdapter should be present if all is ok, but check to be sure.
    if (!this.persistenceAdapter) {
      cFun(new Error("persistenceAdapter not configured"));
      return;
    }

    // run incremental, reference, or normal mode adapters, depending on what's available
    if (this.persistenceAdapter.mode === "incremental") {
      let cachedDirty;
      // ignore autosave until we copy loki (only then we can clear dirty flags,
      // but if we don't do it now, autosave will be triggered a lot unnecessarily)
      this.ignoreAutosave = true;
      this.persistenceAdapter.saveDatabase(
        this.filename,
        function getLokiCopy() {
          self.ignoreAutosave = false;
          if (cachedDirty) {
            cFun(
              new Error("adapter error - getLokiCopy called more than once")
            );
            return;
          }
          const lokiCopy = self.copy({ removeNonSerializable: true });

          // remember and clear dirty ids -- we must do it before the save so that if
          // and update occurs between here and callback, it will get saved later
          cachedDirty = self.collections.map(({ dirty, dirtyIds }) => [
            dirty,
            dirtyIds,
          ]);
          self.collections.forEach((col) => {
            col.dirty = false;
            col.dirtyIds = [];
          });
          return lokiCopy;
        },
        function exportDatabaseCallback(err) {
          self.ignoreAutosave = false;
          if (err && cachedDirty) {
            // roll back dirty IDs to be saved later
            self.collections.forEach((col, i) => {
              const cached = cachedDirty[i];
              col.dirty = col.dirty || cached[0];
              col.dirtyIds = col.dirtyIds.concat(cached[1]);
            });
          }
          cFun(err);
        }
      );
    } else if (
      this.persistenceAdapter.mode === "reference" &&
      typeof this.persistenceAdapter.exportDatabase === "function"
    ) {
      // TODO: dirty should be cleared here
      // filename may seem redundant but loadDatabase will need to expect this same filename
      this.persistenceAdapter.exportDatabase(
        this.filename,
        this.copy({ removeNonSerializable: true }),
        function exportDatabaseCallback(err) {
          self.autosaveClearFlags();
          cFun(err);
        }
      );
    }
    // otherwise just pass the serialized database to adapter
    else {
      // persistenceAdapter might be asynchronous, so we must clear `dirty` immediately
      // or autosave won't work if an update occurs between here and the callback
      // TODO: This should be stored and rolled back in case of DB save failure
      this.autosaveClearFlags();
      this.persistenceAdapter.saveDatabase(
        this.filename,
        this.serialize(),
        function saveDatabasecallback(err) {
          cFun(err);
        }
      );
    }
  };

  /**
   * Handles manually saving to file system, local storage, or adapter (such as indexeddb)
   *    This method utilizes loki configuration options (if provided) to determine which
   *    persistence method to use, or environment detection (if configuration was not provided).
   *
   * If you are configured with autosave, you do not need to call this method yourself.
   *
   * @param {function=} callback - (Optional) user supplied async callback / error handler
   * @memberof Loki
   * @example
   * db.saveDatabase(function(err) {
   *   if (err) {
   *     console.log("error : " + err);
   *   }
   *   else {
   *     console.log("database saved.");
   *   }
   * });
   */
  saveDatabase = (callback?: () => any) => {
    if (!this.throttledSaves) {
      this.saveDatabaseInternal(callback);
      return;
    }

    if (this.throttledSavePending) {
      this.throttledCallbacks.push(callback);
      return;
    }

    const localCallbacks = this.throttledCallbacks;
    this.throttledCallbacks = [];
    localCallbacks.unshift(callback);
    this.throttledSavePending = true;

    const self = this;
    this.saveDatabaseInternal((err) => {
      self.throttledSavePending = false;
      localCallbacks.forEach((pcb) => {
        if (typeof pcb === "function") {
          // Queue the callbacks so we first finish this method execution
          setTimeout(() => {
            pcb(err);
          }, 1);
        }
      });

      // since this is called async, future requests may have come in, if so.. kick off next save
      if (self.throttledCallbacks.length > 0) {
        self.saveDatabase();
      }
    });
  };

  /**
   * Handles deleting a database from file system, local
   *    storage, or adapter (indexeddb)
   *    This method utilizes loki configuration options (if provided) to determine which
   *    persistence method to use, or environment detection (if configuration was not provided).
   *
   * @param {function=} callback - (Optional) user supplied async callback / error handler
   * @memberof Loki
   */
  deleteDatabase = (options, callback) => {
    let cFun =
      callback ||
      ((err) => {
        if (err) {
          throw err;
        }
      });

    // we aren't even using options, so we will support syntax where
    // callback is passed as first and only argument
    if (typeof options === "function" && !callback) {
      cFun = options;
    }

    // the persistenceAdapter should be present if all is ok, but check to be sure.
    if (this.persistenceAdapter !== null) {
      this.persistenceAdapter.deleteDatabase(
        this.filename,
        function deleteDatabaseCallback(err) {
          cFun(err);
        }
      );
    } else {
      cFun(new Error("persistenceAdapter not configured"));
    }
  };

  /**
   * autosaveDirty - check whether any collections are 'dirty' meaning we need to save (entire) database
   *
   * @returns {boolean} - true if database has changed since last autosave, false if not.
   */
  autosaveDirty = () => {
    for (let idx = 0; idx < this.collections.length; idx++) {
      if (this.collections[idx].dirty) {
        return true;
      }
    }

    return false;
  };

  /**
   * autosaveClearFlags - resets dirty flags on all collections.
   *    Called from saveDatabase() after db is saved.
   *
   */
  autosaveClearFlags = () => {
    for (let idx = 0; idx < this.collections.length; idx++) {
      this.collections[idx].dirty = false;
    }
  };

  /**
   * autosaveEnable - begin a javascript interval to periodically save the database.
   *
   * @param {object} options - not currently used (remove or allow overrides?)
   * @param {function=} callback - (Optional) user supplied async callback
   */
  autosaveEnable = (options?: {}, callback?: () => any) => {
    this.autosave = true;

    let delay = 5000;
    const self = this;

    if (
      typeof this.autosaveInterval !== "undefined" &&
      this.autosaveInterval !== null
    ) {
      delay = this.autosaveInterval;
    }

    this.autosaveHandle = setInterval(function autosaveHandleInterval() {
      // use of dirty flag will need to be hierarchical since mods are done at collection level with no visibility of 'db'
      // so next step will be to implement collection level dirty flags set on insert/update/remove
      // along with loki level isdirty() function which iterates all collections to see if any are dirty

      if (self.autosaveDirty() && !self.ignoreAutosave) {
        self.saveDatabase(callback);
      }
    }, delay);
  };

  /**
   * autosaveDisable - stop the autosave interval timer.
   *
   */
  autosaveDisable = () => {
    if (
      typeof this.autosaveHandle !== "undefined" &&
      this.autosaveHandle !== null
    ) {
      clearInterval(this.autosaveHandle);
      this.autosaveHandle = null;
    }
  };
}

// alias of serialize
Loki.prototype.toJson = Loki.prototype.serialize;

// alias
Loki.prototype.save = Loki.prototype.saveDatabase;

Loki.deepFreeze = deepFreeze;
Loki.freeze = freeze;
Loki.unFreeze = unFreeze;
Loki.LokiOps = LokiOps;
Loki.Collection = Collection;
Loki.DynamicView = DynamicView;
Loki.Resultset = Resultset;
Loki.KeyValueStore = KeyValueStore;
Loki.LokiMemoryAdapter = LokiMemoryAdapter;
Loki.LokiPartitioningAdapter = LokiPartitioningAdapter;
Loki.LokiLocalStorageAdapter = LokiLocalStorageAdapter;
Loki.LokiFsAdapter = LokiFsAdapter;
Loki.persistenceAdapters = {
  fs: LokiFsAdapter,
  localStorage: LokiLocalStorageAdapter,
};
Loki.aeq = aeqHelper;
Loki.lt = ltHelper;
Loki.gt = gtHelper;
Loki.Comparators = Comparators;
