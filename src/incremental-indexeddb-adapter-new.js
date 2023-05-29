/* eslint-disable @typescript-eslint/no-this-alias */
(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        // AMD
        define([], factory);
    }
    else if (typeof exports === "object") {
        // CommonJS
        module.exports = factory();
    }
    else {
        // Browser globals
        root.IncrementalIndexedDBAdapter = factory();
    }
})(this, function () {
    return (function () {
        "use strict";
        /* jshint -W030 */
        const DEBUG = typeof window !== "undefined" &&
            !!window
                .__loki_incremental_idb_debug;
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
        function IncrementalIndexedDBAdapter(options) {
            this.mode = "incremental";
            this.options = options || {};
            this.chunkSize = 100;
            this.megachunkCount = this.options.megachunkCount || 24;
            this.lazyCollections = this.options.lazyCollections || [];
            this.idb = null; // will be lazily loaded on first operation that needs it
            this._prevLokiVersionId = null;
            this._prevCollectionVersionIds = {};
            if (!(this.megachunkCount >= 4 && this.megachunkCount % 2 === 0)) {
                throw new Error("megachunkCount must be >=4 and divisible by 2");
            }
        }
        // chunkId - index of the data chunk - e.g. chunk 0 will be lokiIds 0-99
        IncrementalIndexedDBAdapter.prototype._getChunk = function (collection, chunkId) {
            // 0-99, 100-199, etc.
            const minId = chunkId * this.chunkSize;
            const maxId = minId + this.chunkSize - 1;
            // use idIndex to find first collection.data position within the $loki range
            collection.ensureId();
            const idIndex = collection.idIndex;
            let firstDataPosition = null;
            let max = idIndex.length - 1, min = 0, mid;
            while (idIndex[min] < idIndex[max]) {
                mid = (min + max) >> 1;
                if (idIndex[mid] < minId) {
                    min = mid + 1;
                }
                else {
                    max = mid;
                }
            }
            if (max === min && idIndex[min] >= minId && idIndex[min] <= maxId) {
                firstDataPosition = min;
            }
            if (firstDataPosition === null) {
                // no elements in this chunk
                return [];
            }
            // find last position
            // if loki IDs are contiguous (no removed elements), last position will be first + chunk - 1
            // (and we look back in case there are missing pieces)
            // TODO: Binary search (not as important as first position, worst case scanario is only chunkSize steps)
            let lastDataPosition = null;
            for (let i = firstDataPosition + this.chunkSize - 1; i >= firstDataPosition; i--) {
                if (idIndex[i] <= maxId) {
                    lastDataPosition = i;
                    break;
                }
            }
            // verify
            const firstElement = collection.data[firstDataPosition];
            if (!(firstElement &&
                firstElement.$loki >= minId &&
                firstElement.$loki <= maxId)) {
                throw new Error("broken invariant firstelement");
            }
            const lastElement = collection.data[lastDataPosition];
            if (!(lastElement &&
                lastElement.$loki >= minId &&
                lastElement.$loki <= maxId)) {
                throw new Error("broken invariant lastElement");
            }
            // this will have *up to* 'this.chunkSize' elements (might have less, because $loki ids
            // will have holes when data is deleted)
            const chunkData = collection.data.slice(firstDataPosition, lastDataPosition + 1);
            if (chunkData.length > this.chunkSize) {
                throw new Error("broken invariant - chunk size");
            }
            return chunkData;
        };
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
        IncrementalIndexedDBAdapter.prototype.saveDatabase = function (dbname, getLokiCopy, callback) {
            const that = this;
            if (!this.idb) {
                this._initializeIDB(dbname, callback, function () {
                    that.saveDatabase(dbname, getLokiCopy, callback);
                });
                return;
            }
            if (this.operationInProgress) {
                throw new Error("Error while saving to database - another operation is already in progress. Please use throttledSaves=true option on Loki object");
            }
            this.operationInProgress = true;
            DEBUG && console.log("saveDatabase - begin");
            DEBUG && console.time("saveDatabase");
            function finish(e) {
                DEBUG && e && console.error(e);
                DEBUG && console.timeEnd("saveDatabase");
                that.operationInProgress = false;
                callback(e);
            }
            // try..catch is required, e.g.:
            // InvalidStateError: Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing.
            // (this may happen if another tab has called deleteDatabase)
            try {
                let updatePrevVersionIds = function () {
                    console.error("Unexpected successful tx - cannot update previous version ids");
                };
                let didOverwrite = false;
                const tx = this.idb.transaction(["LokiIncrementalData"], "readwrite");
                tx.oncomplete = function () {
                    updatePrevVersionIds();
                    finish();
                    if (didOverwrite && that.options.onDidOverwrite) {
                        that.options.onDidOverwrite();
                    }
                };
                tx.onerror = function (e) {
                    finish(e);
                };
                tx.onabort = function (e) {
                    finish(e);
                };
                const store = tx.objectStore("LokiIncrementalData");
                const performSave = function (maxChunkIds) {
                    try {
                        const incremental = !maxChunkIds;
                        const chunkInfo = that._putInChunks(store, getLokiCopy(), incremental, maxChunkIds);
                        // Update last seen version IDs, but only after the transaction is successful
                        updatePrevVersionIds = function () {
                            that._prevLokiVersionId = chunkInfo.lokiVersionId;
                            chunkInfo.collectionVersionIds.forEach(function (collectionInfo) {
                                that._prevCollectionVersionIds[collectionInfo.name] =
                                    collectionInfo.versionId;
                            });
                        };
                        tx.commit && tx.commit();
                    }
                    catch (error) {
                        console.error("idb performSave failed: ", error);
                        tx.abort();
                    }
                };
                // Incrementally saving changed chunks breaks down if there is more than one writer to IDB
                // (multiple tabs of the same web app), leading to data corruption. To fix that, we save all
                // metadata chunks (loki + collections) with a unique ID on each save and remember it. Before
                // the subsequent save, we read loki from IDB to check if its version ID changed. If not, we're
                // guaranteed that persisted DB is consistent with our diff. Otherwise, we fall back to the slow
                // path and overwrite *all* database chunks with our version. Both reading and writing must
                // happen in the same IDB transaction for this to work.
                // TODO: We can optimize the slow path by fetching collection metadata chunks and comparing their
                // version IDs with those last seen by us. Since any change in collection data requires a metadata
                // chunk save, we're guaranteed that if the IDs match, we don't need to overwrite chukns of this collection
                const getAllKeysThenSave = function () {
                    // NOTE: We must fetch all keys to protect against a case where another tab has wrote more
                    // chunks whan we did -- if so, we must delete them.
                    idbReq(store.getAllKeys(), function (e) {
                        const maxChunkIds = getMaxChunkIds(e.target.result);
                        performSave(maxChunkIds);
                    }, function (e) {
                        console.error("Getting all keys failed: ", e);
                        tx.abort();
                    });
                };
                const getLokiThenSave = function () {
                    idbReq(store.get("loki"), function (e) {
                        if (lokiChunkVersionId(e.target.result) === that._prevLokiVersionId) {
                            performSave();
                        }
                        else {
                            DEBUG &&
                                console.warn("Another writer changed Loki IDB, using slow path...");
                            didOverwrite = true;
                            getAllKeysThenSave();
                        }
                    }, function (e) {
                        console.error("Getting loki chunk failed: ", e);
                        tx.abort();
                    });
                };
                getLokiThenSave();
            }
            catch (error) {
                finish(error);
            }
        };
        // gets current largest chunk ID for each collection
        function getMaxChunkIds(allKeys) {
            const maxChunkIds = {};
            allKeys.forEach(function (key) {
                const keySegments = key.split(".");
                // table.chunk.2317
                if (keySegments.length === 3 && keySegments[1] === "chunk") {
                    const collection = keySegments[0];
                    const chunkId = parseInt(keySegments[2]) || 0;
                    const currentMax = maxChunkIds[collection];
                    if (!currentMax || chunkId > currentMax) {
                        maxChunkIds[collection] = chunkId;
                    }
                }
            });
            return maxChunkIds;
        }
        function lokiChunkVersionId(chunk) {
            try {
                if (chunk) {
                    const loki = JSON.parse(chunk.value);
                    return loki.idbVersionId || null;
                }
                else {
                    return null;
                }
            }
            catch (e) {
                console.error("Error while parsing loki chunk", e);
                return null;
            }
        }
        IncrementalIndexedDBAdapter.prototype._putInChunks = function (idbStore, loki, incremental, maxChunkIds) {
            const that = this;
            const collectionVersionIds = [];
            let savedSize = 0;
            const prepareCollection = function (collection, i) {
                // Find dirty chunk ids
                const dirtyChunks = new Set();
                incremental &&
                    collection.dirtyIds.forEach(function (lokiId) {
                        const chunkId = (lokiId / that.chunkSize) | 0;
                        dirtyChunks.add(chunkId);
                    });
                collection.dirtyIds = [];
                // Serialize chunks to save
                const prepareChunk = function (chunkId) {
                    let chunkData = that._getChunk(collection, chunkId);
                    if (that.options.serializeChunk) {
                        chunkData = that.options.serializeChunk(collection.name, chunkData);
                    }
                    // we must stringify now, because IDB is asynchronous, and underlying objects are mutable
                    // In general, it's also faster to stringify, because we need serialization anyway, and
                    // JSON.stringify is much better optimized than IDB's structured clone
                    chunkData = JSON.stringify(chunkData);
                    savedSize += chunkData.length;
                    DEBUG &&
                        incremental &&
                        console.log("Saving: " + collection.name + ".chunk." + chunkId);
                    idbStore.put({
                        key: collection.name + ".chunk." + chunkId,
                        value: chunkData,
                    });
                };
                if (incremental) {
                    dirtyChunks.forEach(prepareChunk);
                }
                else {
                    // add all chunks
                    const maxChunkId = (collection.maxId / that.chunkSize) | 0;
                    for (let j = 0; j <= maxChunkId; j += 1) {
                        prepareChunk(j);
                    }
                    // delete chunks with larger ids than what we have
                    // NOTE: we don't have to delete metadata chunks as they will be absent from loki anyway
                    // NOTE: failures are silently ignored, so we don't have to worry about holes
                    const persistedMaxChunkId = maxChunkIds[collection.name] || 0;
                    for (let k = maxChunkId + 1; k <= persistedMaxChunkId; k += 1) {
                        const deletedChunkName = collection.name + ".chunk." + k;
                        idbStore.delete(deletedChunkName);
                        DEBUG && console.warn("Deleted chunk: " + deletedChunkName);
                    }
                }
                // save collection metadata as separate chunk (but only if changed)
                if (collection.dirty || dirtyChunks.size || !incremental) {
                    collection.idIndex = []; // this is recreated lazily
                    collection.data = [];
                    collection.idbVersionId = randomVersionId();
                    collectionVersionIds.push({
                        name: collection.name,
                        versionId: collection.idbVersionId,
                    });
                    const metadataChunk = JSON.stringify(collection);
                    savedSize += metadataChunk.length;
                    DEBUG &&
                        incremental &&
                        console.log("Saving: " + collection.name + ".metadata");
                    idbStore.put({
                        key: collection.name + ".metadata",
                        value: metadataChunk,
                    });
                }
                // leave only names in the loki chunk
                loki.collections[i] = { name: collection.name };
            };
            loki.collections.forEach(prepareCollection);
            loki.idbVersionId = randomVersionId();
            const serializedMetadata = JSON.stringify(loki);
            savedSize += serializedMetadata.length;
            DEBUG && incremental && console.log("Saving: loki");
            idbStore.put({ key: "loki", value: serializedMetadata });
            DEBUG && console.log("saved size: " + savedSize);
            return {
                lokiVersionId: loki.idbVersionId,
                collectionVersionIds: collectionVersionIds,
            };
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
        IncrementalIndexedDBAdapter.prototype.loadDatabase = function (dbname, callback) {
            const that = this;
            if (this.operationInProgress) {
                throw new Error("Error while loading database - another operation is already in progress. Please use throttledSaves=true option on Loki object");
            }
            this.operationInProgress = true;
            DEBUG && console.log("loadDatabase - begin");
            DEBUG && console.time("loadDatabase");
            const finish = function (value) {
                DEBUG && console.timeEnd("loadDatabase");
                that.operationInProgress = false;
                callback(value);
            };
            this._getAllChunks(dbname, function (chunks) {
                try {
                    if (!Array.isArray(chunks)) {
                        throw chunks; // we have an error
                    }
                    if (!chunks.length) {
                        return finish(null);
                    }
                    DEBUG && console.log("Found chunks:", chunks.length);
                    // repack chunks into a map
                    chunks = chunksToMap(chunks);
                    const loki = chunks.loki;
                    chunks.loki = null; // gc
                    // populate collections with data
                    populateLoki(loki, chunks.chunkMap, that.options.deserializeChunk, that.lazyCollections);
                    chunks = null; // gc
                    // remember previous version IDs
                    that._prevLokiVersionId = loki.idbVersionId || null;
                    that._prevCollectionVersionIds = {};
                    loki.collections.forEach(function (collection) {
                        that._prevCollectionVersionIds[collection.name] =
                            collection.idbVersionId || null;
                    });
                    return finish(loki);
                }
                catch (error) {
                    that._prevLokiVersionId = null;
                    that._prevCollectionVersionIds = {};
                    return finish(error);
                }
            });
        };
        function chunksToMap(chunks) {
            let loki;
            const chunkMap = {};
            sortChunksInPlace(chunks);
            chunks.forEach(function (chunk) {
                const type = chunk.type;
                const value = chunk.value;
                const name = chunk.collectionName;
                if (type === "loki") {
                    loki = value;
                }
                else if (type === "data") {
                    if (chunkMap[name]) {
                        chunkMap[name].dataChunks.push(value);
                    }
                    else {
                        chunkMap[name] = {
                            metadata: null,
                            dataChunks: [value],
                        };
                    }
                }
                else if (type === "metadata") {
                    if (chunkMap[name]) {
                        chunkMap[name].metadata = value;
                    }
                    else {
                        chunkMap[name] = { metadata: value, dataChunks: [] };
                    }
                }
                else {
                    throw new Error("unreachable");
                }
            });
            if (!loki) {
                throw new Error("Corrupted database - missing database metadata");
            }
            return { loki: loki, chunkMap: chunkMap };
        }
        function populateLoki(loki, chunkMap, deserializeChunk, lazyCollections) {
            loki.collections.forEach(function populateCollection(collectionStub, i) {
                const name = collectionStub.name;
                const chunkCollection = chunkMap[name];
                if (chunkCollection) {
                    if (!chunkCollection.metadata) {
                        throw new Error("Corrupted database - missing metadata chunk for " + name);
                    }
                    const collection = chunkCollection.metadata;
                    chunkCollection.metadata = null;
                    loki.collections[i] = collection;
                    const isLazy = lazyCollections.includes(name);
                    const lokiDeserializeCollectionChunks = function () {
                        DEBUG && isLazy && console.log("lazy loading " + name);
                        const data = [];
                        const dataChunks = chunkCollection.dataChunks;
                        dataChunks.forEach(function populateChunk(chunk, i) {
                            if (isLazy) {
                                chunk = JSON.parse(chunk);
                                if (deserializeChunk) {
                                    chunk = deserializeChunk(name, chunk);
                                }
                            }
                            chunk.forEach(function (doc) {
                                data.push(doc);
                            });
                            dataChunks[i] = null;
                        });
                        return data;
                    };
                    collection.getData = lokiDeserializeCollectionChunks;
                }
            });
        }
        IncrementalIndexedDBAdapter.prototype._initializeIDB = function (dbname, onError, onSuccess) {
            const that = this;
            DEBUG && console.log("initializing idb");
            if (this.idbInitInProgress) {
                throw new Error("Cannot open IndexedDB because open is already in progress");
            }
            this.idbInitInProgress = true;
            const openRequest = indexedDB.open(dbname, 1);
            openRequest.onupgradeneeded = function (e) {
                const db = openRequest.result;
                DEBUG && console.log("onupgradeneeded, old version: " + e.oldVersion);
                if (e.oldVersion < 1) {
                    // Version 1 - Initial - Create database
                    db.createObjectStore("LokiIncrementalData", { keyPath: "key" });
                }
                else {
                    // Unknown version
                    throw new Error("Invalid old version " + e.oldVersion + " for IndexedDB upgrade");
                }
            };
            openRequest.onsuccess = function (e) {
                that.idbInitInProgress = false;
                const db = openRequest.result;
                that.idb = db;
                if (!db.objectStoreNames.contains("LokiIncrementalData")) {
                    onError(new Error("Missing LokiIncrementalData"));
                    // Attempt to recover (after reload) by deleting database, since it's damaged anyway
                    that.deleteDatabase(dbname);
                    return;
                }
                DEBUG && console.log("init success");
                db.onversionchange = function (versionChangeEvent) {
                    // Ignore if database was deleted and recreated in the meantime
                    if (that.idb !== db) {
                        return;
                    }
                    DEBUG && console.log("IDB version change", versionChangeEvent);
                    // This function will be called if another connection changed DB version
                    // (Most likely database was deleted from another browser tab, unless there's a new version
                    // of this adapter, or someone makes a connection to IDB outside of this adapter)
                    // We must close the database to avoid blocking concurrent deletes.
                    // The database will be unusable after this. Be sure to supply `onversionchange` option
                    // to force logout
                    that.idb.close();
                    that.idb = null;
                    if (that.options.onversionchange) {
                        that.options.onversionchange(versionChangeEvent);
                    }
                };
                onSuccess();
            };
            openRequest.onblocked = function (e) {
                console.error("IndexedDB open is blocked", e);
                onError(new Error("IndexedDB open is blocked by open connection"));
            };
            openRequest.onerror = function (e) {
                that.idbInitInProgress = false;
                console.error("IndexedDB open error", e);
                onError(e);
            };
        };
        IncrementalIndexedDBAdapter.prototype._getAllChunks = function (dbname, callback) {
            const that = this;
            if (!this.idb) {
                this._initializeIDB(dbname, callback, function () {
                    that._getAllChunks(dbname, callback);
                });
                return;
            }
            const tx = this.idb.transaction(["LokiIncrementalData"], "readonly");
            const store = tx.objectStore("LokiIncrementalData");
            const deserializeChunk = this.options.deserializeChunk;
            const lazyCollections = this.lazyCollections;
            // If there are a lot of chunks (>100), don't request them all in one go, but in multiple
            // "megachunks" (chunks of chunks). This improves concurrency, as main thread is already busy
            // while IDB process is still fetching data. Details: https://github.com/techfort/LokiJS/pull/874
            function getMegachunks(keys) {
                const megachunkCount = that.megachunkCount;
                const keyRanges = createKeyRanges(keys, megachunkCount);
                const allChunks = [];
                let megachunksReceived = 0;
                function processMegachunk(e, megachunkIndex, keyRange) {
                    // var debugMsg = 'processing chunk ' + megachunkIndex + ' (' + keyRange.lower + ' -- ' + keyRange.upper + ')'
                    // DEBUG && console.time(debugMsg);
                    const megachunk = e.target.result;
                    megachunk.forEach(function (chunk, i) {
                        parseChunk(chunk, deserializeChunk, lazyCollections);
                        allChunks.push(chunk);
                        megachunk[i] = null; // gc
                    });
                    // DEBUG && console.timeEnd(debugMsg);
                    megachunksReceived += 1;
                    if (megachunksReceived === megachunkCount) {
                        callback(allChunks);
                    }
                }
                // Stagger megachunk requests - first one half, then request the second when first one comes
                // back. This further improves concurrency.
                const megachunkWaves = 2;
                const megachunksPerWave = megachunkCount / megachunkWaves;
                function requestMegachunk(index, wave) {
                    const keyRange = keyRanges[index];
                    idbReq(store.getAll(keyRange), function (e) {
                        if (wave < megachunkWaves) {
                            requestMegachunk(index + megachunksPerWave, wave + 1);
                        }
                        processMegachunk(e, index, keyRange);
                    }, function (e) {
                        callback(e);
                    });
                }
                for (let i = 0; i < megachunksPerWave; i += 1) {
                    requestMegachunk(i, 1);
                }
            }
            function getAllChunks() {
                idbReq(store.getAll(), function (e) {
                    const allChunks = e.target.result;
                    allChunks.forEach(function (chunk) {
                        parseChunk(chunk, deserializeChunk, lazyCollections);
                    });
                    callback(allChunks);
                }, function (e) {
                    callback(e);
                });
            }
            function getAllKeys() {
                function onDidGetKeys(keys) {
                    keys.sort();
                    if (keys.length > 100) {
                        getMegachunks(keys);
                    }
                    else {
                        getAllChunks();
                    }
                }
                idbReq(store.getAllKeys(), function (e) {
                    onDidGetKeys(e.target.result);
                }, function (e) {
                    callback(e);
                });
                if (that.options.onFetchStart) {
                    that.options.onFetchStart();
                }
            }
            getAllKeys();
        };
        function classifyChunk(chunk) {
            const key = chunk.key;
            if (key === "loki") {
                chunk.type = "loki";
                return;
            }
            else if (key.includes(".")) {
                const keySegments = key.split(".");
                if (keySegments.length === 3 && keySegments[1] === "chunk") {
                    chunk.type = "data";
                    chunk.collectionName = keySegments[0];
                    chunk.index = parseInt(keySegments[2], 10);
                    return;
                }
                else if (keySegments.length === 2 && keySegments[1] === "metadata") {
                    chunk.type = "metadata";
                    chunk.collectionName = keySegments[0];
                    return;
                }
            }
            console.error("Unknown chunk " + key);
            throw new Error("Corrupted database - unknown chunk found");
        }
        function parseChunk(chunk, deserializeChunk, lazyCollections) {
            classifyChunk(chunk);
            const isData = chunk.type === "data";
            const isLazy = lazyCollections.includes(chunk.collectionName);
            if (!(isData && isLazy)) {
                chunk.value = JSON.parse(chunk.value);
            }
            if (deserializeChunk && isData && !isLazy) {
                chunk.value = deserializeChunk(chunk.collectionName, chunk.value);
            }
        }
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
        IncrementalIndexedDBAdapter.prototype.deleteDatabase = function (dbname, callback) {
            if (this.operationInProgress) {
                throw new Error("Error while deleting database - another operation is already in progress. Please use throttledSaves=true option on Loki object");
            }
            this.operationInProgress = true;
            const that = this;
            DEBUG && console.log("deleteDatabase - begin");
            DEBUG && console.time("deleteDatabase");
            this._prevLokiVersionId = null;
            this._prevCollectionVersionIds = {};
            if (this.idb) {
                this.idb.close();
                this.idb = null;
            }
            const request = indexedDB.deleteDatabase(dbname);
            request.onsuccess = function () {
                that.operationInProgress = false;
                DEBUG && console.timeEnd("deleteDatabase");
                callback({ success: true });
            };
            request.onerror = function (e) {
                that.operationInProgress = false;
                console.error("Error while deleting database", e);
                callback({ success: false });
            };
            request.onblocked = function (e) {
                // We can't call callback with failure status, because this will be called even if we
                // succeed in just a moment
                console.error("Deleting database failed because it's blocked by another connection", e);
            };
        };
        function randomVersionId() {
            // Appears to have enough entropy for chunk version IDs
            // (Only has to be different than enough of its own previous versions that there's no writer
            // that thinks a new version is the same as an earlier one, not globally unique)
            return Math.random().toString(36).substring(2);
        }
        function sortChunksInPlace(chunks) {
            // sort chunks in place to load data in the right order (ascending loki ids)
            // on both Safari and Chrome, we'll get chunks in order like this: 0, 1, 10, 100...
            chunks.sort(function (a, b) {
                return (a.index || 0) - (b.index || 0);
            });
        }
        function createKeyRanges(keys, count) {
            const countPerRange = Math.floor(keys.length / count);
            const keyRanges = [];
            let minKey, maxKey;
            for (let i = 0; i < count; i += 1) {
                minKey = keys[countPerRange * i];
                maxKey = keys[countPerRange * (i + 1)];
                if (i === 0) {
                    // ... < maxKey
                    keyRanges.push(IDBKeyRange.upperBound(maxKey, true));
                }
                else if (i === count - 1) {
                    // >= minKey
                    keyRanges.push(IDBKeyRange.lowerBound(minKey));
                }
                else {
                    // >= minKey && < maxKey
                    keyRanges.push(IDBKeyRange.bound(minKey, maxKey, false, true));
                }
            }
            return keyRanges;
        }
        function idbReq(request, onsuccess, onerror) {
            request.onsuccess = function (e) {
                try {
                    return onsuccess(e);
                }
                catch (error) {
                    onerror(error);
                }
            };
            request.onerror = onerror;
            return request;
        }
        return IncrementalIndexedDBAdapter;
    })();
});
