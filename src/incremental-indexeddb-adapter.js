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

      // TODO: remove sanity checks when everything is fully tested
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

      // TODO: remove sanity checks when everything is fully tested
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
     * @param {object} dbcopy - copy of the Loki database
     * @param {function} callback - (Optional) callback passed obj.success with true or false
     * @memberof IncrementalIndexedDBAdapter
     */
    IncrementalIndexedDBAdapter.prototype.saveDatabase = function(dbname, loki, callback) {
      var that = this;
      DEBUG && console.log("exportDatabase - begin");
      DEBUG && console.time("exportDatabase");

      var chunksToSave = [];
      var savedLength = 0;

      var prepareCollection = function (collection, i) {
        // Find dirty chunk ids
        var dirtyChunks = new Set();
        collection.dirtyIds.forEach(function(lokiId) {
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
          // (and it's faster for some reason)
          chunkData = JSON.stringify(chunkData);
          savedLength += chunkData.length;
          chunksToSave.push({
            key: collection.name + ".chunk." + chunkId,
            value: chunkData,
          });
        };
        dirtyChunks.forEach(prepareChunk);

        // save collection metadata as separate chunk (but only if changed)
        if (collection.dirty) {
          collection.idIndex = []; // this is recreated lazily
          collection.data = [];

          var metadataChunk = JSON.stringify(collection);
          savedLength += metadataChunk.length;
          chunksToSave.push({
            key: collection.name + ".metadata",
            value: metadataChunk,
          });
        }

        // leave only names in the loki chunk
        loki.collections[i] = { name: collection.name };
      };
      loki.collections.forEach(prepareCollection);

      var serializedMetadata = JSON.stringify(loki);
      savedLength += serializedMetadata.length;
      loki = null; // allow GC of the DB copy

      chunksToSave.push({ key: "loki", value: serializedMetadata });

      DEBUG && console.log("saved size: " + savedLength);
      that._saveChunks(dbname, chunksToSave, callback);
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
      DEBUG && console.log("loadDatabase - begin");
      DEBUG && console.time("loadDatabase");
      this._getAllChunks(dbname, function(chunks) {
        if (!Array.isArray(chunks)) {
          // we got an error
          DEBUG && console.timeEnd("loadDatabase");
          callback(chunks);
        }

        if (!chunks.length) {
          DEBUG && console.timeEnd("loadDatabase");
          callback(null);
          return;
        }

        DEBUG && console.log("Found chunks:", chunks.length);

        that._sortChunksInPlace(chunks);

        // repack chunks into a map
        var loki;
        var chunkCollections = {};

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
              if (chunkCollections[colName]) {
                chunkCollections[colName].dataChunks.push(value);
              } else {
                chunkCollections[colName] = {
                  metadata: null,
                  dataChunks: [value],
                };
              }
              return;
            } else if (keySegments.length === 2 && keySegments[1] === "metadata") {
              var name = keySegments[0];
              if (chunkCollections[name]) {
                chunkCollections[name].metadata = value;
              } else {
                chunkCollections[name] = { metadata: value, dataChunks: [] };
              }
              return;
            }
          }

          console.error("Unknown chunk " + key);
          callback(new Error("Invalid database - unknown chunk found"));
        });
        chunks = null;

        if (!loki) {
          callback(new Error("Invalid database - missing database metadata"));
        }

        // parse Loki object
        loki = JSON.parse(loki);

        // populate collections with data
        that._populate(loki, chunkCollections);
        chunkCollections = null;

        DEBUG && console.timeEnd("loadDatabase");
        callback(loki);
      });
    };

    IncrementalIndexedDBAdapter.prototype._sortChunksInPlace = function(chunks) {
      // sort chunks in place to load data in the right order (ascending loki ids)
      // on both Safari and Chrome, we'll get chunks in order like this: 0, 1, 10, 100...
      var getSortKey = function(object) {
        var key = object.key;
        if (key.includes(".")) {
          var segments = key.split(".");
          if (segments.length === 3 && segments[1] === "chunk") {
            return parseInt(segments[2], 10);
          }
        }

        return -1; // consistent type must be returned
      };
      chunks.sort(function(a, b) {
        var aKey = getSortKey(a),
          bKey = getSortKey(b);
        if (aKey < bKey) return -1;
        if (aKey > bKey) return 1;
        return 0;
      });
    };

    IncrementalIndexedDBAdapter.prototype._populate = function(loki, chunkCollections) {
      var that = this;
      loki.collections.forEach(function(collectionStub, i) {
        var chunkCollection = chunkCollections[collectionStub.name];

        if (chunkCollection) {
          // TODO: What if metadata is missing?
          var collection = JSON.parse(chunkCollection.metadata);
          chunkCollection.metadata = null;

          loki.collections[i] = collection;

          var dataChunks = chunkCollection.dataChunks;
          dataChunks.forEach(function(chunkObj, i) {
            var chunk = JSON.parse(chunkObj);
            chunkObj = null; // make string available for GC
            dataChunks[i] = null;

            if (that.options.deserializeChunk) {
              chunk = that.options.deserializeChunk(collection.name, chunk);
            }

            chunk.forEach(function(doc) {
              collection.data.push(doc);
            });
          });
        }
      });
    };

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
        that.idb = e.target.result;

        if (!that.idb.objectStoreNames.contains('LokiIncrementalData')) {
          onError(new Error("Missing LokiIncrementalData"));
          // Attempt to recover (after reload) by deleting database, since it's damaged anyway
          that.deleteDatabase(dbname);
          return;
        }

        DEBUG && console.log("init success");

        that.idb.onversionchange = function(versionChangeEvent) {
          DEBUG && console.log('IDB version change', versionChangeEvent);
          // This function will be called if another connection changed DB version
          // (Most likely database was deleted from another browser tab, unless there's a new version
          // of this adapter, or someone makes a connection to IDB outside of this adapter)
          // We must close the database to avoid blocking concurrent deletes.
          // The database will be unusable after this. Be sure to supply `onversionchange` option
          // to force logout
          that.idb.close();
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
        console.error("IndexeddB open error", e);
        onError(e);
      };
    };

    IncrementalIndexedDBAdapter.prototype._saveChunks = function(dbname, chunks, callback) {
      var that = this;
      if (!this.idb) {
        this._initializeIDB(dbname, callback, function() {
          that._saveChunks(dbname, chunks, callback);
        });
        return;
      }

      if (this.operationInProgress) {
        throw new Error("Error while saving to database - another operation is already in progress. Please use throttledSaves=true option on Loki object");
      }

      this.operationInProgress = true;

      var tx = this.idb.transaction(['LokiIncrementalData'], "readwrite");
      tx.oncomplete = function() {
        that.operationInProgress = false;
        DEBUG && console.timeEnd("exportDatabase");
        callback();
      };

      tx.onerror = function(e) {
        that.operationInProgress = false;
        callback(e);
      };

      tx.onabort = function(e) {
        that.operationInProgress = false;
        callback(e);
      };

      var store = tx.objectStore('LokiIncrementalData');

      chunks.forEach(function(object) {
        store.put(object);
      });
    };

    IncrementalIndexedDBAdapter.prototype._getAllChunks = function(dbname, callback) {
      var that = this;
      if (!this.idb) {
        this._initializeIDB(dbname, callback, function() {
          that._getAllChunks(dbname, callback);
        });
        return;
      }

      if (this.operationInProgress) {
        throw new Error("Error while loading database - another operation is already in progress. Please use throttledSaves=true option on Loki object");
      }

      this.operationInProgress = true;

      var tx = this.idb.transaction(['LokiIncrementalData'], "readonly");

      var request = tx.objectStore('LokiIncrementalData').getAll();
      request.onsuccess = function(e) {
        that.operationInProgress = false;
        var chunks = e.target.result;
        callback(chunks);
      };

      request.onerror = function(e) {
        that.operationInProgress = false;
        callback(e);
      };

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

    return IncrementalIndexedDBAdapter;
  })();
});
