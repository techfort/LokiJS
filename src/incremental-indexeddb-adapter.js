(function(root, factory) {
  if (typeof define === "function" && define.amd) {
    // AMD
    define([], factory);
  } else if (typeof exports === "object") {
    // CommonJS
    module.exports = factory();
  } else {
    // Browser globals
    root.IncrementalIndexedDBAdapter = factory();
  }
})(this, function() {
  return (function() {
    "use strict";

    /* jshint -W030 */
    var DEBUG = typeof window !== 'undefined' && !!window.__loki_incremental_idb_debug;

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
     * @param {function} options.serializeChunk Called with a chunk (array of Loki documents) before
     *     it's saved to IndexedDB. You can use it to manually compress on-disk representation
     *     for faster database loads. Hint: Hand-written conversion of objects to arrays is very
     *     profitable for performance. If you use this, you must also pass options.deserializeChunk.
     * @param {function} options.deserializeChunk Called with a chunk serialized with options.serializeChunk
     *     Expects an array of Loki documents as the return value
     */
    function IncrementalIndexedDBAdapter(options) {
      this.mode = "incremental";
      this.options = options || {};
      this.chunkSize = 100;
      this.idb = null; // will be lazily loaded on first operation that needs it
      this._prevLokiVersionId = null;
      this._prevCollectionVersionIds = {};
    }

    // chunkId - index of the data chunk - e.g. chunk 0 will be lokiIds 0-99
    IncrementalIndexedDBAdapter.prototype._getChunk = function(collection, chunkId) {
      // 0-99, 100-199, etc.
      var minId = chunkId * this.chunkSize;
      var maxId = minId + this.chunkSize - 1;

      // use idIndex to find first collection.data position within the $loki range
      collection.ensureId();
      var idIndex = collection.idIndex;

      var firstDataPosition = null;

      var max = idIndex.length - 1,
        min = 0,
        mid;

      while (idIndex[min] < idIndex[max]) {
        mid = (min + max) >> 1;

        if (idIndex[mid] < minId) {
          min = mid + 1;
        } else {
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
      var lastDataPosition = null;
      for (var i = firstDataPosition + this.chunkSize - 1; i >= firstDataPosition; i--) {
        if (idIndex[i] <= maxId) {
          lastDataPosition = i;
          break;
        }
      }

      // verify
      var firstElement = collection.data[firstDataPosition];
      if (!(firstElement && firstElement.$loki >= minId && firstElement.$loki <= maxId)) {
        throw new Error("broken invariant firstelement");
      }

      var lastElement = collection.data[lastDataPosition];
      if (!(lastElement && lastElement.$loki >= minId && lastElement.$loki <= maxId)) {
        throw new Error("broken invariant lastElement");
      }

      // this will have *up to* 'this.chunkSize' elements (might have less, because $loki ids
      // will have holes when data is deleted)
      var chunkData = collection.data.slice(firstDataPosition, lastDataPosition + 1);

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
    IncrementalIndexedDBAdapter.prototype.saveDatabase = function(dbname, getLokiCopy, callback) {
      var that = this;

      if (!this.idb) {
        this._initializeIDB(dbname, callback, function() {
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

      var updatePrevVersionIds = function () {
        console.error('Unexpected successful tx - cannot update previous version ids');
      };

      DEBUG && console.log("save tx: begin");
      var tx = this.idb.transaction(['LokiIncrementalData'], "readwrite");
      tx.oncomplete = function() {
        updatePrevVersionIds();
        DEBUG && console.log("save tx: complete");
        return finish();
      };

      tx.onerror = function(e) {
        DEBUG && console.log("save tx: error");
        return finish(e);
      };

      tx.onabort = function(e) {
        DEBUG && console.log("save tx: abort");
        return finish(e);
      };

      var store = tx.objectStore('LokiIncrementalData');

      function performSave(maxChunkIds) {
        try {
          var incremental = !maxChunkIds;
          var chunkInfo = that._putInChunks(store, getLokiCopy(), incremental, maxChunkIds);
          updatePrevVersionIds = function() {
            that._prevLokiVersionId = chunkInfo.lokiVersionId;
            chunkInfo.collectionVersionIds.forEach(function (collectionInfo) {
              that._prevCollectionVersionIds[collectionInfo.name] = collectionInfo.versionId;
            });
          };
          DEBUG && console.log('chunks saved');
          tx.commit && tx.commit();
        } catch (error) {
          console.error('Error while saving to idb', error);
          tx.abort();
        }
      }

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
      function getAllKeysThenSave() {
        // NOTE: We must fetch all keys to protect against a case where another tab has wrote more
        // chunks whan we did -- if so, we must delete them.
        idbReq(store.getAllKeys(), function(e) {
          var maxChunkIds = getMaxChunkIds(e.target.result);
          performSave(maxChunkIds);
        }, function(e) {
          console.error('Getting all keys failed: ', e);
          tx.abort();
        });
      }

      function getLokiThenSave() {
        idbReq(store.get('loki'), function(e) {
          if (lokiChunkVersionId(e.target.result) === that._prevLokiVersionId) {
            performSave();
          } else {
            DEBUG && console.warn('--------> LOKI CHANGED!!! [slow path]');
            getAllKeysThenSave();
          }
        }, function(e) {
          console.error('Getting loki chunk failed: ', e);
          tx.abort();
        });
      }

      getLokiThenSave();
    };

    // gets current largest chunk ID for each collection
    function getMaxChunkIds(allKeys) {
      var maxChunkIds = {};

      allKeys.forEach(function (key) {
        var keySegments = key.split(".");
        // table.chunk.2317
        if (keySegments.length === 3 && keySegments[1] === "chunk") {
          var collection = keySegments[0];
          var chunkId = parseInt(keySegments[2]) || 0;
          var currentMax = maxChunkIds[collection];

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
          var loki = JSON.parse(chunk.value);
          return loki.idbVersionId || null;
        } else {
          return null;
        }
      } catch (e) {
        console.error('Error while parsing loki chunk', e);
        return null;
      }
    }

    IncrementalIndexedDBAdapter.prototype._putInChunks = function(idbStore, loki, incremental, maxChunkIds) {
      var that = this;
      var collectionVersionIds = [];
      var savedSize = 0;

      var prepareCollection = function (collection, i) {
        // Find dirty chunk ids
        var dirtyChunks = new Set();
        incremental && collection.dirtyIds.forEach(function(lokiId) {
          var chunkId = (lokiId / that.chunkSize) | 0;
          dirtyChunks.add(chunkId);
        });
        collection.dirtyIds = [];

        // Serialize chunks to save
        var prepareChunk = function (chunkId) {
          var chunkData = that._getChunk(collection, chunkId);
          if (that.options.serializeChunk) {
            chunkData = that.options.serializeChunk(collection.name, chunkData);
          }
          // we must stringify now, because IDB is asynchronous, and underlying objects are mutable
          // In general, it's also faster to stringify, because we need serialization anyway, and
          // JSON.stringify is much better optimized than IDB's structured clone
          chunkData = JSON.stringify(chunkData);
          savedSize += chunkData.length;
          idbStore.put({
            key: collection.name + ".chunk." + chunkId,
            value: chunkData,
          });
        };
        if (incremental) {
          dirtyChunks.forEach(prepareChunk);
        } else {
          // add all chunks
          var maxChunkId = (collection.maxId / that.chunkSize) | 0;
          for (var j = 0; j <= maxChunkId; j += 1) {
            prepareChunk(j);
          }

          // delete chunks with larger ids than what we have
          // NOTE: we don't have to delete metadata chunks as they will be absent from loki anyway
          // NOTE: failures are silently ignored, so we don't have to worry about holes
          var persistedMaxChunkId = maxChunkIds[collection.name] || 0;
          for (var k = maxChunkId + 1; k <= persistedMaxChunkId; k += 1) {
            var deletedChunkName = collection.name + ".chunk." + k;
            idbStore.delete(deletedChunkName);
            DEBUG && console.warn('Deleted chunk: ' + deletedChunkName);
          }
        }

        // save collection metadata as separate chunk (but only if changed)
        if (collection.dirty || dirtyChunks.size || !incremental) {
          collection.idIndex = []; // this is recreated lazily
          collection.data = [];
          collection.idbVersionId = randomVersionId();
          collectionVersionIds.push({ name: collection.name, versionId: collection.idbVersionId });

          var metadataChunk = JSON.stringify(collection);
          savedSize += metadataChunk.length;
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
      var serializedMetadata = JSON.stringify(loki);
      savedSize += serializedMetadata.length;

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
    IncrementalIndexedDBAdapter.prototype.loadDatabase = function(dbname, callback) {
      var that = this;

      if (this.operationInProgress) {
        throw new Error("Error while loading database - another operation is already in progress. Please use throttledSaves=true option on Loki object");
      }

      this.operationInProgress = true;

      DEBUG && console.log("loadDatabase - begin");
      DEBUG && console.time("loadDatabase");

      var finish = function (value) {
        DEBUG && console.timeEnd("loadDatabase");
        that.operationInProgress = false;
        callback(value);
      };

      this._getAllChunks(dbname, function(chunks) {
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
          var loki = JSON.parse(chunks.loki);
          chunks.loki = null; // gc

          // populate collections with data
          var deserializeChunk = that.options.deserializeChunk;
          populateLoki(loki, chunks.chunkMap, deserializeChunk);
          chunks = null; // gc

          // remember previous version IDs
          that._prevLokiVersionId = loki.idbVersionId || null;
          that._prevCollectionVersionIds = {};
          loki.collections.forEach(function (collection) {
            that._prevCollectionVersionIds[collection.name] = collection.idbVersionId || null;
          });

          return finish(loki);
        } catch (error) {
          that._prevLokiVersionId = null;
          that._prevCollectionVersionIds = {};
          return finish(error);
        }
      });
    };

    function chunksToMap(chunks) {
      var loki;
      var chunkMap = {};

      sortChunksInPlace(chunks);

      chunks.forEach(function(object) {
        var key = object.key;
        var value = object.value;
        if (key === "loki") {
          loki = value;
          return;
        } else if (key.includes(".")) {
          var keySegments = key.split(".");
          if (keySegments.length === 3 && keySegments[1] === "chunk") {
            var colName = keySegments[0];
            if (chunkMap[colName]) {
              chunkMap[colName].dataChunks.push(value);
            } else {
              chunkMap[colName] = {
                metadata: null,
                dataChunks: [value],
              };
            }
            return;
          } else if (keySegments.length === 2 && keySegments[1] === "metadata") {
            var name = keySegments[0];
            if (chunkMap[name]) {
              chunkMap[name].metadata = value;
            } else {
              chunkMap[name] = { metadata: value, dataChunks: [] };
            }
            return;
          }
        }

        console.error("Unknown chunk " + key);
        throw new Error("Corrupted database - unknown chunk found");
      });

      if (!loki) {
        throw new Error("Corrupted database - missing database metadata");
      }

      return { loki: loki, chunkMap: chunkMap };
    }

    function populateLoki(loki, chunkMap, deserializeChunk) {
      loki.collections.forEach(function(collectionStub, i) {
        var chunkCollection = chunkMap[collectionStub.name];

        if (chunkCollection) {
          if (!chunkCollection.metadata) {
            throw new Error("Corrupted database - missing metadata chunk for " + collectionStub.name);
          }
          var collection = JSON.parse(chunkCollection.metadata);
          chunkCollection.metadata = null;

          loki.collections[i] = collection;

          var dataChunks = chunkCollection.dataChunks;
          dataChunks.forEach(function(chunkObj, i) {
            var chunk = JSON.parse(chunkObj);
            chunkObj = null; // make string available for GC
            dataChunks[i] = null;

            if (deserializeChunk) {
              chunk = deserializeChunk(collection.name, chunk);
            }

            chunk.forEach(function(doc) {
              collection.data.push(doc);
            });
          });
        }
      });
    }

    IncrementalIndexedDBAdapter.prototype._initializeIDB = function(dbname, onError, onSuccess) {
      var that = this;
      DEBUG && console.log("initializing idb");

      if (this.idbInitInProgress) {
        throw new Error("Cannot open IndexedDB because open is already in progress");
      }
      this.idbInitInProgress = true;

      var openRequest = indexedDB.open(dbname, 1);

      openRequest.onupgradeneeded = function(e) {
        var db = e.target.result;
        DEBUG && console.log('onupgradeneeded, old version: ' + e.oldVersion);

        if (e.oldVersion < 1) {
          // Version 1 - Initial - Create database
          db.createObjectStore('LokiIncrementalData', { keyPath: "key" });
        } else {
          // Unknown version
          throw new Error("Invalid old version " + e.oldVersion + " for IndexedDB upgrade");
        }
      };

      openRequest.onsuccess = function(e) {
        that.idbInitInProgress = false;
        var db = e.target.result;
        that.idb = db;

        if (!db.objectStoreNames.contains('LokiIncrementalData')) {
          onError(new Error("Missing LokiIncrementalData"));
          // Attempt to recover (after reload) by deleting database, since it's damaged anyway
          that.deleteDatabase(dbname);
          return;
        }

        DEBUG && console.log("init success");

        db.onversionchange = function(versionChangeEvent) {
          DEBUG && console.log('IDB version change', versionChangeEvent);
          // This function will be called if another connection changed DB version
          // (Most likely database was deleted from another browser tab, unless there's a new version
          // of this adapter, or someone makes a connection to IDB outside of this adapter)
          // We must close the database to avoid blocking concurrent deletes.
          // The database will be unusable after this. Be sure to supply `onversionchange` option
          // to force logout
          db.close();
          if (that.options.onversionchange) {
            that.options.onversionchange(versionChangeEvent);
          }
        };

        onSuccess();
      };

      openRequest.onblocked = function(e) {
        console.error("IndexedDB open is blocked", e);
        onError(new Error("IndexedDB open is blocked by open connection"));
      };

      openRequest.onerror = function(e) {
        that.idbInitInProgress = false;
        console.error("IndexedDB open error", e);
        onError(e);
      };
    };

    IncrementalIndexedDBAdapter.prototype._getAllChunks = function(dbname, callback) {
      var that = this;
      if (!this.idb) {
        this._initializeIDB(dbname, callback, function() {
          that._getAllChunks(dbname, callback);
        });
        return;
      }

      var tx = this.idb.transaction(['LokiIncrementalData'], "readonly");

      idbReq(tx.objectStore('LokiIncrementalData').getAll(), function(e) {
        var chunks = e.target.result;
        callback(chunks);
      }, function(e) {
        callback(e);
      });

      if (this.options.onFetchStart) {
        this.options.onFetchStart();
      }
    };

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
    IncrementalIndexedDBAdapter.prototype.deleteDatabase = function(dbname, callback) {
      if (this.operationInProgress) {
        throw new Error("Error while deleting database - another operation is already in progress. Please use throttledSaves=true option on Loki object");
      }

      this.operationInProgress = true;

      var that = this;
      DEBUG && console.log("deleteDatabase - begin");
      DEBUG && console.time("deleteDatabase");

      this._prevLokiVersionId = null;
      this._prevCollectionVersionIds = {};

      if (this.idb) {
        this.idb.close();
        this.idb = null;
      }

      var request = indexedDB.deleteDatabase(dbname);

      request.onsuccess = function() {
        that.operationInProgress = false;
        DEBUG && console.timeEnd("deleteDatabase");
        callback({ success: true });
      };

      request.onerror = function(e) {
        that.operationInProgress = false;
        console.error("Error while deleting database", e);
        callback({ success: false });
      };

      request.onblocked = function(e) {
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

    function _getSortKey(object) {
      var key = object.key;
      if (key.includes(".")) {
        var segments = key.split(".");
        if (segments.length === 3 && segments[1] === "chunk") {
          return parseInt(segments[2], 10);
        }
      }

      return -1; // consistent type must be returned
    }

    function sortChunksInPlace(chunks) {
      // sort chunks in place to load data in the right order (ascending loki ids)
      // on both Safari and Chrome, we'll get chunks in order like this: 0, 1, 10, 100...
      chunks.sort(function(a, b) {
        var aKey = _getSortKey(a),
          bKey = _getSortKey(b);
        if (aKey < bKey) return -1;
        if (aKey > bKey) return 1;
        return 0;
      });
    }

    function idbReq(request, onsuccess, onerror) {
      request.onsuccess = onsuccess;
      request.onerror = onerror;
      return request;
    }

    return IncrementalIndexedDBAdapter;
  })();
});
