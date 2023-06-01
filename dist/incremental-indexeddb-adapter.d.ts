declare const DEBUG: boolean;
/**
 * An improved Loki persistence adapter for IndexedDB (not compatible with LokiIndexedAdapter)
 *     Unlike LokiIndexedAdapter, the database is saved not as one big JSON blob, but split into
 *     small chunks with individual collection documents. When saving, only the chunks with changed
 *     documents (and database metadata) is saved to IndexedDB. This speeds up small incremental
 *     saves by an order of magnitude on large (tens of thousands of records) databases. It also
 *     avoids Safari 13 bug that would cause the database to balloon in size to gigabytes
 *
 *     The `appname` argument is not provided - to distinguish between multiple app on the same
 *     domain, simply use a different Loki database name
 *
 * @example
 * var adapter = new IncrementalIndexedDBAdapter();
 *
 * @constructor IncrementalIndexedDBAdapter
 *
 * @param {object=} options Configuration options for the adapter
 * @param {function} options.onversionchange Function to call on `IDBDatabase.onversionchange` event
 *     (most likely database deleted from another browser tab)
 * @param {function} options.onFetchStart Function to call once IDB load has begun.
 *     Use this as an opportunity to execute code concurrently while IDB does work on a separate thread
 * @param {function} options.onDidOverwrite Called when this adapter is forced to overwrite contents
 *     of IndexedDB. This happens if there's another open tab of the same app that's making changes.
 *     You might use it as an opportunity to alert user to the potential loss of data
 * @param {function} options.serializeChunk Called with a chunk (array of Loki documents) before
 *     it's saved to IndexedDB. You can use it to manually compress on-disk representation
 *     for faster database loads. Hint: Hand-written conversion of objects to arrays is very
 *     profitable for performance. If you use this, you must also pass options.deserializeChunk.
 * @param {function} options.deserializeChunk Called with a chunk serialized with options.serializeChunk
 *     Expects an array of Loki documents as the return value
 * @param {number} options.megachunkCount Number of parallel requests for data when loading database.
 *     Can be tuned for a specific application
 * @param {array} options.lazyCollections Names of collections that should be deserialized lazily
 *     Only use this for collections that aren't used at launch
 */
declare class IncrementalIndexedDBAdapter {
    constructor(options: any);
    _getChunk(collection: any, chunkId: any): any;
    /**
     * Incrementally saves the database to IndexedDB
     *
     * @example
     * var idbAdapter = new IncrementalIndexedDBAdapter();
     * var db = new loki('test', { adapter: idbAdapter });
     * var coll = db.addCollection('testColl');
     * coll.insert({test: 'val'});
     * db.saveDatabase();
     *
     * @param {string} dbname - the name to give the serialized database
     * @param {function} getLokiCopy - returns copy of the Loki database
     * @param {function} callback - (Optional) callback passed obj.success with true or false
     * @memberof IncrementalIndexedDBAdapter
     */
    saveDatabase(dbname: any, getLokiCopy: any, callback: any): void;
    _putInChunks(idbStore: any, loki: any, incremental: any, maxChunkIds: any): {
        lokiVersionId: any;
        collectionVersionIds: any[];
    };
    /**
     * Retrieves a serialized db string from the catalog.
     *
     * @example
     * // LOAD
     * var idbAdapter = new IncrementalIndexedDBAdapter();
     * var db = new loki('test', { adapter: idbAdapter });
     * db.loadDatabase(function(result) {
     *   console.log('done');
     * });
     *
     * @param {string} dbname - the name of the database to retrieve.
     * @param {function} callback - callback should accept string param containing serialized db string.
     * @memberof IncrementalIndexedDBAdapter
     */
    loadDatabase(dbname: any, callback: any): void;
    _initializeIDB(dbname: any, onError: any, onSuccess: any): void;
    _getAllChunks(dbname: any, callback: any): void;
    /**
     * Deletes a database from IndexedDB
     *
     * @example
     * // DELETE DATABASE
     * // delete 'finance'/'test' value from catalog
     * idbAdapter.deleteDatabase('test', function {
     *   // database deleted
     * });
     *
     * @param {string} dbname - the name of the database to delete from IDB
     * @param {function=} callback - (Optional) executed on database delete
     * @memberof IncrementalIndexedDBAdapter
     */
    deleteDatabase(dbname: any, callback: any): void;
}
declare function getMaxChunkIds(allKeys: any): {};
declare function lokiChunkVersionId(chunk: any): any;
declare function chunksToMap(chunks: any): {
    loki: any;
    chunkMap: {};
};
declare function populateLoki({ collections }: {
    collections: any;
}, chunkMap: any, deserializeChunk: any, lazyCollections: any): void;
declare function classifyChunk(chunk: any): void;
declare function parseChunk(chunk: any, deserializeChunk: any, lazyCollections: any): void;
declare function randomVersionId(): string;
declare function sortChunksInPlace(chunks: any): void;
declare function createKeyRanges(keys: any, count: any): any[];
declare function idbReq(request: any, onsuccess: any, onerror: any): any;
