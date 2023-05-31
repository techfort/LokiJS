/**
 * LokiEventEmitter is a minimalist version of EventEmitter. It enables any
 * constructor that inherits EventEmitter to emit events and trigger
 * listeners that have been added to the event through the on(event, callback) method
 *
 * @constructor LokiEventEmitter
 */
export declare class LokiEventEmitter {
    getIndexedAdapter: () => any;
    configureOptions: (options: any, initialConfig: any) => void;
    copy: (options: any) => any;
    addCollection: (name: any, options: any) => any;
    loadCollection: (collection: any) => void;
    getCollection: (collectionName: any) => any;
    renameCollection: (oldName: any, newName: any) => any;
    listCollections: () => any[];
    removeCollection: (collectionName: any) => void;
    getName: () => any;
    serializeReplacer: (key: any, value: any) => any;
    serialize: (options: any) => any;
    toJson: any;
    serializeDestructured: (options: any) => any;
    serializeCollection: (options: any) => string | any[];
    deserializeDestructured: (destructuredSource: any, options: any) => any;
    deserializeCollection: (destructuredSource: any, options: any) => any[];
    loadJSON: (serializedDb: any, options: any) => void;
    loadJSONObject: (dbObject: any, options: any) => void;
    close: (callback: any) => void;
    generateChangesNotification: (arrayOfCollectionNames: any) => any[];
    serializeChanges: (collectionNamesArray: any) => string;
    clearChanges: () => void;
    throttledSaveDrain: (callback: any, options: any) => void;
    loadDatabase: (options: any, callback: any) => void;
    saveDatabaseInternal: (callback: any) => void;
    saveDatabase: (callback: any) => void;
    save: any;
    deleteDatabase: (options: any, callback: any) => void;
    autosaveDirty: () => boolean;
    autosaveClearFlags: () => void;
    autosaveEnable: (options: any, callback: any) => void;
    autosaveDisable: () => void;
    getSort: () => any;
    rematerialize: (options: any) => any;
    branchResultset: (transform: any, parameters: any) => any;
    toJSON: () => any;
    removeFilters: (options: any) => void;
    applySort: (comparefun: any) => any;
    applySimpleSort: (propname: any, options: any) => any;
    applySortCriteria: (criteria: any) => any;
    startTransaction: () => any;
    commit: () => any;
    rollback: () => any;
    _indexOfFilterWithId: (uid: any) => number;
    _addFilter: (filter: any) => void;
    reapplyFilters: () => any;
    applyFilter: (filter: any) => any;
    applyFind: (query: any, uid: any) => any;
    applyWhere: (fun: any, uid: any) => any;
    removeFilter: (uid: any) => any;
    count: () => any;
    queueRebuildEvent: () => void;
    queueSortPhase: () => void;
    performSortPhase: (options: any) => void;
    evaluateDocument: (objIndex: any, isNew: any) => void;
    removeDocument: (objIndex: any) => void;
    mapReduce: (mapFunction: any, reduceFunction: any) => any;
    /**
     * on(eventName, listener) - adds a listener to the queue of callbacks associated to an event
     * @param {string|string[]} eventName - the name(s) of the event(s) to listen to
     * @param {function} listener - callback function of listener to attach
     * @returns {int} the index of the callback in the array of listeners for a particular event
     * @memberof LokiEventEmitter
     */
    on<F extends (...args: any[]) => any>(eventName: string | string[], listener: F): F;
    /**
     * Alias of LokiEventEmitter.prototype.on
     * addListener(eventName, listener) - adds a listener to the queue of callbacks associated to an event
     * @param {string|string[]} eventName - the name(s) of the event(s) to listen to
     * @param {function} listener - callback function of listener to attach
     * @returns {int} the index of the callback in the array of listeners for a particular event
     * @memberof LokiEventEmitter
     */
    addListener: LokiEventEmitter["on"];
    /**
     * emit(eventName, data) - emits a particular event
     * with the option of passing optional parameters which are going to be processed by the callback
     * provided signatures match (i.e. if passing emit(event, arg0, arg1) the listener should take two parameters)
     * @param {string} eventName - the name of the event
     * @param {object=} data - optional object passed with the event
     * @memberof LokiEventEmitter
     */
    emit(eventName: string, data?: unknown, arg?: any): void;
    /**
     * removeListener() - removes the listener at position 'index' from the event 'eventName'
     * @param {string|string[]} eventName - the name(s) of the event(s) which the listener is attached to
     * @param {function} listener - the listener callback function to remove from emitter
     * @memberof LokiEventEmitter
     */
    removeListener(eventName: string | string[], listener: (...args: any[]) => any): void;
    /**
     * @prop {hashmap} events - a hashmap, with each property being an array of callbacks
     * @memberof LokiEventEmitter
     */
    events: {
        [eventName: string]: ((...args: any[]) => any)[];
    };
    /**
     * @prop {boolean} asyncListeners - boolean determines whether or not the callbacks associated with each event
     * should happen in an async fashion or not
     * Default is false, which means events are synchronous
     * @memberof LokiEventEmitter
     */
    asyncListeners: boolean;
}
