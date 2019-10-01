(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define([], factory);
  } else if (typeof exports === 'object') {
    // CommonJS
    module.exports = factory();
  } else {
    // Browser globals
    root.IncrementalIndexedDBAdapter = factory();
  }
}(this, function () {
  return (function () {
    'use strict';

    function IncrementalIndexedDBAdapter() {
      this.mode = 'incremental'
      this.chunkSize = 100
      this.idb = null // will be lazily loaded on first operation that needs it
    }

    // chunkId - index of the data chunk - e.g. chunk 0 will be lokiIds 0-99
    IncrementalIndexedDBAdapter.prototype._getChunk = function(collection, chunkId) {
      // 0-99, 100-199, etc.
      const minId = chunkId * this.chunkSize
      const maxId = minId + this.chunkSize - 1

      // use idIndex to find first collection.data position within the $loki range
      const idIndex = collection.idIndex

      let firstDataPosition = null

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
        firstDataPosition = min
      }

      if (firstDataPosition === null) {
        // no elements in this chunk
        return []
      }

      // find last position
      // if loki IDs are contiguous (no removed elements)
      // last position will be first + chunk - 1
      // (and we look back in case there are missing pieces)
      // TODO: Binary search (not as important as first position, worst case scanario is chunkSize steps)
      let lastDataPosition = null
      for (let i = firstDataPosition + this.chunkSize - 1; i >= firstDataPosition; i--) {
        if (idIndex[i] <= maxId) {
          lastDataPosition = i
          break
        }
      }

      // sanity check
      // TODO: remove me
      const firstElement = collection.data[firstDataPosition]
      if (!(firstElement && firstElement.$loki >= minId && firstElement.$loki <= maxId)) {
        throw new Error('broken invariant firstelement')
      }

      const lastElement = collection.data[lastDataPosition]
      if (!(lastElement && lastElement.$loki >= minId && lastElement.$loki <= maxId)) {
        throw new Error('broken invariant lastElement')
      }

      // this will have *up to* `this.chunkSize` elements (might have less, because $loki ids
      // will have holes when data is deleted)
      const chunkData = collection.data.slice(firstDataPosition, lastDataPosition + 1)

      // TODO: Remove sanity check
      if (chunkData.length > this.chunkSize) {
        throw new Error('broken invariant - chunk size')
      }

      return chunkData
    }

    IncrementalIndexedDBAdapter.prototype.saveDatabase = function(dbname, loki, callback) {
      console.log(`-- exportDatabase - begin`)
      console.time('exportDatabase')
      // console.log(loki.collections[0].lokiIdChanges)

      let chunksToSave = []

      console.time('makeChunks')
      loki.collections.forEach(collection => {

        console.time('get dirty chunk ids')
        const dirtyChunks = new Set()
        collection.dirtyIds.forEach(lokiId => {
          const chunkId = lokiId / this.chunkSize | 0
          dirtyChunks.add(chunkId)
        })
        collection.dirtyIds = null
        console.timeEnd('get dirty chunk ids')

        console.time('get chunks&serialize')
        dirtyChunks.forEach(chunkId => {
          const chunkData = this._getChunk(collection, chunkId)
          // we must stringify, because IDB is asynchronous, and underlying objects are mutable
          const chunkJSON = JSON.stringify(chunkData)
          chunksToSave.push({ key: collection.name + '.chunk.' + chunkId, value: chunkJSON})
        })
        console.timeEnd('get chunks&serialize')

        // clear out data as we won't be saving it
        collection.data = []
      })
      console.timeEnd('makeChunks')

      const serializedMetadata = JSON.stringify(loki)
      loki = null // allow GC of the DB copy

      // console.log(chunksToSave)
      // console.log(chunkIdsToRemove)
      // console.log(JSON.parse(serializedMetadata))

      chunksToSave.push({ key: 'loki', value: serializedMetadata })

      // TODO: Clear out lokiChangedIds flags on original database

      this._saveChunks(chunksToSave, callback)




      // if (success) {
      //   callback(null);
      // }
      // else {
      //   callback(new Error("some error occurred."));
      // }
    }



    IncrementalIndexedDBAdapter.prototype.loadDatabase = function(dbname, callback) {
      console.log(`-- loadDatabase - begin`)
      console.time('loadDatabase')
      this._getAllChunks(chunks => {

        if (!chunks.length) {
          console.log(`No chunks`)
          callback(null)
          return
        }

        console.log(`Found chunks:`, chunks.length)
        // console.log(`Found chunks:`, chunks)

        // sort chunks in place to load data in the right order (ascending loki ids)
        // on both Safari and Chrome, we'll get chunks in order like this: 0, 1, 10, 100...
        // console.time('sort')
        const getSortKey = function({ key }) {
          if (key.includes('.')) {
            const segments = key.split('.')
            if (segments.length === 3) {
              return parseInt(segments[2], 10)
            }
          }

          return key
        }
        chunks.sort(function(a, b) {
          const aKey = getSortKey(a), bKey =getSortKey(b);
          if(aKey < bKey) return -1;
          if(aKey > bKey) return 1;
          return 0;
        });
        // console.timeEnd('sort')
        // console.log(`Sorted chunks`, chunks)

        // repack chunks into a map
        let loki
        let collections = {}

        // console.time('repack')
        chunks.forEach(({ key, value }) => {
          if (key === 'loki') {
            loki = value
          } else if (key.includes('.')) {
            const keySegments = key.split('.')
            if (keySegments.length === 3 && keySegments[1] === 'chunk') {
              const colName = keySegments[0]
              if (collections[colName]) {
                collections[colName].push(value)
              } else {
                collections[colName] = [value]
              }
            } else {
              throw new Error('unknown chunk')
            }
          } else {
            throw new Error('unknown chunk')
          }
        })
        chunks = null
        // console.timeEnd('repack')
        // console.log(`Collections`, collections)

        // TODO: Validate collection chunks?
        if (!loki) {
          throw new Error('missing loki…')
        }

        // parse Loki object
        // console.time('parse')
        loki = JSON.parse(loki)
        // console.timeEnd('parse')
        // console.log(`Parsed loki object`, loki)

        // populate collections with data
        console.time('populate')
        this._populate(loki, collections)
        collections = null
        console.timeEnd('populate')

        // instantiate actual Loki object
        console.timeEnd('loadDatabase')
        // console.log(`Loaded Loki database!`, loki)
        callback(loki)
      })


      // if (success) {
      //   callback(newSerialized);
      // }
      // else {
      //   callback(new Error("some error"));
      // }
    }

    IncrementalIndexedDBAdapter.prototype._populate = function(loki, collections) {
      loki.collections.forEach(collection => {
        const dataChunks = collections[collection.name]

        if (dataChunks) {
          dataChunks.forEach((chunkObj, i) => {
            const chunk = JSON.parse(chunkObj)
            chunkObj = null
            dataChunks[i] = null

            chunk.forEach(doc => {
              collection.data.push(doc)
            })
          })
        } else {
          // console.log(`No chunks available for ${collection.name}`)
        }
      })
    }

    IncrementalIndexedDBAdapter.prototype._initializeIDB = function(callback) {
      const openRequest = indexedDB.open('IncrementalAdapterIDB', 1);

      openRequest.onupgradeneeded = e => {
        const db = e.target.result
        if (db.objectStoreNames.contains('Store')) {
          throw new Error('todo')
          // TODO: Finish this
        }

        const store = db.createObjectStore('Store', { keyPath: 'key' })
      }

      openRequest.onsuccess = e => {
        this.idb = e.target.result
        callback()
      }

      openRequest.onerror = e => {
        throw e
      }
    }

    IncrementalIndexedDBAdapter.prototype._saveChunks = function(chunks, callback) {
      if (!this.idb) {
        this._initializeIDB(() => {
          this._saveChunks(chunks, callback)
        })
        return
      }

      console.time('save chunks to idb')

      let tx = this.idb.transaction(['Store'], 'readwrite')
      tx.oncomplete = () => {
        console.timeEnd('save chunks to idb')
        console.timeEnd('exportDatabase')
        callback()
      }
      // TODO: Error handling

      let store = tx.objectStore('Store')

      console.time('put')
      chunks.forEach(object => {
        store.put(object)
      })
      console.timeEnd('put')
    }

    IncrementalIndexedDBAdapter.prototype._getAllChunks = function(callback) {
      if (!this.idb) {
        this._initializeIDB(() => {
          this._getAllChunks(callback)
        })
        return
      }

      console.time('getChunks')

      let tx = this.idb.transaction(['Store'], 'readonly')

      // TODO: Error handling

      const request = tx.objectStore('Store').getAll()
      request.onsuccess = e => {
        let chunks = e.target.result
        console.timeEnd('getChunks')
        callback(chunks)
      }
    }
    return IncrementalIndexedDBAdapter
  }())
}))
