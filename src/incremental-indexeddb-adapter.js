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

    // TODO: db name, etc.

    function IncrementalIndexedDBAdapter() {
      this.mode = "incremental";
      this.chunkSize = 100;
      this.idb = null; // will be lazily loaded on first operation that needs it
    }

    // chunkId - index of the data chunk - e.g. chunk 0 will be lokiIds 0-99
    IncrementalIndexedDBAdapter.prototype._getChunk = function(collection, chunkId) {
      // 0-99, 100-199, etc.
      var minId = chunkId * this.chunkSize;
      var maxId = minId + this.chunkSize - 1;

      // use idIndex to find first collection.data position within the $loki range
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

      if (max === min && idIndex[min] >= minId) {
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

    IncrementalIndexedDBAdapter.prototype.saveDatabase = function(dbname, loki, callback) {
      var that = this;
      console.log("-- exportDatabase - begin");
      console.time("exportDatabase");

      var chunksToSave = [];

      console.time("makeChunks");
      loki.collections.forEach(function(collection, i) {
        console.time("get dirty chunk ids");
        var dirtyChunks = new Set();
        collection.dirtyIds.forEach(function(lokiId) {
          var chunkId = (lokiId / that.chunkSize) | 0;
          dirtyChunks.add(chunkId);
        });
        collection.dirtyIds = [];
        console.timeEnd("get dirty chunk ids");

        console.time("get chunks&serialize");
        dirtyChunks.forEach(function(chunkId) {
          var chunkData = that._getChunk(collection, chunkId);
          // we must stringify, because IDB is asynchronous, and underlying objects are mutable
          chunksToSave.push({
            key: collection.name + ".chunk." + chunkId,
            value: JSON.stringify(chunkData),
          });
        });
        console.timeEnd("get chunks&serialize");

        collection.data = [];
        // this is recreated on load anyway, so we can make metadata smaller
        collection.isIndex = [];

        // save collection metadata as separate chunk, leave only names in loki
        // TODO: To reduce IO, we should only save this chunk when it has changed
        chunksToSave.push({
          key: collection.name + ".metadata",
          value: JSON.stringify(collection),
        });
        loki.collections[i] = { name: collection.name };
      });
      console.timeEnd("makeChunks");

      var serializedMetadata = JSON.stringify(loki);
      loki = null; // allow GC of the DB copy

      // console.log(chunksToSave)
      // console.log(chunkIdsToRemove)
      // console.log(JSON.parse(serializedMetadata))

      chunksToSave.push({ key: "loki", value: serializedMetadata });

      // TODO: Clear out lokiChangedIds flags on original database

      that._saveChunks(chunksToSave, callback);
    };

    IncrementalIndexedDBAdapter.prototype.loadDatabase = function(dbname, callback) {
      var that = this;
      console.log("-- loadDatabase - begin");
      console.time("loadDatabase");
      this._getAllChunks(function(chunks) {
        if (!Array.isArray(chunks)) {
          // we got an error
          callback(chunks);
        }

        if (!chunks.length) {
          console.log("No chunks");
          callback(null);
          return;
        }

        console.log("Found chunks:", chunks.length);

        that._sortChunksInPlace(chunks);

        // repack chunks into a map
        var loki;
        var chunkCollections = {};

        // console.time('repack')
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
        // console.timeEnd('repack')
        // console.log('chunkCollections', chunkCollections)

        if (!loki) {
          callback(new Error("Invalid database - missing database metadata"));
        }

        // parse Loki object
        // console.time('parse')
        loki = JSON.parse(loki);
        // console.timeEnd('parse')
        // console.log('Parsed loki object', loki)

        // populate collections with data
        console.time("populate");
        that._populate(loki, chunkCollections);
        chunkCollections = null;
        console.timeEnd("populate");

        console.timeEnd("loadDatabase");
        // console.log('Loaded Loki database!', loki)
        callback(loki);
      });
    };

    IncrementalIndexedDBAdapter.prototype._sortChunksInPlace = function(chunks) {
      // sort chunks in place to load data in the right order (ascending loki ids)
      // on both Safari and Chrome, we'll get chunks in order like this: 0, 1, 10, 100...
      // console.time('sort')
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
      // console.timeEnd('sort')
      // console.log('Sorted chunks', chunks)
    };

    IncrementalIndexedDBAdapter.prototype._populate = function(loki, chunkCollections) {
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

            chunk.forEach(function(doc) {
              collection.data.push(doc);
            });
          });
        }
      });
    };

    IncrementalIndexedDBAdapter.prototype._initializeIDB = function(callback) {
      var that = this;
      console.log("initializing idb");

      if (this.idbInitInProgress) {
        throw new Error("Cannot open IndexedDB because open is already in progress");
      }
      this.idbInitInProgress = true;

      var openRequest = indexedDB.open("IncrementalAdapterIDB", 1);

      openRequest.onupgradeneeded = function(e) {
        console.log("onupgradeneeded");
        var db = e.target.result;
        if (db.objectStoreNames.contains("Store2")) {
          throw new Error("todo");
          // TODO: Finish this
        }

        var store = db.createObjectStore("Store2", { keyPath: "key" });
      };

      openRequest.onsuccess = function(e) {
        that.idbInitInProgress = false;
        console.log("init success");
        that.idb = e.target.result;
        callback();
      };

      openRequest.onblocked = function(e) {
        console.error("IndexedDB open is blocked", e);
        throw new Error("IndexedDB open is blocked by open connection");
      };

      openRequest.onerror = function(e) {
        that.idbInitInProgress = false;
        console.error("IndexeddB open error", e);
        throw e;
      };
    };

    IncrementalIndexedDBAdapter.prototype._saveChunks = function(chunks, callback) {
      var that = this;
      if (!this.idb) {
        this._initializeIDB(function() {
          that._saveChunks(chunks, callback);
        });
        return;
      }

      console.time("save chunks to idb");

      if (this.operationInProgress) {
        throw new Error("Error while saving to database - another operation is already in progress. Please use throttledSaves=true option on Loki object");
      }

      this.operationInProgress = true;

      var tx = this.idb.transaction(["Store2"], "readwrite");
      tx.oncomplete = function() {
        that.operationInProgress = false;
        console.timeEnd("save chunks to idb");
        console.timeEnd("exportDatabase");
        callback();
      };

      tx.onerror = function(e) {
        that.operationInProgress = false;
        console.error("Error while saving data to database", e);
        callback(e);
      };

      tx.onabort = function(e) {
        that.operationInProgress = false;
        console.error("Abort while saving data to database", e);
        callback(e);
      };

      var store = tx.objectStore("Store2");

      console.time("put");
      // console.log(chunks)
      chunks.forEach(function(object) {
        store.put(object);
      });
      console.timeEnd("put");
    };

    IncrementalIndexedDBAdapter.prototype._getAllChunks = function(callback) {
      var that = this;
      if (!this.idb) {
        this._initializeIDB(function() {
          that._getAllChunks(callback);
        });
        return;
      }
      console.log("getting all chunks");
      console.time("getChunks");

      if (this.operationInProgress) {
        throw new Error("Error while loading database - another operation is already in progress. Please use throttledSaves=true option on Loki object");
      }

      this.operationInProgress = true;

      var tx = this.idb.transaction(["Store2"], "readonly");

      var request = tx.objectStore("Store2").getAll();
      request.onsuccess = function(e) {
        that.operationInProgress = false;
        var chunks = e.target.result;
        console.timeEnd("getChunks");
        callback(chunks);
      };

      request.onerror = function(e) {
        that.operationInProgress = false;
        console.error("Error while fetching data from IndexedDB", e);
        callback(e);
      };
    };

    IncrementalIndexedDBAdapter.prototype.deleteDatabase = function(dbname, callback) {
      var that = this;
      console.log("deleteDatabase");
      console.time("deleteDatabase");

      if (this.operationInProgress) {
        throw new Error("Error while deleting database - another operation is already in progress. Please use throttledSaves=true option on Loki object");
      }

      this.operationInProgress = true;

      if (this.idb) {
        this.idb.close();
        this.idb = null;
      }

      var request = indexedDB.deleteDatabase("IncrementalAdapterIDB");

      request.onsuccess = function() {
        that.operationInProgress = false;
        console.timeEnd("deleteDatabase");
        console.log("deleteDatabase done");
        callback({ success: true });
      };

      request.onerror = function(e) {
        that.operationInProgress = false;
        console.error("Error while deleting database", e);
        callback({ success: false });
      };

      console.log("deleteDatabase - exit fn");
    };

    return IncrementalIndexedDBAdapter;
  })();
});
