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

    // TODO: db name, etc.

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
      // if loki IDs are contiguous (no removed elements), last position will be first + chunk - 1
      // (and we look back in case there are missing pieces)
      // TODO: Binary search (not as important as first position, worst case scanario is only chunkSize steps)
      let lastDataPosition = null
      for (let i = firstDataPosition + this.chunkSize - 1; i >= firstDataPosition; i--) {
        if (idIndex[i] <= maxId) {
          lastDataPosition = i
          break
        }
      }

      // TODO: remove sanity checks when everything is fully tested
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

      // TODO: remove sanity checks when everything is fully tested
      if (chunkData.length > this.chunkSize) {
        throw new Error('broken invariant - chunk size')
      }

      return chunkData
    }

    IncrementalIndexedDBAdapter.prototype.saveDatabase = function(dbname, loki, callback) {
      console.log(`-- exportDatabase - begin`)
      console.time('exportDatabase')

      let chunksToSave = []

      console.time('makeChunks')
      loki.collections.forEach((collection, i) => {
        console.time('get dirty chunk ids')
        const dirtyChunks = new Set()
        collection.dirtyIds.forEach(lokiId => {
          const chunkId = lokiId / this.chunkSize | 0
          dirtyChunks.add(chunkId)
        })
        collection.dirtyIds = []
        console.timeEnd('get dirty chunk ids')

        console.time('get chunks&serialize')
        dirtyChunks.forEach(chunkId => {
          const chunkData = this._getChunk(collection, chunkId)
          // we must stringify, because IDB is asynchronous, and underlying objects are mutable
          chunksToSave.push({
            key: collection.name + '.chunk.' + chunkId,
            value: JSON.stringify(chunkData),
          })
        })
        console.timeEnd('get chunks&serialize')

        collection.data = []
        // this is recreated on load anyway, so we can make metadata smaller
        collection.isIndex = []

        // save collection metadata as separate chunk, leave only names in loki
        // TODO: To reduce IO, we should only save this chunk when it has changed
        chunksToSave.push({
          key: collection.name + '.metadata',
          value: JSON.stringify(collection)
        })
        loki.collections[i] = { name: collection.name }
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
    }

    IncrementalIndexedDBAdapter.prototype.loadDatabase = function(dbname, callback) {
      console.log(`-- loadDatabase - begin`)
      console.time('loadDatabase')
      this._getAllChunks(chunks => {
        if (!Array.isArray(chunks)) {
          // we got an error
          callback(chunks)
        }

        if (!chunks.length) {
          console.log(`No chunks`)
          callback(null)
          return
        }

        console.log(`Found chunks:`, chunks.length)

        this._sortChunksInPlace(chunks)

        // repack chunks into a map
        let loki
        let chunkCollections = {}

        // console.time('repack')
        chunks.forEach(({ key, value }) => {
          if (key === 'loki') {
            loki = value
            return
          } else if (key.includes('.')) {
            const keySegments = key.split('.')
            if (keySegments.length === 3 && keySegments[1] === 'chunk') {
              const colName = keySegments[0]
              if (chunkCollections[colName]) {
                chunkCollections[colName].dataChunks.push(value)
              } else {
                chunkCollections[colName] = { metadata: null, dataChunks: [value] }
              }
              return
            } else if (keySegments.length === 2 && keySegments[1] === 'metadata') {
              const colName = keySegments[0]
              if (chunkCollections[colName]) {
                chunkCollections[colName].metadata = value
              } else {
                chunkCollections[colName] = { metadata: value, dataChunks: [] }
              }
              return
            }
          }

          console.error(`Unknown chunk ${key}`)
          callback(new Error('Invalid database - unknown chunk found'))
        })
        chunks = null
        // console.timeEnd('repack')
        // console.log(`chunkCollections`, chunkCollections)

        if (!loki) {
          callback(new Error('Invalid database - missing database metadata'))
        }

        // parse Loki object
        // console.time('parse')
        loki = JSON.parse(loki)
        // console.timeEnd('parse')
        // console.log(`Parsed loki object`, loki)

        // populate collections with data
        console.time('populate')
        this._populate(loki, chunkCollections)
        chunkCollections = null
        console.timeEnd('populate')

        console.timeEnd('loadDatabase')
        // console.log(`Loaded Loki database!`, loki)
        callback(loki)
      })
    }

    IncrementalIndexedDBAdapter.prototype._sortChunksInPlace = function(chunks) {
      // sort chunks in place to load data in the right order (ascending loki ids)
      // on both Safari and Chrome, we'll get chunks in order like this: 0, 1, 10, 100...
      // console.time('sort')
      const getSortKey = function({ key }) {
        if (key.includes('.')) {
          const segments = key.split('.')
          if (segments.length === 3 && segments[1] === 'chunk') {
            return parseInt(segments[2], 10)
          }
        }

        return -1 // consistent type must be returned
      }
      chunks.sort(function(a, b) {
        const aKey = getSortKey(a), bKey = getSortKey(b);
        if(aKey < bKey) return -1;
        if(aKey > bKey) return 1;
        return 0;
      });
      // console.timeEnd('sort')
      // console.log(`Sorted chunks`, chunks)
    }

    IncrementalIndexedDBAdapter.prototype._populate = function(loki, chunkCollections) {
      loki.collections.forEach((collectionStub, i) => {
        const chunkCollection = chunkCollections[collectionStub.name]

        if (chunkCollection) {
          // TODO: What if metadata is missing?
          const collection = JSON.parse(chunkCollection.metadata)
          chunkCollection.metadata = null

          loki.collections[i] = collection

          const dataChunks = chunkCollection.dataChunks
          dataChunks.forEach((chunkObj, i) => {
            const chunk = JSON.parse(chunkObj)
            chunkObj = null // make string available for GC
            dataChunks[i] = null

            chunk.forEach(doc => {
              collection.data.push(doc)
            })
          })
        }
      })
    }

    IncrementalIndexedDBAdapter.prototype._initializeIDB = function(callback) {
      console.log(`initializing idb`)

      if (this.idbInitInProgress) {
        throw new Error('Cannot open IndexedDB because open is already in progress')
      }
      this.idbInitInProgress = true

      const openRequest = indexedDB.open('IncrementalAdapterIDB', 1);

      openRequest.onupgradeneeded = e => {
        console.log('onupgradeneeded')
        const db = e.target.result
        if (db.objectStoreNames.contains('Store2')) {
          throw new Error('todo')
          // TODO: Finish this
        }

        const store = db.createObjectStore('Store2', { keyPath: 'key' })
      }

      openRequest.onsuccess = e => {
        this.idbInitInProgress = false
        console.log('init success')
        this.idb = e.target.result
        callback()
      }

      openRequest.onblocked = e => {
        console.error('IndexedDB open is blocked', e)
        throw new Error('IndexedDB open is blocked by open connection')
      }

      openRequest.onerror = e => {
        this.idbInitInProgress = false
        console.error('IndexeddB open error', e)
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

      let tx = this.idb.transaction(['Store2'], 'readwrite')
      tx.oncomplete = () => {
        console.timeEnd('save chunks to idb')
        console.timeEnd('exportDatabase')
        callback()
      }

      tx.onerror = e => {
        console.error('Error while saving data to database', e)
        callback(e)
      }

      tx.onabort = e => {
        console.error('Abort while saving data to database', e)
        callback(e)
      }

      let store = tx.objectStore('Store2')

      console.time('put')
      // console.log(chunks)
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
      console.log('getting all chunks')
      console.time('getChunks')

      let tx = this.idb.transaction(['Store2'], 'readonly')

      const request = tx.objectStore('Store2').getAll()
      request.onsuccess = e => {
        let chunks = e.target.result
        console.timeEnd('getChunks')
        callback(chunks)
      }

      request.onerror = e => {
        console.error('Error while fetching data from IndexedDB', e)
        callback(e)
      }
    }

    IncrementalIndexedDBAdapter.prototype.deleteDatabase = function(dbname, callback) {
      console.log(`deleteDatabase`)
      console.time('deleteDatabase')

      // TODO: Race condition - if someone starts deleting database and then save/load happens
      // we might get stuck and never save
      if (this.idb) {
        this.idb.close()
        this.idb = null
      }

      const request = indexedDB.deleteDatabase('IncrementalAdapterIDB')

      request.onsuccess = () => {
        console.timeEnd('deleteDatabase')
        console.log(`deleteDatabase done`)
        callback({ success: true })
      }

      request.onerror = e => {
        console.error('Error while deleting database', e)
        callback({ success: false })
      }

      console.log(`deleteDatabase - exit fn`)
    }

    return IncrementalIndexedDBAdapter
  }())
}))
