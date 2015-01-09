/**
 * LokiJS
 * @author Joe Minichino <joe.minichino@gmail.com>
 *
 * A lightweight document oriented javascript database
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define([], factory);
  } else if (typeof exports === 'object') {
    // CommonJS
    module.exports = factory();
  } else {
    // Browser globals
    root.loki = factory();
  }
}(this, function () {

  return (function () {
    'use strict';

    var Utils = {
      copyProperties: function (src, dest) {
        var prop;
        for (prop in src) {
          dest[prop] = src[prop];
        }
      }
    };

    var LokiOps = {
      // comparison operators
      $eq: function (a, b) {
        return a === b;
      },

      $gt: function (a, b) {
        return a > b;
      },

      $gte: function (a, b) {
        return a >= b;
      },

      $lt: function (a, b) {
        return a < b;
      },

      $lte: function (a, b) {
        return a <= b;
      },

      $ne: function (a, b) {
        return a !== b;
      },

      $regex: function (a, b) {
        return b.test(a);
      },

      $in: function (a, b) {
        return b.indexOf(a) > -1;
      },

      $contains: function (a, b) {
        if (Array.isArray(a)) {
          return a.indexOf(b) !== -1;
        }

        if (typeof a === 'string') {
          return a.indexOf(b) !== -1;
        }

        if (a && typeof a === 'object') {
          return a.hasOwnProperty(b);
        }

      }
    };
    var fs = (typeof exports === 'object') ? require('fs') : false;

    function clone(data, method) {
      var cloneMethod = method || 'parse-stringify',
        cloned;
      if (cloneMethod === 'parse-stringify') {
        cloned = JSON.parse(JSON.stringify(data));
      }
      return cloned;
    }

    function localStorageAvailable() {
      try {
        return ('localStorage' in window && window['localStorage'] !== null);
      } catch (e) {
        return false;
      }
    }


    /**
     * LokiEventEmitter is a minimalist version of EventEmitter. It enables any
     * constructor that inherits EventEmitter to emit events and trigger
     * listeners that have been added to the event through the on(event, callback) method
     *
     * @constructor
     */
    function LokiEventEmitter() {}

    /**
     * @prop Events property is a hashmap, with each property being an array of callbacks
     */
    LokiEventEmitter.prototype.events = {};

    /**
     * @prop asyncListeners - boolean determines whether or not the callbacks associated with each event
     * should happen in an async fashion or not
     * Default is false, which means events are synchronous
     */
    LokiEventEmitter.prototype.asyncListeners = false;

    /**
     * @prop on(eventName, listener) - adds a listener to the queue of callbacks associated to an event
     * @returns {int} the index of the callback in the array of listeners for a particular event
     */
    LokiEventEmitter.prototype.on = function (eventName, listener) {
      var event = this.events[eventName];
      if (!event) {
        event = this.events[eventName] = [];
      }
      return event.push(listener) - 1;
    };

    function applyListener(listener, args) {
      listener.apply(null, args);
    }

    /**
     * @propt emit(eventName, varargs) - emits a particular event
     * with the option of passing optional parameters which are going to be processed by the callback
     * provided signatures match (i.e. if passing emit(event, arg0, arg1) the listener should take two parameters)
     * @param {string} eventName - the name of the event
     * @param {object} varargs - optional objects passed with the event
     */
    LokiEventEmitter.prototype.emit = function (eventName) {

      var args = Array.prototype.slice.call(arguments, 0),
        self = this;
      if (eventName && this.events[eventName]) {
        args.splice(0, 1);
        this.events[eventName].forEach(function (listener) {

          if (self.asyncListeners) {
            setTimeout(function () {

              applyListener(listener, args);
            }, 1);
          } else {
            applyListener(listener, args);
          }

        });
      } else {
        throw new Error('No event ' + eventName + ' defined');
      }
    };

    /**
     * @prop remove() - removes the listener at position 'index' from the event 'eventName'
     */
    LokiEventEmitter.prototype.removeListener = function (eventName, index) {
      if (this.events[eventName]) {
        this.events[eventName].splice(index, 1);
      }
    };

    /**
     * Loki: The main database class
     * @constructor
     * @param {string} filename - name of the file to be saved to
     * @param {object} options - config object
     */
    function Loki(filename, options) {
      this.filename = filename || 'loki.db';
      this.collections = [];

      // persist version of code which created the database to the database.
      // could use for upgrade scenarios
      this.databaseVersion = 1.1;
      this.engineVersion = 1.1;

      // autosave support (disabled by default)
      // pass autosave: true, autosaveInterval: 6000 in options to set 6 second autosave
      this.autosave = false;
      this.autosaveInterval = 5000;
      this.autosaveHandle = null;

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



      this.events = {
        'init': [],
        'flushChanges': [],
        'close': [],
        'changes': [],
        'warning': []
      };
      var self = this;

      var getENV = function () {
        if (typeof window === 'undefined') {
          return 'NODEJS';
        }

        if (typeof global !== 'undefined' && global.window) {
          return 'NODEJS'; //node-webkit
        }

        if (typeof document !== 'undefined') {
          if (document.URL.indexOf('http://') === -1 && document.URL.indexOf('https://') === -1) {
            return 'CORDOVA';
          }
          return 'BROWSER';
        }
        return 'CORDOVA';
      };

      this.ENV = options ? (options.env || 'NODEJS') : getENV();

      if (this.ENV === 'NODEJS') {
        this.fs = fs;
      }
      if (typeof (options) !== 'undefined') {
        this.configureOptions(options, true);
      }

      this.on('init', this.clearChanges);

    }

    // db class is an EventEmitter
    Loki.prototype = new LokiEventEmitter;

    /**
     * configureOptions - allows reconfiguring database options
     *
     * @param {object} options - configuration options to apply to loki db object
     * @param {boolean} initialConfig - (optional) if this is a reconfig, don't pass this
     */
    Loki.prototype.configureOptions = function (options, initialConfig) {
      this.options = {};

      if (typeof (options) !== 'undefined') {
        this.options = options;
      }

      this.persistenceMethod = null;

      if (this.options.hasOwnProperty('persistenceMethod')) {
        this.persistenceMethod = options.persistenceMethod;
      }

      // retain reference to optional persistence adapter 'instance'
      // currently keeping outside options because it can't be serialized
      this.persistenceAdapter = null;

      // if user passes adapter, set persistence mode to adapter and retain persistence adapter instance
      if (this.options.hasOwnProperty('adapter')) {
        this.persistenceMethod = 'adapter';
        this.persistenceAdapter = options.adapter;
      }

      // if they want to load database on loki instantiation, now is a good time to load... after adapter set and before possible autosave initiation
      if (options.hasOwnProperty('autoload') && typeof (initialConfig) !== 'undefined' && initialConfig) {
        this.loadDatabase({}, options.autoloadCallback);
      }

      if (this.options.hasOwnProperty('autosaveInterval')) {
        this.autosaveDisable();
        this.autosaveInterval = parseInt(this.options.autosaveInterval);
      }

      if (this.options.hasOwnProperty('autosave') && this.options.autosave) {
        this.autosaveDisable();
        this.autosave = true;
        this.autosaveEnable();
      }

    };

    /**
     * anonym() - shorthand method for quickly creating and populating an anonymous collection.
     *    This collection is not referenced internally so upon losing scope it will be garbage collected.
     *
     *    Example : var results = new loki().anonym(myDocArray).find({'age': {'$gt': 30} });
     *
     * @param {Array} docs - document array to initialize the anonymous collection with
     * @param {Array} indexesArray - (Optional) array of property names to index
     * @returns {Collection} New collection which you can query or chain
     */
    Loki.prototype.anonym = function (docs, indexesArray) {
      var collection = new Collection('anonym', indexesArray);
      collection.insert(docs);
      return collection;
    }

    Loki.prototype.addCollection = function (name, options) {
      var collection = new Collection(name, options);
      this.collections.push(collection);

      return collection;
    };

    Loki.prototype.loadCollection = function (collection) {
      if (!collection.name) {
        throw new Error('Collection must be have a name property to be loaded');
      }
      this.collections.push(collection);
    };

    Loki.prototype.getCollection = function (collectionName) {
      var i,
        len = this.collections.length;

      for (i = 0; i < len; i += 1) {
        if (this.collections[i].name === collectionName) {
          return this.collections[i];
        }
      }

      // no such collection
      this.emit('warning', 'collection ' + collectionName + ' not found');
      return null;
    };

    Loki.prototype.listCollections = function () {

      var i = this.collections.length,
        colls = [];

      while (i--) {
        colls.push({
          name: this.collections[i].name,
          type: this.collections[i].objType,
          count: this.collections[i].data.length
        });
      }
      return colls;
    };

    Loki.prototype.removeCollection = function (collectionName) {
      var i,
        len = this.collections.length;

      for (i = 0; i < len; i += 1) {
        if (this.collections[i].name === collectionName) {
          this.collections.splice(i, 1);
          return;
        }
      }
      throw 'No such collection';
    };

    Loki.prototype.getName = function () {
      return this.name;
    };

    // toJson
    Loki.prototype.serialize = function () {
      return JSON.stringify(this);
    };
    // alias of serialize
    Loki.prototype.toJson = Loki.prototype.serialize;

    /**
     * loadJSON - inflates a loki database from a serialized JSON string
     *
     * @param {string} serializedDb - a serialized loki database string
     * @param {object} options - apply or override collection level settings
     */
    Loki.prototype.loadJSON = function (serializedDb, options) {

      var obj = JSON.parse(serializedDb),
        i = 0,
        len = obj.collections.length,
        coll,
        copyColl,
        clen,
        j,
        upgradeNeeded = false;

      this.name = obj.name;

      // restore database version
      this.databaseVersion = 1.0;
      if (obj.hasOwnProperty('databaseVersion')) {
        this.databaseVersion = obj.databaseVersion;
      }

      if (this.databaseVersion !== this.engineVersion) {
        upgradeNeeded = true;
      }

      this.collections = [];

      for (i; i < len; i += 1) {
        coll = obj.collections[i];
        copyColl = this.addCollection(coll.name);

        // load each element individually
        clen = coll.data.length;
        j = 0;
        if (options && options.hasOwnProperty(coll.name)) {

          var loader = options[coll.name]['inflate'] ? options[coll.name]['inflate'] : Utils.copyProperties;

          for (j; j < clen; j++) {
            var obj = new(options[coll.name]['proto'])();
            loader(coll.data[j], obj);
            copyColl.data[j] = obj;

          }
        } else {

          for (j; j < clen; j++) {
            copyColl.data[j] = coll.data[j];
          }
        }

        // rough object upgrade, once file format stabilizes we will probably remove this
        if (upgradeNeeded && this.engineVersion == 1.1) {
          // we are upgrading a 1.0 database to 1.1, so initialize new properties
          copyColl.transactional = false;
          copyColl.cloneObjects = false;
          copyColl.asyncListeners = true;
          copyColl.disableChangesApi = true;

          console.warn("upgrading database, loki id is now called '$loki' instead of 'id'");

          // for current collection, if there is at least one document see if its missing $loki key
          if (copyColl.data.length > 0) {
            if (!copyColl.data[0].hasOwnProperty('$loki')) {
              var dlen = copyColl.data.length;
              var currDoc = null;

              // for each document, set $loki to old 'id' column
              // if it has 'originalId' column, move to 'id'
              for (var idx = 0; idx < dlen; idx++) {
                currDoc = copyColl.data[idx];

                currDoc['$loki'] = currDoc['id'];
                delete currDoc.id;

                if (currDoc.hasOwnProperty['originalId']) {
                  currDoc['id'] = currDoc['originalId'];
                }
              }
            }
          }
        } else {
          // not an upgrade or upgrade after 1.1, so copy new collection level options
          copyColl.transactional = coll.transactional;
          copyColl.asyncListeners = coll.asyncListeners;
          copyColl.disableChangesApi = coll.disableChangesApi;
          copyColl.cloneObjects = coll.cloneObjects;
        }

        copyColl.maxId = (coll.data.length === 0) ? 0 : coll.maxId;
        copyColl.idIndex = coll.idIndex;
        // if saved in previous format recover id index out of it
        if (typeof (coll.indices) !== 'undefined') {
          copyColl.idIndex = coll.indices.id;
        }
        if (typeof (coll.binaryIndices) !== 'undefined') {
          copyColl.binaryIndices = coll.binaryIndices;
        }


        copyColl.ensureId();

        // in case they are loading a database created before we added dynamic views, handle undefined
        if (typeof (coll.DynamicViews) === 'undefined') continue;

        // reinflate DynamicViews and attached Resultsets
        for (var idx = 0; idx < coll.DynamicViews.length; idx++) {
          var colldv = coll.DynamicViews[idx];

          var dv = copyColl.addDynamicView(colldv.name, colldv.persistent);
          dv.resultdata = colldv.resultdata;
          dv.resultsdirty = colldv.resultsdirty;
          dv.filterPipeline = colldv.filterPipeline;

          // now that we support multisort, if upgrading from 1.0 database, convert single criteria to array of 1 criteria
          if (upgradeNeeded && typeof (colldv.sortColumn) !== 'undefined' && colldv.sortColumn != null) {
            var isdesc = false;
            if (typeof (colldv.sortColumnDesc) !== 'undefined') {
              isdesc = colldv.sortColumnDesc;
            }

            dv.sortCriteria = [colldv.sortColumn, isdesc];
          } else {
            dv.sortCriteria = colldv.sortCriteria;
          }

          dv.sortFunction = null;
          dv.sortDirty = colldv.sortDirty;
          dv.resultset.filteredrows = colldv.resultset.filteredrows;
          dv.resultset.searchIsChained = colldv.resultset.searchIsChained;
          dv.resultset.filterInitialized = colldv.resultset.filterInitialized;

          dv.rematerialize({
            removeWhereFilters: true
          });
        }
      }
    };

    /**
     * close(callback) - emits the close event with an optional callback. Does not actually destroy the db
     * but useful from an API perspective
     */
    Loki.prototype.close = function (callback) {
      // for autosave scenarios, we will let close perform final save (if dirty)
      // For web use, you might call from window.onbeforeunload to shutdown database, saving pending changes
      if (this.autosave) {
        this.autosaveDisable();
        if (this.autosaveDirty()) {
          this.saveDatabase();
        }
      }

      if (callback) {
        this.on('close', callback);
      }
      this.emit('close');
    };

    /**-------------------------+
    | Changes API               |
    +--------------------------*/

    /**
     * The Changes API enables the tracking the changes occurred in the collections since the beginning of the session,
     * so it's possible to create a differential dataset for synchronization purposes (possibly to a remote db)
     */

    /**
     * generateChangesNotification() - takes all the changes stored in each
     * collection and creates a single array for the entire database. If an array of names
     * of collections is passed then only the included collections will be tracked.
     *
     * @param {array} optional array of collection names. No arg means all collections are processed.
     * @returns {array} array of changes
     * @see private method createChange() in Collection
     */
    Loki.prototype.generateChangesNotification = function (arrayOfCollectionNames) {
      function getCollName(coll) {
        return coll.name;
      }
      var changes = [],
        selectedCollections = arrayOfCollectionNames || this.collections.map(getCollName);

      this.collections.forEach(function (coll) {
        if (selectedCollections.indexOf(getCollName(coll)) !== -1) {
          changes = changes.concat(coll.getChanges());
        }
      });
      return changes;
    };

    /**
     * serializeChanges() - stringify changes for network transmission
     * @returns {string} string representation of the changes
     */
    Loki.prototype.serializeChanges = function (collectionNamesArray) {
      return JSON.stringify(this.generateChangesNotification(collectionNamesArray));
    };

    /**
     * clearChanges() - clears all the changes in all collections.
     */
    Loki.prototype.clearChanges = function () {
      this.collections.forEach(function (coll) {
        if (coll.flushChanges) {
          coll.flushChanges();
        }
      })
    };

    /*------------------+
    | PERSISTENCE       |
    -------------------*/

    /**
     * loadDatabase - Handles loading from file system, local storage, or adapter (indexeddb)
     *    This method utilizes loki configuration options (if provided) to determine which
     *    persistence method to use, or environment detection (if configuration was not provided).
     *
     * @param {object} options - not currently used (remove or allow overrides?)
     * @param {function} callback - (Optional) user supplied async callback / error handler
     */
    Loki.prototype.loadDatabase = function (options, callback) {
      var cFun = callback || function (err, data) {
          if (err) {
            throw err;
          }
          return;
        },
        self = this;

      // If user has specified a persistenceMethod, use it
      if (this.persistenceMethod != null) {
        if (this.persistenceMethod === 'fs') {
          this.fs.readFile(this.filename, {
            encoding: 'utf8'
          }, function readFileCallback(err, data) {
            if (err) {
              return cFun(err, null);
            }
            self.loadJSON(data, options || {});
            cFun(null, data);
          });
        }

        if (this.persistenceMethod === 'localStorage') {
          if (localStorageAvailable()) {
            var data = localStorage.getItem(this.filename);

            self.loadJSON(data, options || {});
            cFun(null, data);
          } else {
            cFun(new Error('localStorage is not available'));
          }
        }

        if (this.persistenceMethod === 'adapter') {
          // test if user has given us an adapter reference (in loki constructor options)
          if (this.persistenceAdapter !== null) {
            this.persistenceAdapter.loadDatabase(this.filename, function loadDatabaseCallback(dbString) {
              if (typeof (dbString) === 'undefined' || dbString === null) {
                console.warn('lokijs loadDatabase : Database not found');
                cFun('Database not found');
              } else {
                self.loadJSON(dbString);
                cFun(null);
              }
            });
          } else {
            cFun(new Error('persistenceAdapter not configured'));
          }
        }

        return;
      };

      // user did not provide persistenceMethod, default to environment detection
      if (this.ENV === 'NODEJS') {
        this.fs.readFile(this.filename, {
          encoding: 'utf8'
        }, function readFileCallback(err, data) {
          if (err) {
            return cFun(err, null);
          }
          if (!data.length) {
            data = self.serialize();
          }
          self.loadJSON(data, options || {});
          cFun(null, data);
        });
      } else if (this.ENV === 'BROWSER') {
        if (localStorageAvailable()) {
          var data = localStorage.getItem(this.filename);

          self.loadJSON(data, options || {});
          cFun(null, data);
        } else {
          cFun(new Error('localStorage is not available'));
        }
      } else {
        cFun(new Error('unknown environment'));
      }
    };

    /**
     * saveDatabase - Handles saving to file system, local storage, or adapter (indexeddb)
     *    This method utilizes loki configuration options (if provided) to determine which
     *    persistence method to use, or environment detection (if configuration was not provided).
     *
     * @param {object} options - not currently used (remove or allow overrides?)
     * @param {function} callback - (Optional) user supplied async callback / error handler
     */
    Loki.prototype.saveDatabase = function (callback) {
      var cFun = callback || function (err) {
          if (err) {
            throw err;
          }
          return;
        },
        self = this;

      // for now assume whichever method below succeeds and reset dirty flags
      // in future we may move this into each if block if no exceptions occur.
      this.autosaveClearFlags();

      // If user has specified a persistenceMethod, use it
      if (this.persistenceMethod != null) {
        if (this.persistenceMethod === 'fs') {
          self.fs.writeFile(self.filename, self.serialize(), cFun);
        }

        if (this.persistenceMethod === 'localStorage') {
          if (localStorageAvailable()) {
            localStorage.setItem(self.filename, self.serialize());
            cFun(null);
          } else {
            cFun(new Error('localStorage is not available'));
          }
        }

        if (this.persistenceMethod === 'adapter') {
          // test if loki persistence adapter instance was provided in loki constructor options
          if (this.persistenceAdapter !== null) {
            this.persistenceAdapter.saveDatabase(this.filename, self.serialize(), function saveDatabasecallback() {
              cFun(null);
            });
          } else {
            cFun(new Error('persistenceAdapter not configured'));
          }
        }

        return;
      };

      // persist in nodejs
      if (this.ENV === 'NODEJS') {
        self.fs.writeFile(self.filename, self.serialize(), cFun);
      } else if (this.ENV === 'BROWSER' || this.ENV === 'CORDOVA') {
        if (localStorageAvailable()) {
          localStorage.setItem(self.filename, self.serialize());
          cFun(null);
        } else {
          cFun(new Error('localStorage is not available'));
        }
      } else {
        cFun(new Error('unknown environment'));
      }
    };
    // alias
    Loki.prototype.save = Loki.prototype.saveDatabase;

    /**
     * autosaveDirty - check whether any collections are 'dirty' meaning we need to save (entire) database
     *
     * @returns {boolean} - true if database has changed since last autosave, false if not.
     */
    Loki.prototype.autosaveDirty = function () {
      for (var idx = 0; idx < this.collections.length; idx++) {
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
    Loki.prototype.autosaveClearFlags = function () {
      for (var idx = 0; idx < this.collections.length; idx++) {
        this.collections[idx].dirty = false;
      }
    };

    /**
     * autosaveEnable - begin a javascript interval to periodically save the database.
     *
     */
    Loki.prototype.autosaveEnable = function () {
      this.autosave = true;

      var delay = 5000,
        self = this;

      if (typeof (this.autosaveInterval) !== 'undefined' && this.autosaveInterval !== null) {
        delay = this.autosaveInterval;
      }

      this.autosaveHandle = setInterval(function autosaveHandleInterval() {
        // use of dirty flag will need to be hierarchical since mods are done at collection level with no visibility of 'db'
        // so next step will be to implement collection level dirty flags set on insert/update/remove
        // along with loki level isdirty() function which iterates all collections to see if any are dirty

        if (self.autosaveDirty()) {
          self.saveDatabase();
        }
      }, delay);
    };

    /**
     * autosaveDisable - stop the autosave interval timer.
     *
     */
    Loki.prototype.autosaveDisable = function () {
      if (typeof (this.autosaveHandle) !== 'undefined' && this.autosaveHandle !== null) {
        clearInterval(this.autosaveHandle);
        this.autosaveHandle = null;
      }
    };


    /**
     * Resultset class allowing chainable queries.  Intended to be instanced internally.
     *    Collection.find(), Collection.where(), and Collection.chain() instantiate this.
     *
     *    Example:
     *    mycollection.chain()
     *      .find({ 'doors' : 4 })
     *      .where(function(obj) { return obj.name === 'Toyota' })
     *      .data();
     *
     * @constructor
     * @param {Collection} collection - The collection which this Resultset will query against.
     * @param {string} queryObj - Optional mongo-style query object to initialize resultset with.
     * @param {function} queryFunc - Optional javascript filter function to initialize resultset with.
     * @param {bool} firstOnly - Optional boolean used by collection.findOne().
     */
    function Resultset(collection, queryObj, queryFunc, firstOnly) {
      // retain reference to collection we are querying against
      this.collection = collection;

      // if chain() instantiates with null queryObj and queryFunc, so we will keep flag for later
      this.searchIsChained = (!queryObj && !queryFunc);
      this.filteredrows = [];
      this.filterInitialized = false;

      // if user supplied initial queryObj or queryFunc, apply it
      if (typeof (queryObj) !== "undefined" && queryObj !== null) {
        return this.find(queryObj, firstOnly);
      }
      if (typeof (queryFunc) !== "undefined" && queryFunc !== null) {
        return this.where(queryFunc);
      }

      // otherwise return unfiltered Resultset for future filtering
      return this;
    }

    /**
     * toJSON() - Override of toJSON to avoid circular references
     *
     */
    Resultset.prototype.toJSON = function () {
      var copy = this.copy();
      copy.collection = null;
      return copy;
    };

    /**
     * limit() - Allows you to limit the number of documents passed to next chain operation.
     *    A resultset copy() is made to avoid altering original resultset.
     *
     * @param {int} qty - The number of documents to return.
     * @returns {Resultset} Returns a copy of the resultset, limited by qty, for subsequent chain ops.
     */
    Resultset.prototype.limit = function (qty) {
      // if this is chained resultset with no filters applied, we need to populate filteredrows first
      if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length === 0) {
        this.filteredrows = Object.keys(this.collection.data);
      }

      var rscopy = this.copy();

      rscopy.filteredrows = rscopy.filteredrows.slice(0, qty);

      return rscopy;
    };

    /**
     * offset() - Used for skipping 'pos' number of documents in the resultset.
     *
     * @param {int} pos - Number of documents to skip; all preceding documents are filtered out.
     * @returns {Resultset} Returns a copy of the resultset, containing docs starting at 'pos' for subsequent chain ops.
     */
    Resultset.prototype.offset = function (pos) {
      // if this is chained resultset with no filters applied, we need to populate filteredrows first
      if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length === 0) {
        this.filteredrows = Object.keys(this.collection.data);
      }

      var rscopy = this.copy();

      rscopy.filteredrows = rscopy.filteredrows.splice(pos, rscopy.filteredrows.length);

      return rscopy;
    };

    /**
     * copy() - To support reuse of resultset in branched query situations.
     *
     * @returns {Resultset} Returns a copy of the resultset (set) but the underlying document references will be the same.
     */
    Resultset.prototype.copy = function () {
      var result = new Resultset(this.collection, null, null);

      result.filteredrows = this.filteredrows.slice();
      result.filterInitialized = this.filterInitialized;

      return result;
    };

    // add branch() as alias of copy()
    Resultset.prototype.branch = Resultset.prototype.copy;

    /**
     * sort() - User supplied compare function is provided two documents to compare. (chainable)
     *    Example:
     *    rslt.sort(function(obj1, obj2) {
     *      if (obj1.name === obj2.name) return 0;
     *      if (obj1.name > obj2.name) return 1;
     *      if (obj1.name < obj2.name) return -1;
     *    });
     *
     * @param {function} comparefun - A javascript compare function used for sorting.
     * @returns {Resultset} Reference to this resultset, sorted, for future chain operations.
     */
    Resultset.prototype.sort = function (comparefun) {
      // if this is chained resultset with no filters applied, just we need to populate filteredrows first
      if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length === 0) {
        this.filteredrows = Object.keys(this.collection.data);
      }

      var wrappedComparer =
        (function (userComparer, rslt) {
          return function (a, b) {
            var obj1 = rslt.collection.data[a];
            var obj2 = rslt.collection.data[b];

            return userComparer(obj1, obj2);
          }
        })(comparefun, this);

      this.filteredrows.sort(wrappedComparer);

      return this;
    };

    /**
     * simplesort() - Simpler, loose evaluation for user to sort based on a property name. (chainable)
     *
     * @param {string} propname - name of property to sort by.
     * @param {bool} isdesc - (Optional) If true, the property will be sorted in descending order
     * @returns {Resultset} Reference to this resultset, sorted, for future chain operations.
     */
    Resultset.prototype.simplesort = function (propname, isdesc) {
      // if this is chained resultset with no filters applied, just we need to populate filteredrows first
      if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length === 0) {
        this.filteredrows = Object.keys(this.collection.data);
      }

      if (typeof (isdesc) === 'undefined') {
        isdesc = false;
      }

      var wrappedComparer =
        (function (prop, desc, rslt) {
          return function (a, b) {
            var obj1 = rslt.collection.data[a];
            var obj2 = rslt.collection.data[b];

            if (obj1[prop] === obj2[prop]) {
              return 0;
            }
            if (desc) {
              if (obj1[prop] < obj2[prop]) {
                return 1;
              }
              if (obj1[prop] > obj2[prop]) {
                return -1;
              }
            } else {
              if (obj1[prop] > obj2[prop]) {
                return 1;
              }
              if (obj1[prop] < obj2[prop]) {
                return -1;
              }
            }
          }
        })(propname, isdesc, this);

      this.filteredrows.sort(wrappedComparer);

      return this;
    };

    /**
     * compoundeval() - helper method for compoundsort(), performing individual object comparisons
     *
     * @param {array} properties - array of property names, in order, by which to evaluate sort order
     * @param {object} obj1 - first object to compare
     * @param {object} obj2 - second object to compare
     * @returns {integer} 0, -1, or 1 to designate if identical (sortwise) or which should be first
     */
    Resultset.prototype.compoundeval = function (properties, obj1, obj2) {
      var propertyCount = properties.length;

      if (propertyCount === 0) {
        throw new Error("Invalid call to compoundeval, need at least one property");
      }

      // decode property, whether just a string property name or subarray [propname, isdesc]
      var isdesc = false;
      var firstProp = properties[0];
      if (typeof (firstProp) !== 'string') {
        if (Array.isArray(firstProp)) {
          isdesc = firstProp[1];
          firstProp = firstProp[0];
        }
      }

      if (obj1[firstProp] === obj2[firstProp]) {
        if (propertyCount === 1) {
          return 0;
        } else {
          return this.compoundeval(properties.slice(1), obj1, obj2, isdesc);
        }
      }

      if (isdesc) {
        return (obj1[firstProp] < obj2[firstProp]) ? 1 : -1;
      } else {
        return (obj1[firstProp] > obj2[firstProp]) ? 1 : -1;
      }
    };

    /**
     * compoundsort() - Allows sorting a resultset based on multiple columns.
     *    Example : rs.compoundsort(['age', 'name']); to sort by age and then name (both ascending)
     *    Example : rs.compoundsort(['age', ['name', true]); to sort by age (ascending) and then by name (descending)
     *
     * @param {array} properties - array of property names or subarray of [propertyname, isdesc] used evaluate sort order
     * @returns {Resultset} Reference to this resultset, sorted, for future chain operations.
     */
    Resultset.prototype.compoundsort = function (properties) {

      // if this is chained resultset with no filters applied, just we need to populate filteredrows first
      if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length === 0) {
        this.filteredrows = Object.keys(this.collection.data);
      }

      var wrappedComparer =
        (function (props, rslt) {
          return function (a, b) {
            var obj1 = rslt.collection.data[a];
            var obj2 = rslt.collection.data[b];

            return rslt.compoundeval(props, obj1, obj2);
          }
        })(properties, this);

      this.filteredrows.sort(wrappedComparer);

      return this;
    };

    /**
     * calculateRange() - Binary Search utility method to find range/segment of values matching criteria.
     *    this is used for collection.find() and first find filter of resultset/dynview
     *    slightly different than get() binary search in that get() hones in on 1 value,
     *    but we have to hone in on many (range)
     * @param {string} op - operation, such as $eq
     * @param {string} prop - name of property to calculate range for
     * @param {object} val - value to use for range calculation.
     * @returns {array} [start, end] index array positions
     */
    Resultset.prototype.calculateRange = function (op, prop, val) {
      var rcd = this.collection.data;
      var index = this.collection.binaryIndices[prop].values;
      var min = 0;
      var max = index.length - 1;
      var mid = null;
      var lbound = 0;
      var ubound = index.length - 1;

      // when no documents are in collection, return empty range condition
      if (rcd.length == 0) {
        return [0, -1];
      }

      var minVal = rcd[index[min]][prop];
      var maxVal = rcd[index[max]][prop];

      // if value falls outside of our range return [0, -1] to designate no results
      switch (op) {
      case '$eq':
        if (val < minVal || val > maxVal) {
          return [0, -1];
        }
        break;
      case '$gt':
        if (val >= maxVal) {
          return [0, -1];
        }
        break;
      case '$gte':
        if (val > maxVal) {
          return [0, -1];
        }
        break;
      case '$lt':
        if (val <= minVal) {
          return [0, -1];
        }
        break;
      case '$lte':
        if (val < minVal) {
          return [0, -1];
        }
        break;
      }

      // hone in on start position of value
      while (min < max) {
        mid = Math.floor((min + max) / 2);

        if (rcd[index[mid]][prop] < val) {
          min = mid + 1;
        } else {
          max = mid;
        }
      }

      lbound = min;

      min = 0;
      max = index.length - 1;

      // hone in on end position of value
      while (min < max) {
        mid = Math.floor((min + max) / 2);

        if (val < rcd[index[mid]][prop]) {
          max = mid;
        } else {
          min = mid + 1;
        }
      }

      ubound = max;

      var lval = rcd[index[lbound]][prop];
      var uval = rcd[index[ubound]][prop];

      switch (op) {
      case '$eq':
        if (lval !== val) {
          return [0, -1];
        }
        if (uval !== val) {
          ubound--;
        }

        return [lbound, ubound];

      case '$gt':
        if (uval <= val) {
          return [0, -1];
        }

        return [ubound, rcd.length - 1];

      case '$gte':
        if (lval < val) {
          return [0, -1];
        }

        return [lbound, rcd.length - 1];

      case '$lt':
        return [0, lbound - 1];

      case '$lte':
        if (uval !== val) {
          ubound--;
        }

        return [0, ubound];

      default:
        return [0, rcd.length - 1];
      }
    };

    /**
     * find() - Used for querying via a mongo-style query object.
     *
     * @param {object} query - A mongo-style query object used for filtering current results.
     * @param {boolean} firstOnly - (Optional) Used by collection.findOne()
     * @returns {Resultset} this resultset for further chain ops.
     */
    Resultset.prototype.find = function (query, firstOnly) {
      if (this.collection.data.length === 0) {
        if (this.searchIsChained) {
          this.filteredrows = [];
          this.filterInitialized = true;
          return this;
        }
        return [];
      }


      var queryObject = query || 'getAll',
        property,
        value,
        operator,
        p,
        key,
        operators = {
          '$eq': LokiOps.$eq,
          '$gt': LokiOps.$gt,
          '$gte': LokiOps.$gte,
          '$lt': LokiOps.$lt,
          '$lte': LokiOps.$lte,
          '$ne': LokiOps.$ne,
          '$regex': LokiOps.$regex,
          '$in': LokiOps.$in,
          '$contains': LokiOps.$contains
        },
        searchByIndex = false,
        result = [],
        index = null,
        // comparison function
        fun,
        // collection data
        t,
        // collection data length
        i,
        len;

      if (typeof (firstOnly) === 'undefined') {
        firstOnly = false;
      }

      // apply no filters if they want all
      if (queryObject === 'getAll') {
        // chained queries can just do coll.chain().data() but let's
        // be versatile and allow this also coll.chain().find().data()
        if (this.searchIsChained) {
          this.filteredrows = Object.keys(this.collection.data);
          return this;
        }
        // not chained, so return collection data array
        else {
          return this.collection.data;
        }
      }

      // if user is deep querying the object such as find('name.first': 'odin')
      var usingDotNotation = false;

      for (p in queryObject) {
        if (queryObject.hasOwnProperty(p)) {
          property = p;
          if (p.indexOf('.') != -1) {
            usingDotNotation = true;
          }
          if (typeof queryObject[p] !== 'object') {
            operator = '$eq';
            value = queryObject[p];
          } else if (typeof queryObject[p] === 'object') {
            for (key in queryObject[p]) {
              if (queryObject[p].hasOwnProperty(key)) {
                operator = key;
                value = queryObject[p][key];
              }
            }
          } else {
            throw 'Do not know what you want to do.';
          }
          break;
        }
      }

      // for regex ops, precompile
      if (operator === '$regex') value = RegExp(value);

      if (this.collection.data === null) {
        throw new TypeError();
      }

      // if an index exists for the property being queried against, use it
      // for now only enabling for non-chained query (who's set of docs matches index)
      // or chained queries where it is the first filter applied and prop is indexed
      if ((!this.searchIsChained || (this.searchIsChained && !this.filterInitialized)) &&
        operator !== '$ne' && operator !== '$regex' && operator !== '$contains' && operator !== '$in' && this.collection.binaryIndices.hasOwnProperty(property)) {
        // this is where our lazy index rebuilding will take place
        // basically we will leave all indexes dirty until we need them
        // so here we will rebuild only the index tied to this property
        // ensureIndex() will only rebuild if flagged as dirty since we are not passing force=true param
        this.collection.ensureIndex(property);

        searchByIndex = true;
        index = this.collection.binaryIndices[property];
      }

      // the comparison function
      fun = operators[operator];

      // Query executed differently depending on :
      //    - whether it is chained or not
      //    - whether the property being queried has an index defined
      //    - if chained, we handle first pass differently for initial filteredrows[] population
      //
      // For performance reasons, each case has its own if block to minimize in-loop calculations

      // If not a chained query, bypass filteredrows and work directly against data
      if (!this.searchIsChained) {
        if (!searchByIndex) {
          t = this.collection.data;
          i = t.length;

          if (firstOnly) {
            while (i--) {
              if (fun(t[i][property], value)) {
                return (t[i]);
              }
            }

            return [];
          } else {
            // if using dot notation then treat property as keypath such as 'name.first'.
            // currently supporting dot notation for non-indexed conditions only
            if (usingDotNotation) {
              var root, paths;
              while (i--) {
                root = t[i];
                paths = property.split('.');
                paths.forEach(function (path) {
                  root = root[path];
                });
                if (fun(root, value)) {
                  result.push(t[i]);
                }
              }
            } else {
              while (i--) {
                if (fun(t[i][property], value)) {
                  result.push(t[i]);
                }
              }
            }
          }
        } else {
          // searching by binary index via calculateRange() utility method
          t = this.collection.data;
          len = t.length;

          var seg = this.calculateRange(operator, property, value, this);

          // not chained so this 'find' was designated in Resultset constructor
          // so return object itself
          if (firstOnly) {
            if (seg[1] !== -1) {
              return this.data[seg[0]];
            }

            return [];
          }

          for (i = seg[0]; i <= seg[1]; i++) {
            result.push(t[index.values[i]]);
          }

          this.filteredrows = result;
        }

        // not a chained query so return result as data[]
        return result;
      }
      // Otherwise this is a chained query
      else {
        // If the filteredrows[] is already initialized, use it
        if (this.filterInitialized) {
          // not searching by index
          if (!searchByIndex) {
            t = this.collection.data;
            i = this.filteredrows.length;

            // currently supporting dot notation for non-indexed conditions only
            if (usingDotNotation) {
              var root, paths;
              while (i--) {
                root = t[this.filteredrows[i]];
                paths = property.split('.');
                paths.forEach(function (path) {
                  root = root[path];
                });
                if (fun(root, value)) {
                  result.push(this.filteredrows[i]);
                }
              }
            } else {
              while (i--) {
                if (fun(t[this.filteredrows[i]][property], value)) {
                  result.push(this.filteredrows[i]);
                }
              }
            }
          } else {
            // search by index
            t = index;
            i = this.filteredrows.length;
            while (i--) {
              if (fun(t[this.filteredrows[i]], value)) {
                result.push(this.filteredrows[i]);
              }
            }
          }

          this.filteredrows = result;

          return this;
        }
        // first chained query so work against data[] but put results in filteredrows
        else {
          // if not searching by index
          if (!searchByIndex) {
            t = this.collection.data;
            i = t.length;

            if (usingDotNotation) {
              var root, paths;

              while (i--) {
                root = t[i];
                paths = property.split('.');
                paths.forEach(function (path) {
                  root = root[path];
                });
                if (fun(root, value)) {
                  result.push(i);
                }
              }
            } else {
              while (i--) {
                if (fun(t[i][property], value)) {
                  result.push(i);
                }
              }
            }
          } else {
            // search by index
            t = this.collection.data;
            var seg = this.calculateRange(operator, property, value, this);

            for (var idx = seg[0]; idx <= seg[1]; idx++) {
              result.push(index.values[idx]);
            }

            this.filteredrows = result;
          }

          this.filteredrows = result;
          this.filterInitialized = true; // next time work against filteredrows[]

          return this;
        }

      }
    };


    /**
     * where() - Used for filtering via a javascript filter function.
     *
     * @param {function} fun - A javascript function used for filtering current results by.
     * @returns {Resultset} this resultset for further chain ops.
     */
    Resultset.prototype.where = function (fun) {

      var viewFunction,
        result = [];

      if ('function' === typeof fun) {
        viewFunction = fun;
      } else {
        throw 'Argument is not a stored view or a function';
      }
      try {
        // if not a chained query then run directly against data[] and return object []
        if (!this.searchIsChained) {
          var i = this.collection.data.length;

          while (i--) {
            if (viewFunction(this.collection.data[i]) === true) {
              result.push(this.collection.data[i]);
            }
          }

          // not a chained query so returning result as data[]
          return result;
        }
        // else chained query, so run against filteredrows
        else {
          // If the filteredrows[] is already initialized, use it
          if (this.filterInitialized) {
            var i = this.filteredrows.length;

            while (i--) {
              if (viewFunction(this.collection.data[this.filteredrows[i]]) === true) {
                result.push(this.filteredrows[i]);
              }
            }

            this.filteredrows = result;

            return this;
          }
          // otherwise this is initial chained op, work against data, push into filteredrows[]
          else {
            var i = this.collection.data.length;

            while (i--) {
              if (viewFunction(this.collection.data[i]) === true) {
                result.push(i);
              }
            }

            this.filteredrows = result;
            this.filterInitialized = true;

            return this;
          }
        }
      } catch (err) {
        throw err;
      }
    };

    /**
     * data() - Terminates the chain and returns array of filtered documents
     *
     * @returns {array} Array of documents in the resultset
     */
    Resultset.prototype.data = function () {
      var result = [];

      // if this is chained resultset with no filters applied, just return collection.data
      if (this.searchIsChained && !this.filterInitialized) {
        if (this.filteredrows.length === 0) {
          return this.collection.data;
        } else {
          // filteredrows must have been set manually, so use it
          this.filterInitialized = true;
        }
      }

      var data = this.collection.data,
        fr = this.filteredrows;

      var i,
        len = this.filteredrows.length;

      for (i = 0; i < len; i++) {
        result.push(data[fr[i]]);
      }

      return result;
    };

    /**
     * update() - used to run an update operation on all documents currently in the resultset.
     *
     * @param {function} updateFunction - User supplied updateFunction(obj) will be executed for each document object.
     * @returns {Resultset} this resultset for further chain ops.
     */
    Resultset.prototype.update = function (updateFunction) {

      if (typeof (updateFunction) !== "function") {
        throw 'Argument is not a function';
      }

      // if this is chained resultset with no filters applied, we need to populate filteredrows first
      if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length === 0) {
        this.filteredrows = Object.keys(this.collection.data);
      }

      var len = this.filteredrows.length,
        rcd = this.collection.data;

      for (var idx = 0; idx < len; idx++) {
        // pass in each document object currently in resultset to user supplied updateFunction
        updateFunction(rcd[this.filteredrows[idx]]);

        // notify collection we have changed this object so it can update meta and allow DynamicViews to re-evaluate
        this.collection.update(rcd[this.filteredrows[idx]]);
      }

      return this;
    };

    /**
     * remove() - removes all document objects which are currently in resultset from collection (as well as resultset)
     *
     * @returns {Resultset} this (empty) resultset for further chain ops.
     */
    Resultset.prototype.remove = function () {

      // if this is chained resultset with no filters applied, we need to populate filteredrows first
      if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length === 0) {
        this.filteredrows = Object.keys(this.collection.data);
      }

      var len = this.filteredrows.length;

      for (var idx = 0; idx < len; idx++) {
        this.collection.remove(this.filteredrows[idx]);
      }

      this.filteredrows = [];

      return this;
    };

    /**
     * mapReduce() - data transformation via user supplied functions
     *
     * @param {function} mapFunction - this function accepts a single document for you to transform and return
     * @param {function} reduceFunction - this function accepts many (array of map outputs) and returns single value
     * @returns The output of your reduceFunction
     */
    Resultset.prototype.mapReduce = function (mapFunction, reduceFunction) {
      try {
        return reduceFunction(this.data().map(mapFunction));
      } catch (err) {
        throw err;
      }
    };

    /**
     * DynamicView class is a versatile 'live' view class which can have filters and sorts applied.
     *    Collection.addDynamicView(name) instantiates this DynamicView object and notifies it
     *    whenever documents are add/updated/removed so it can remain up-to-date. (chainable)
     *
     *    Examples:
     *    var mydv = mycollection.addDynamicView('test');  // default is non-persistent
     *    mydv.applyWhere(function(obj) { return obj.name === 'Toyota'; });
     *    mydv.applyFind({ 'doors' : 4 });
     *    var results = mydv.data();
     *
     * @constructor
     * @param {Collection} collection - A reference to the collection to work against
     * @param {string} name - The name of this dynamic view
     * @param {boolean} persistent - (Optional) If true, the results will be copied into an internal array for read efficiency or binding to.
     */
    function DynamicView(collection, name, persistent) {
      this.collection = collection;
      this.name = name;

      this.persistent = false;
      if (typeof (persistent) !== 'undefined') this.persistent = persistent;

      this.resultset = new Resultset(collection)
      this.resultdata = [];
      this.resultsdirty = false;

      this.cachedresultset = null;

      // keep ordered filter pipeline
      this.filterPipeline = [];

      // sorting member variables
      // we only support one active search, applied using applySort() or applySimpleSort()
      this.sortFunction = null;
      this.sortCriteria = null;
      this.sortDirty = false;

      // for now just have 1 event for when we finally rebuilt lazy view
      // once we refactor transactions, i will tie in certain transactional events

      this.events = {
        'rebuild': []
      };
    }

    DynamicView.prototype = new LokiEventEmitter;


    /**
     * rematerialize() - intended for use immediately after deserialization (loading)
     *    This will clear out and reapply filterPipeline ops, recreating the view.
     *    Since where filters do not persist correctly, this method allows
     *    restoring the view to state where user can re-apply those where filters.
     *
     * @param {Object} options - (Optional) allows specification of 'removeWhereFilters' option
     * @returns {DynamicView} This dynamic view for further chained ops.
     */
    DynamicView.prototype.rematerialize = function (options) {
      var fpl,
        fpi,
        idx;

      options = options || {};

      this.resultdata = [];
      this.resultsdirty = true;
      this.resultset = new Resultset(this.collection);

      if (this.sortFunction || this.sortCriteria) {
        this.sortDirty = true;
      }

      if (options.hasOwnProperty('removeWhereFilters')) {
        // for each view see if it had any where filters applied... since they don't
        // serialize those functions lets remove those invalid filters
        fpl = this.filterPipeline.length;
        fpi = fpl;
        while (fpi--) {
          if (this.filterPipeline[fpi].type === 'where') {
            if (fpi !== this.filterPipeline.length - 1) {
              this.filterPipeline[fpi] = this.filterPipeline[this.filterPipeline.length - 1];
            }

            this.filterPipeline.length--;
          }
        }
      }

      // back up old filter pipeline, clear filter pipeline, and reapply pipeline ops
      var ofp = this.filterPipeline;
      this.filterPipeline = [];

      // now re-apply 'find' filterPipeline ops
      fpl = ofp.length;
      for (idx = 0; idx < fpl; idx++) {
        this.applyFind(ofp[idx].val);
      }

      // during creation of unit tests, i will remove this forced refresh and leave lazy
      this.data();

      // emit rebuild event in case user wants to be notified
      this.emit('rebuild', this);

      return this;
    };

    /**
     * branchResultset() - Makes a copy of the internal resultset for branched queries.
     *    Unlike this dynamic view, the branched resultset will not be 'live' updated,
     *    so your branched query should be immediately resolved and not held for future evaluation.
     *
     * @returns {Resultset} A copy of the internal resultset for branched queries.
     */
    DynamicView.prototype.branchResultset = function () {
      return this.resultset.copy();
    };

    /**
     * toJSON() - Override of toJSON to avoid circular references
     *
     */
    DynamicView.prototype.toJSON = function () {
      var copy = new DynamicView(this.collection, this.name, this.persistent);

      copy.resultset = this.resultset;
      copy.resultdata = []; // let's not save data (copy) to minimize size
      copy.resultsdirty = true;
      copy.filterPipeline = this.filterPipeline;
      copy.sortFunction = this.sortFunction;
      copy.sortCriteria = this.sortCriteria;
      copy.sortDirty = this.sortDirty;

      // avoid circular reference, reapply in db.loadJSON()
      copy.collection = null;

      return copy;
    };

    /**
     * applySort() - Used to apply a sort to the dynamic view
     *
     * @param {function} comparefun - a javascript compare function used for sorting
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     */
    DynamicView.prototype.applySort = function (comparefun) {
      this.sortFunction = comparefun;
      this.sortCriteria = null;

      this.resultset.sort(comparefun);

      this.sortDirty = false;

      return this;
    };

    /**
     * applySimpleSort() - Used to specify a property used for view translation.
     *
     * @param {string} propname - Name of property by which to sort.
     * @param {boolean} isdesc - (Optional) If true, the sort will be in descending order.
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     */
    DynamicView.prototype.applySimpleSort = function (propname, isdesc) {

      if (typeof (isdesc) === 'undefined') {
        isdesc = false;
      }

      this.sortCriteria = [
        [propname, isdesc]
      ];
      this.sortFunction = null;

      this.resultset.simplesort(propname, isdesc);

      this.sortDirty = false;

      return this;
    };

    /**
     * applySortCriteria() - Allows sorting a resultset based on multiple columns.
     *    Example : dv.applySortCriteria(['age', 'name']); to sort by age and then name (both ascending)
     *    Example : dv.applySortCriteria(['age', ['name', true]); to sort by age (ascending) and then by name (descending)
     *    Example : dv.applySortCriteria(['age', true], ['name', true]); to sort by age (descending) and then by name (descending)
     *
     * @param {array} properties - array of property names or subarray of [propertyname, isdesc] used evaluate sort order
     * @returns {DynamicView} Reference to this DynamicView, sorted, for future chain operations.
     */
    DynamicView.prototype.applySortCriteria = function (criteria) {
      this.sortCriterial = criteria;
      this.sortFunction = null;

      this.resultset.compoundsort(criteria);

      this.sortDirty = false;

      return this;
    };

    /**
     * startTransaction() - marks the beginning of a transaction.
     *
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     */
    DynamicView.prototype.startTransaction = function () {
      this.cachedresultset = this.resultset.copy();

      return this;
    };

    /**
     * commit() - commits a transaction.
     *
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     */
    DynamicView.prototype.commit = function () {
      this.cachedresultset = null;

      return this;
    };

    /**
     * rollback() - rolls back a transaction.
     *
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     */
    DynamicView.prototype.rollback = function () {
      this.resultset = this.cachedresultset;

      if (this.persistent) {
        // i don't like the idea of keeping duplicate cached rows for each (possibly) persistent view
        // so we will for now just rebuild the persistent dynamic view data in this worst case scenario
        // (a persistent view utilizing transactions which get rolled back), we already know the filter so not too bad.
        this.resultdata = this.resultset.data();

        this.emit('rebuild', this);
      }

      return this;
    };

    /**
     * applyFind() - Adds a mongo-style query option to the DynamicView filter pipeline
     *
     * @param {object} query - A mongo-style query object to apply to pipeline
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     */
    DynamicView.prototype.applyFind = function (query) {
      this.filterPipeline.push({
        type: 'find',
        val: query
      });

      // Apply immediately to Resultset; if persistent we will wait until later to build internal data
      this.resultset.find(query);

      if (this.sortFunction || this.sortCriteria) {
        this.sortDirty = true;
      }

      if (this.persistent) {
        this.resultsdirty = true;
      }

      return this;
    };

    /**
     * applyWhere() - Adds a javascript filter function to the DynamicView filter pipeline
     *
     * @param {function} fun - A javascript filter function to apply to pipeline
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     */
    DynamicView.prototype.applyWhere = function (fun) {
      this.filterPipeline.push({
        type: 'where',
        val: fun
      });

      // Apply immediately to Resultset; if persistent we will wait until later to build internal data
      this.resultset.where(fun);

      if (this.sortFunction || this.sortCriteria) {
        this.sortDirty = true;
      }
      if (this.persistent) {
        this.resultsdirty = true;
      }
      return this;
    };

    /**
     * data() - resolves and pending filtering and sorting, then returns document array as result.
     *
     * @returns {array} An array of documents representing the current DynamicView contents.
     */
    DynamicView.prototype.data = function () {
      if (this.sortDirty) {
        if (this.sortFunction) {
          this.resultset.sort(this.sortFunction);
        }
        if (this.sortCriteria) {
          this.resultset.compoundsort(this.sortCriteria);
        }
        this.sortDirty = false;
        if (this.persistent) {
          this.resultsdirty = true; // newly sorted, if persistent we need to rebuild resultdata
        }
      }

      // if nonpersistent return resultset data evaluation
      if (!this.persistent) {
        // not sure if this emit will be useful, but if view is non-persistent
        // we will raise event only if resulset has yet to be initialized.
        // user can intercept via dynView.on('rebuild', myCallback);
        // emit is async wait 1 ms so our data() call should exec before event fired
        if (!this.resultset.filterInitialized) {
          this.emit('rebuild', this);
        }

        return this.resultset.data();
      }

      // Persistent Views - we pay price of bulk row copy on first data() access after new filters applied
      if (this.resultsdirty) {
        this.resultdata = this.resultset.data();
        this.resultsdirty = false;

        // user can intercept via dynView.on('rebuild', myCallback);
        this.emit('rebuild', this);
      }

      return this.resultdata;
    };

    /**
     * evaluateDocument() - internal method for (re)evaluating document inclusion.
     *    Called by : collection.insert() and collection.update().
     *
     * @param {int} objIndex - index of document to (re)run through filter pipeline.
     */
    DynamicView.prototype.evaluateDocument = function (objIndex) {
      var ofr = this.resultset.filteredrows;
      var oldPos = ofr.indexOf(objIndex);
      var oldlen = ofr.length;

      // creating a 1-element resultset to run filter chain ops on to see if that doc passes filters;
      // mostly efficient algorithm, slight stack overhead price (this function is called on inserts and updates)
      var evalResultset = new Resultset(this.collection);
      evalResultset.filteredrows = [objIndex];
      evalResultset.filterInitialized = true;
      for (var idx = 0; idx < this.filterPipeline.length; idx++) {
        switch (this.filterPipeline[idx].type) {
        case 'find':
          evalResultset.find(this.filterPipeline[idx].val);
          break;
        case 'where':
          evalResultset.where(this.filterPipeline[idx].val);
          break;
        }
      }

      // not a true position, but -1 if not pass our filter(s), 0 if passed filter(s)
      var newPos = (evalResultset.filteredrows.length === 0) ? -1 : 0;

      // wasn't in old, shouldn't be now... do nothing
      if (oldPos == -1 && newPos == -1) return;

      // wasn't in resultset, should be now... add
      if (oldPos === -1 && newPos !== -1) {
        ofr.push(objIndex);

        if (this.persistent) {
          this.resultdata.push(this.collection.data[objIndex]);
        }

        // need to re-sort to sort new document
        if (this.sortFunction || this.sortCriteria) {
          this.sortDirty = true;
        }

        return;
      }

      // was in resultset, shouldn't be now... delete
      if (oldPos !== -1 && newPos === -1) {
        if (oldPos < oldlen - 1) {
          // http://dvolvr.davidwaterston.com/2013/06/09/restating-the-obvious-the-fastest-way-to-truncate-an-array-in-javascript/comment-page-1/
          ofr[oldPos] = ofr[oldlen - 1];
          ofr.length = oldlen - 1;

          if (this.persistent) {
            this.resultdata[oldPos] = this.resultdata[oldlen - 1];
            this.resultdata.length = oldlen - 1;
          }
        } else {
          ofr.length = oldlen - 1;

          if (this.persistent) {
            this.resultdata.length = oldlen - 1;
          }
        }

        return;
      }

      // was in resultset, should still be now... (update persistent only?)
      if (oldPos !== -1 && newPos !== -1) {
        if (this.persistent) {
          // in case document changed, replace persistent view data with the latest collection.data document
          this.resultdata[oldPos] = this.collection.data[objIndex];
        }

        // in case changes to data altered a sort column
        if (this.sortFunction || this.sortCriteria) {
          this.sortDirty = true;
        }

        return;
      }
    };

    /**
     * removeDocument() - internal function called on collection.delete()
     */
    DynamicView.prototype.removeDocument = function (objIndex) {
      var ofr = this.resultset.filteredrows;
      var oldPos = ofr.indexOf(objIndex);
      var oldlen = ofr.length;

      if (oldPos !== -1) {
        // if not last row in resultdata, swap last to hole and truncate last row
        if (oldPos < oldlen - 1) {
          ofr[oldPos] = ofr[oldlen - 1];
          ofr.length = oldlen - 1;

          this.resultdata[oldPos] = this.resultdata[oldlen - 1];
          this.resultdata.length = oldlen - 1;
        }
        // last row, so just truncate last row
        else {
          ofr.length = oldlen - 1;
          this.resultdata.length = oldlen - 1;
        }
      }
    };

    /**
     * mapReduce() - data transformation via user supplied functions
     *
     * @param {function} mapFunction - this function accepts a single document for you to transform and return
     * @param {function} reduceFunction - this function accepts many (array of map outputs) and returns single value
     * @returns The output of your reduceFunction
     */
    DynamicView.prototype.mapReduce = function (mapFunction, reduceFunction) {
      try {
        return reduceFunction(this.data().map(mapFunction));
      } catch (err) {
        throw err;
      }
    };


    /**
     * @constructor
     * Collection class that handles documents of same type
     * @param {stirng} collection name
     * @param {array} array of property names to be indicized
     * @param {object} configuration object
     */
    function Collection(name, options) {
      // the name of the collection

      this.name = name;
      // the data held by the collection
      this.data = [];
      this.idIndex = []; // index of id
      this.binaryIndices = {}; // user defined indexes
      // the object type of the collection
      this.objType = name;

      // in autosave scenarios we will use collection level dirty flags to determine whether save is needed.
      // currently, if any collection is dirty we will autosave the whole database if autosave is configured.
      this.dirty = false;

      // private holders for cached data
      this.cachedIndex = null;
      this.cachedBinaryIndex = null;
      this.cachedData = null;
      var self = this;

      /* OPTIONS */
      options = options || {};

      // is collection transactional
      this.transactional = options.hasOwnProperty('transactional') ? options.transactional : false;

      // options to clone objects when inserting them
      this.cloneObjects = options.hasOwnProperty('clone') ? options.clone : false;

      // option to make event listeners async, default is sync
      this.asyncListeners = options.hasOwnProperty('asyncListeners') ? options.asyncListeners : true;

      // disable track changes
      this.disableChangesApi = options.hasOwnProperty('disableChangesApi') ? options.disableChangesApi : true;

      // currentMaxId - change manually at your own peril!
      this.maxId = 0;

      this.DynamicViews = [];

      // events
      this.events = {
        'insert': [],
        'update': [],
        'close': [],
        'flushbuffer': [],
        'error': [],
        'delete': [],
        'warning': []
      };

      // changes are tracked by collection and aggregated by the db
      this.changes = [];

      // initialize the id index
      this.ensureId();
      var indices;
      // initialize optional user-supplied indices array ['age', 'lname', 'zip']
      //if (typeof (indices) !== 'undefined') {
      if (options) {
        indices = options.indices || [];
      } else {
        indices = [];
      }

      for (var idx = 0; idx < indices.length; idx++) {
        this.ensureIndex(indices[idx]);
      };

      /**
       * This method creates a clone of the current status of an object and associates operation and collection name,
       * so the parent db can aggregate and generate a changes object for the entire db
       */
      function createChange(name, op, obj) {
        self.changes.push({
          name: name,
          operation: op,
          obj: JSON.parse(JSON.stringify(obj))
        });
      }

      // clear all the changes
      function flushChanges() {
        self.changes = [];
      };

      this.getChanges = function () {
        return self.changes;
      };

      this.flushChanges = flushChanges;

      /**
       * If the changes API is disabled make sure only metadata is added without re-evaluating everytime if the changesApi is enabled
       */
      function insertMeta(obj) {
        if (!obj) {
          return;
        }
        if (!obj.meta) {
          obj.meta = {};
        }
        obj.meta.created = (new Date()).getTime();
        obj.meta.revision = 0;
      }

      function updateMeta(obj) {
        if (!obj) {
          return;
        }
        obj.meta.updated = (new Date()).getTime();
        obj.meta.revision += 1;
      }

      function createInsertChange(obj) {
        createChange(self.name, 'I', obj);
      }

      function createUpdateChange(obj) {
        createChange(self.name, 'U', obj);
      }

      function insertMetaWithChange(obj) {
        insertMeta(obj);
        createInsertChange(obj);
      }

      function updateMetaWithChange(obj) {
        updateMeta(obj);
        createUpdateChange(obj);
      }


      /* assign correct handler based on ChangesAPI flag */
      var insertHandler, updateHandler;

      function setHandlers() {
        insertHandler = self.disableChangesApi ? insertMeta : insertMetaWithChange;
        updateHandler = self.disableChangesApi ? updateMeta : updateMetaWithChange;
      }

      setHandlers();

      this.setChangesApi = function (enabled) {
        self.disableChangesApi = !enabled;
        setHandlers();
      };
      /**
       * built-in events
       */
      this.on('insert', function insertCallback(obj) {
        insertHandler(obj);
      });

      this.on('update', function updateCallback(obj) {
        updateHandler(obj);
      });

      this.on('delete', function deleteCallback(obj) {
        if (!self.disableChangesApi) {
          createChange(self.name, 'R', obj);
        }
      });

      this.on('warning', console.warn);
      // for de-serialization purposes
      flushChanges();
    }

    Collection.prototype = new LokiEventEmitter;

    /*----------------------------+
    | INDEXING                    |
    +----------------------------*/

    /**
     * Ensure binary index on a certain field
     */
    Collection.prototype.ensureIndex = function (property, force) {
      // optional parameter to force rebuild whether flagged as dirty or not
      if (typeof (force) === 'undefined') {
        force = false;
      }

      if (property === null || property === undefined) {
        throw 'Attempting to set index without an associated property';
      }

      if (this.binaryIndices.hasOwnProperty(property) && !force) {
        if (!this.binaryIndices[property].dirty) return;
      }

      this.binaryIndices[property] = {
        'name': property,
        'dirty': true,
        'values': []
      };

      var index, len = this.data.length,
        i = 0;

      index = this.binaryIndices[property];

      // initialize index values
      for (i; i < len; i += 1) {
        index.values.push(i);
      }

      var wrappedComparer =
        (function (prop, coll) {
          return function (a, b) {
            var obj1 = coll.data[a];
            var obj2 = coll.data[b];

            if (obj1[prop] === obj2[prop]) return 0;
            if (obj1[prop] > obj2[prop]) return 1;
            if (obj1[prop] < obj2[prop]) return -1;
          }
        })(property, this);

      index.values.sort(wrappedComparer);
      index.dirty = false;

      this.dirty = true; // for autosave scenarios
    };

    /**
     * Ensure all binary indices
     */
    Collection.prototype.ensureAllIndexes = function (force) {
      var objKeys = Object.keys(this.binaryIndices);

      var i = objKeys.length;
      while (i--) {
        this.ensureIndex(objKeys[i], force);
      }
    };

    Collection.prototype.flagBinaryIndexesDirty = function () {
      var objKeys = Object.keys(this.binaryIndices);

      var i = objKeys.length;
      while (i--) {
        this.binaryIndices[objKeys[i]].dirty = true;
      }
    };

    /**
     * Rebuild idIndex
     */
    Collection.prototype.ensureId = function () {

      var len = this.data.length,
        i = 0;

      this.idIndex = [];
      for (i; i < len; i += 1) {
        this.idIndex.push(this.data[i].$loki);
      }
    };

    /**
     * Rebuild idIndex async with callback - useful for background syncing with a remote server
     */
    Collection.prototype.ensureIdAsync = function (callback) {
      this.async(function () {
        this.ensureId();
      }, callback);
    };

    /**
     * Each collection maintains a list of DynamicViews associated with it
     **/

    Collection.prototype.addDynamicView = function (name, persistent) {
      var dv = new DynamicView(this, name, persistent);
      this.DynamicViews.push(dv);

      return dv;
    };

    Collection.prototype.removeDynamicView = function (name) {
      for (var idx = 0; idx < this.DynamicViews.length; idx++) {
        if (this.DynamicViews[idx].name === name) {
          this.DynamicViews.splice(idx, 1);
        }
      }
    };

    Collection.prototype.getDynamicView = function (name) {
      for (var idx = 0; idx < this.DynamicViews.length; idx++) {
        if (this.DynamicViews[idx].name === name) {
          return this.DynamicViews[idx];
        }
      }

      return null;
    };

    /**
     * find and update: pass a filtering function to select elements to be updated
     * and apply the updatefunctino to those elements iteratively
     */
    Collection.prototype.findAndUpdate = function (filterFunction, updateFunction) {

      var results = this.where(filterFunction),
        i = 0,
        obj;
      try {
        for (i; i < results.length; i++) {
          obj = updateFunction(results[i]);
          this.update(obj);
        }

      } catch (err) {
        this.rollback();
        console.error(err.message);
      }
    };

    /**
     * generate document method - ensure objects have id and objType properties
     * Come to think of it, really unfortunate name because of what document normally refers to in js.
     * that's why there's an alias below but until I have this implemented
     * @param {object} the document to be inserted (or an array of objects)
     * @returns document or documents (if array)
     */
    Collection.prototype.insert = function (doc) {
      var self = this;
      // holder to the clone of the object inserted if collections is set to clone objects
      var obj;
      if (Array.isArray(doc)) {
        doc.forEach(function (d) {
          if (self.clone) {
            obj = JSON.parse(JSON.stringify(d));
          } else {
            obj = d;
          }
          //d.objType = self.objType;
          if (typeof obj.meta === 'undefined') {
            obj.meta = {
              revision: 0,
              created: 0
            };
          }
          self.add(obj);
          self.emit('insert', obj);

        });
        return obj;
      } else {
        if (typeof doc !== 'object') {
          throw new TypeError('Document needs to be an object');
          return;
        }
        if (!doc) {
          var error = new Error('Object cannot be null');
          this.emit('error', error);
          throw error;
        }
        if (self.clone) {
          obj = JSON.parse(JSON.stringify(doc));
        } else {
          obj = doc;
        }
        //doc.objType = self.objType;

        if (typeof doc.meta === 'undefined') {
          obj.meta = {
            revision: 0,
            created: 0
          };
        }
        self.add(obj);
        self.emit('insert', obj);

        return obj;
      }
    };

    Collection.prototype.clear = function () {
      this.data = [];
      this.idIndex = [];
      this.binaryIndices = {};
      this.cachedIndex = null;
      this.cachedData = null;
      this.maxId = 0;
      this.DynamicViews = [];
      this.dirty = true;
    };

    /**
     * Update method
     */
    Collection.prototype.update = function (doc) {

      if (Object.keys(this.binaryIndices).length > 0) {
        this.flagBinaryIndexesDirty();
      }

      if (Array.isArray(doc)) {
        var k = 0,
          len = doc.length;
        for (k; k < len; k += 1) {
          this.update(doc[k]);
        }
        return;
      }

      // verify object is a properly formed document
      if (!doc.hasOwnProperty('$loki')) {
        throw 'Trying to update unsynced document. Please save the document first by using insert() or addMany()';
      }
      try {
        this.startTransaction();
        var i, arr = this.get(doc.$loki, true),
          obj,
          position;

        if (!arr) {
          throw new Error('Trying to update a document not in collection.');
        }

        obj = arr[0];

        // get current position in data array
        position = arr[1];

        // operate the update
        this.data[position] = doc;

        // now that we can efficiently determine the data[] position of newly added document,
        // submit it for all registered DynamicViews to evaluate for inclusion/exclusion
        for (var idx = 0; idx < this.DynamicViews.length; idx++) {
          this.DynamicViews[idx].evaluateDocument(position);
        }

        this.idIndex[position] = obj.$loki;

        this.commit();
        this.dirty = true; // for autosave scenarios
        this.emit('update', doc);

      } catch (err) {
        this.rollback();
        console.error(err.message);
        this.emit('error', err);
        throw (err); // re-throw error so user does not think it succeeded
      }
    };

    /**
     * Add object to collection
     */
    Collection.prototype.add = function (obj) {
      var i,
        dvlen = this.DynamicViews.length;

      // if parameter isn't object exit with throw
      if ('object' !== typeof obj) {
        throw 'Object being added needs to be an object';
      }
      /*
       * try adding object to collection
       */

      if (Object.keys(this.binaryIndices).length > 0) {
        this.flagBinaryIndexesDirty();
      }

      // if object you are adding already has id column it is either already in the collection
      // or the object is carrying its own 'id' property.  If it also has a meta property,
      // then this is already in collection so throw error, otherwise rename to originalId and continue adding.
      if (typeof (obj.$loki) !== "undefined") {
        throw 'Document is already in collection, please use update()';
      }

      try {
        this.startTransaction();
        this.maxId++;
        var i;

        if (isNaN(this.maxId)) {
          this.maxId = (this.data[this.data.length - 1].$loki + 1);
        }

        obj.$loki = this.maxId;
        obj.meta.version = 0;

        // add the object
        this.data.push(obj);

        // now that we can efficiently determine the data[] position of newly added document,
        // submit it for all registered DynamicViews to evaluate for inclusion/exclusion
        for (i = 0; i < dvlen; i++) {
          this.DynamicViews[i].evaluateDocument(this.data.length - 1);
        }

        // add new obj id to idIndex
        this.idIndex.push(obj.$loki);

        this.commit();
        this.dirty = true; // for autosave scenarios
        return obj;
      } catch (err) {
        this.rollback();
        console.error(err.message);
      }
    };

    /**
     * delete wrapped
     */
    Collection.prototype.remove = function (doc) {
      var self = this;
      if ('object' !== typeof doc) {
        throw new Error('Parameter is not an object');
      }
      if (Array.isArray(doc)) {
        var k = 0,
          len = doc.length;
        for (k; k < len; k += 1) {
          this.remove(doc[k]);
        }
        return;
      }

      if (!doc.hasOwnProperty('$loki')) {
        throw new Error('Object is not a document stored in the collection');
      }

      if (Object.keys(this.binaryIndices).length > 0) {
        this.flagBinaryIndexesDirty();
      }

      try {
        this.startTransaction();
        var arr = this.get(doc.$loki, true),
          // obj = arr[0],
          position = arr[1],
          i;

        // now that we can efficiently determine the data[] position of newly added document,
        // submit it for all registered DynamicViews to remove
        for (var idx = 0; idx < this.DynamicViews.length; idx++) {
          this.DynamicViews[idx].removeDocument(position);
        }

        this.data.splice(position, 1);

        // remove id from idIndex
        this.idIndex.splice(position, 1);

        this.commit();
        this.dirty = true; // for autosave scenarios
        this.emit('delete');

      } catch (err) {
        this.rollback();
        console.error(err.message);
        this.emit('error', err);
      }
    };

    /*---------------------+
    | Finding methods     |
    +----------------------*/

    /**
     * Get by Id - faster than other methods because of the searching algorithm
     */
    Collection.prototype.get = function (id, returnPosition) {
      var retpos = returnPosition || false,
        data = this.idIndex,
        max = data.length - 1,
        min = 0,
        mid = Math.floor(min + (max - min) / 2);

      if (isNaN(id)) {
        id = parseInt(id);
        if (isNaN(id)) {
          throw 'Passed id is not an integer';
        }
      }

      while (data[min] < data[max]) {

        mid = Math.floor((min + max) / 2);

        if (data[mid] < id) {
          min = mid + 1;
        } else {
          max = mid;
        }
      }

      if (max === min && data[min] === id) {

        if (retpos) {
          return [this.data[min], min];
        }
        return this.data[min];
      }
      return null;
    };

    /**
     * Find one object by index property, by property equal to value
     */
    Collection.prototype.findOne = function (query) {
      // Instantiate Resultset and exec find op passing firstOnly = true param
      var result = new Resultset(this, query, null, true);
      if (Array.isArray(result) && result.length === 0) {
        return null;
      } else {
        return result;
      }
    };

    /**
     * Chain method, used for beginning a series of chained find() and/or view() operations
     * on a collection.
     */
    Collection.prototype.chain = function () {
      return new Resultset(this, null, null);
    };

    /**
     * Find method, api is similar to mongodb except for now it only supports one search parameter.
     * for more complex queries use view() and storeView()
     */
    Collection.prototype.find = function (query) {
      if (typeof (query) === 'undefined') {
        query = 'getAll';
      }
      // find logic moved into Resultset class
      return new Resultset(this, query, null);
    };

    /**
     * Find object by unindexed field by property equal to value,
     * simply iterates and returns the first element matching the query
     */
    Collection.prototype.findOneUnindexed = function (prop, value) {

      var i = this.data.length,
        doc;
      while (i--) {
        if (this.data[i][prop] === value) {
          doc = this.data[i];
          return doc;
        }
      }
      return null;
    };

    /**
     * Transaction methods
     */

    /** start the transation */
    Collection.prototype.startTransaction = function () {
      if (this.transactional) {
        this.cachedData = clone(this.data, 'parse-stringify');
        this.cachedIndex = this.idIndex;
        this.cachedBinaryIndex = this.binaryIndices;

        // propagate startTransaction to dynamic views
        for (var idx = 0; idx < this.DynamicViews.length; idx++) {
          this.DynamicViews[idx].startTransaction();
        }
      }
    };

    /** commit the transation */
    Collection.prototype.commit = function () {
      if (this.transactional) {
        this.cachedData = null;
        this.cachedIndex = null;
        this.cachedBinaryIndices = null;

        // propagate commit to dynamic views
        for (var idx = 0; idx < this.DynamicViews.length; idx++) {
          this.DynamicViews[idx].commit();
        }
      }
    };

    /** roll back the transation */
    Collection.prototype.rollback = function () {
      if (this.transactional) {
        if (this.cachedData !== null && this.cachedIndex !== null) {
          this.data = this.cachedData;
          this.idIndex = this.cachedIndex;
          this.binaryIndices = this.cachedBinaryIndex;
        }

        // propagate rollback to dynamic views
        for (var idx = 0; idx < this.DynamicViews.length; idx++) {
          this.DynamicViews[idx].rollback();
        }
      }
    };

    // async executor. This is only to enable callbacks at the end of the execution.
    Collection.prototype.async = function (fun, callback) {
      setTimeout(function () {
        if (typeof fun === 'function') {
          fun();
          callback();
        } else {
          throw 'Argument passed for async execution is not a function';
        }
      }, 0);
    };

    /**
     * Create view function - filter
     */
    Collection.prototype.where = function (fun) {
      // find logic moved into Resultset class
      return new Resultset(this, null, fun);
    };

    /**
     * Map Reduce
     */
    Collection.prototype.mapReduce = function (mapFunction, reduceFunction) {
      try {
        return reduceFunction(this.data.map(mapFunction));
      } catch (err) {
        throw err;
      }
    };

    Collection.prototype.no_op = function () {
      return;
    };

    Loki.Collection = Collection;
    return Loki;
  }());

}));