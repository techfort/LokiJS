import { LokiFsAdapter } from "./loki-storage-adapter/LokiFsAdapter";
import { Collection } from "./Collection";
import { LokiEventEmitter } from "./LokiEventEmitter";
import { DynamicView } from "./DynamicView";
import { Resultset } from "./Resultset";
import { LokiLocalStorageAdapter } from "./loki-storage-adapter/LokiLocalStorageAdapter";
import { LokiMemoryAdapter } from "./loki-storage-adapter/LokiMemoryAdapter";
import { LokiPartitioningAdapterOptions } from "./loki-storage-adapter/LokiPartitioningAdapter";
import { LokiPersistenceAdapter } from "./loki-storage-adapter/LokiPersistenceAdapter";
export type ChangeOpsLoadJSONUsersOptions = {
    inflate: ((src: any) => ChangeOpsLoadJSONOptionsMeta) | ((src: any, dest: ChangeOpsLoadJSONOptionsMeta) => void);
    proto: (n: any) => void;
};
export interface ChangeOpsLoadJSONOptionsMeta {
    $loki: any;
    meta: any;
    onlyInflater: any;
    customInflater: boolean;
}
export interface ChangeOpsLoadJSONOptions extends ChangeOpsLoadJSONOptionsMeta {
    retainDirtyFlags: boolean;
    users: Partial<ChangeOpsLoadJSONUsersOptions>;
}
export interface ChangeOps {
    name: string;
    operation: string;
    obj: Obj;
}
export interface Obj {
    name?: string;
    owner?: string;
    maker?: string | {
        count: number;
    };
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
    collections: Collection<any | {
        $loki: number;
    }>[];
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
    static LokiPartitioningAdapter: (adapter: any, options?: Partial<LokiPartitioningAdapterOptions>) => void;
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
    constructor(filename?: string, options?: Partial<LokiConfigOptions & LokiConstructorOptions>);
    getIndexedAdapter: () => any;
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
    configureOptions: (options: any, initialConfig: any) => void;
    /**
     * Copies 'this' database into a new Loki instance. Object references are shared to make lightweight.
     *
     * @param {object} options - apply or override collection level settings
     * @param {bool} options.removeNonSerializable - nulls properties not safe for serialization.
     * @memberof Loki
     */
    copy: (options?: {
        removeNonSerializable?: boolean;
    }) => Loki;
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
    addCollection: <T extends {
        $loki: number;
    }>(name: any, options?: Record<string, any>) => any;
    loadCollection: (collection: any) => void;
    /**
     * Retrieves reference to a collection by name.
     * @param {string} collectionName - name of collection to look up
     * @returns {Collection} Reference to collection in database by that name, or null if not found
     * @memberof Loki
     */
    getCollection: (collectionName: any) => Collection<any>;
    /**
     * Renames an existing loki collection
     * @param {string} oldName - name of collection to rename
     * @param {string} newName - new name of collection
     * @returns {Collection} reference to the newly renamed collection
     * @memberof Loki
     */
    renameCollection: (oldName: any, newName: any) => Collection<any>;
    /**
     * Returns a list of collections in the database.
     * @returns {object[]} array of objects containing 'name', 'type', and 'count' properties.
     * @memberof Loki
     */
    listCollections: () => any[];
    /**
     * Removes a collection from the database.
     * @param {string} collectionName - name of collection to remove
     * @memberof Loki
     */
    removeCollection: (collectionName: any) => void;
    getName: () => any;
    /**
     * serializeReplacer - used to prevent certain properties from being serialized
     *
     */
    serializeReplacer: (key: any, value: any) => any;
    /**
     * Serialize database to a string which can be loaded via {@link Loki#loadJSON}
     *
     * @returns {string} Stringified representation of the loki database.
     * @memberof Loki
     */
    serialize: (options?: Partial<LokiConfigOptions>) => any;
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
    serializeDestructured: (options?: Partial<SerializationOptions>) => any;
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
    serializeCollection: (options: any) => string | any[];
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
    deserializeDestructured: (destructuredSource: any, options?: Partial<SerializationOptions>) => any;
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
    deserializeCollection: (destructuredSource: any, options?: Partial<{
        partitioned: boolean;
        delimited: boolean;
        delimiter: string;
    }>) => any[];
    /**
     * Inflates a loki database from a serialized JSON string
     *
     * @param {string} serializedDb - a serialized loki database string
     * @param {object=} options - apply or override collection level settings
     * @param {bool} options.retainDirtyFlags - whether collection dirty flags will be preserved
     * @memberof Loki
     */
    loadJSON: (serializedDb: any, options?: Partial<ChangeOpsLoadJSONOptions>) => void;
    /**
     * Inflates a loki database from a JS object
     *
     * @param {object} dbObject - a serialized loki database string
     * @param {object=} options - apply or override collection level settings
     * @param {bool} options.retainDirtyFlags - whether collection dirty flags will be preserved
     * @memberof Loki
     */
    loadJSONObject: (dbObject: any, options?: {
        throttledSaves?: boolean;
        retainDirtyFlags?: boolean;
    }) => void;
    /**
     * Emits the close event. In autosave scenarios, if the database is dirty, this will save and disable timer.
     * Does not actually destroy the db.
     *
     * @param {function=} callback - (Optional) if supplied will be registered with close event before emitting.
     * @memberof Loki
     */
    close: (callback: any) => void;
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
    generateChangesNotification: (arrayOfCollectionNames?: string[] | string) => ChangeOps[];
    /**
     * (Changes API) - stringify changes for network transmission
     * @returns {string} string representation of the changes
     * @memberof Loki
     */
    serializeChanges: (collectionNamesArray?: any) => string;
    /**
     * (Changes API) - deserialize a serialized changes array
     * @returns {ChangeOps[]} string representation of the changes
     * @memberof Loki
     */
    deserializeChanges: (collectionString: any) => ChangeOps[];
    /**
     * (Changes API) : clears all the changes in all collections.
     * @memberof Loki
     */
    clearChanges: () => void;
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
    throttledSaveDrain: (callback: any, options?: {
        recursiveWait?: boolean;
        recursiveWaitLimit?: boolean;
        recursiveWaitLimitDelay?: boolean;
        recursiveWaitLimitDuration?: number;
        started?: number;
    }) => void;
    /**
     * Internal load logic, decoupled from throttling/contention logic
     *
     * @param {object} options - not currently used (remove or allow overrides?)
     * @param {function=} callback - (Optional) user supplied async callback / error handler
     */
    loadDatabaseInternal: (options: any, callback?: (_: string | Error) => void) => void;
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
    loadDatabase: (options?: {
        recursiveWait?: boolean;
        recursiveWaitLimit?: boolean;
        recursiveWaitLimitDelay?: boolean;
    }, callback?: (_: string | Error) => void) => void;
    /**
     * Internal save logic, decoupled from save throttling logic
     */
    saveDatabaseInternal: (callback: any) => void;
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
    saveDatabase: (callback?: (_: string | Error) => any) => void;
    /**
     * Handles deleting a database from file system, local
     *    storage, or adapter (indexeddb)
     *    This method utilizes loki configuration options (if provided) to determine which
     *    persistence method to use, or environment detection (if configuration was not provided).
     *
     * @param {function=} callback - (Optional) user supplied async callback / error handler
     * @memberof Loki
     */
    deleteDatabase: (options: (_: string | Error) => void, callback?: (_: string | Error) => void) => void;
    /**
     * autosaveDirty - check whether any collections are 'dirty' meaning we need to save (entire) database
     *
     * @returns {boolean} - true if database has changed since last autosave, false if not.
     */
    autosaveDirty: () => boolean;
    /**
     * autosaveClearFlags - resets dirty flags on all collections.
     *    Called from saveDatabase() after db is saved.
     *
     */
    autosaveClearFlags: () => void;
    /**
     * autosaveEnable - begin a javascript interval to periodically save the database.
     *
     * @param {object} options - not currently used (remove or allow overrides?)
     * @param {function=} callback - (Optional) user supplied async callback
     */
    autosaveEnable: (options?: {}, callback?: () => any) => void;
    /**
     * autosaveDisable - stop the autosave interval timer.
     *
     */
    autosaveDisable: () => void;
}
export {};
