/**
 * LokiJS
 * @author Joe Minichino <joe@dsforge.net>
 * 
 * A lightweight document oriented javascript database
 */


/**
 * Define library loki
 */

/*jslint browser: true, node: true, plusplus: true, indent: 2 */
 
var loki = (function () {
  'use strict';

  /**
   * @constructor
   * The main database class
   */
  function Loki(filename) {
    this.filename = filename || 'loki.db';
    this.collections = [];

    var getENV = function () {
      if ((typeof module !== 'undefined') && module.exports) {
        return 'NODEJS';
      }

      if (!(document === undefined)) {
        if (document.URL.indexOf('http://') === -1 && document.URL.indexOf('https://') === -1) {
          return 'CORDOVA';
        }
        return 'BROWSER';
      }
      return 'CORDOVA';
    };

    this.ENV = getENV();

    if (this.ENV === 'NODEJS') {
      this.fs = require('fs');
    }

  }

  /**
   * @constructor 
   * Collection class that handles documents of same type
   */
  function Collection(name, objType, indices, transactional) {
    // the name of the collection 
    this.name = name;
    // the data held by the collection
    this.data = [];
    // indices multi-dimensional array
    this.indices = {};
    this.idIndex = {}; // index of idx
    // the object type of the collection
    this.objType = objType || "";

    /** Transactions properties */
    // is collection transactional
    this.transactional = transactional || false;
    // private holders for cached data
    this.cachedIndex = null;
    this.cachedData = null;

    // currentMaxId - change manually at your own peril!
    this.maxId = 0;
    // view container is an object because each views gets a name
    this.Views = {};

    // pointer to self to avoid this tricks
    var indexesArray = indices || ['id'],
      i = indexesArray.length;

    while (i--) {
      this.ensureIndex(indexesArray[i]);
    }

    // initialize the id index
    this.ensureIndex('id');
  }

  Loki.prototype.addCollection = function (name, objType, indexesArray, transactional) {
    var collection = new Collection(name, objType, indexesArray, transactional);
    this.collections.push(collection);
    return collection;
  };

  Loki.prototype.loadCollection = function (collection) {
    this.collections.push(collection);
  };

  Loki.prototype.getCollection = function (collectionName) {
    var found = false,
      len = this.collections.length,
      i;

    for (i = 0; i < len; i += 1) {
      if (this.collections[i].name === collectionName) {
        found = true;
        return this.collections[i];
      }
    }
    if (!found) { throw 'No such collection'; }
  };

  Loki.prototype.listCollections = function () {

    var i = this.collections.length,
      colls = [];

    while (i--) {
      colls.push({ name: this.collections[i].name, type: this.collections[i].objType, count: this.collections[i].data.length });
    }
    return colls;
  };

  Loki.prototype.removeCollection = function (name) {
    var i = 0, len = this.collections.length;
    for (i; i < len; i += 1) {
      if (this.collections[i].name === name) {
        this.collections.splice(i, 1);
      }
    }
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

  // load Json function - db is saved to disk as json
  Loki.prototype.loadJSON = function (serializedDb) {

    var obj = JSON.parse(serializedDb),
      i = 0,
      len = obj.collections.length,
      coll,
      copyColl,
      clen,
      j;

    this.name = obj.name;
    this.collections = [];

    for (i; i < len; i += 1) {
      coll = obj.collections[i];
      copyColl = this.addCollection(coll.name, coll.objType);

      // load each element individually 
      clen = coll.data.length;
      j = 0;
      for (j; j < clen; j++) {
        copyColl.data[j] = coll.data[j];
      }

      copyColl.maxId = coll.data.maxId;
      copyColl.indices = coll.indices;
      copyColl.idIndex = coll.indices.id;
      copyColl.transactional = coll.transactional;
      copyColl.ensureAllIndexes();
    }
  };



  // load db from a file
  Loki.prototype.loadDatabase = function (callback) {
    var cFun = callback || function() { return; },
      self = this;

    if (this.ENV === 'NODEJS') {
      this.fs.readFile(this.filename, {encoding: 'utf8'}, function (err, data) {
        if (err) {
          throw err;
        }
        self.loadJSON(data);
        cFun(data);
      });
    }
  };

  // save file to disk as json
  Loki.prototype.saveToDisk = function (callback) {
    var cFun = callback || function() { return; },
      self = this;
    // persist in nodejs
    if (this.ENV === 'NODEJS') {
      this.fs.exists(this.filename, function (exists) {

        if (exists) {
          self.fs.unlink(self.filename);
        }

        self.fs.writeFile(self.filename, self.serialize(), function (err) {
          if (err) {
            throw err;
          }
          cFun();
        });
      });
    }
  };
  // alias
  Loki.prototype.save = Loki.prototype.saveToDisk;

  // future use for saving collections to remote db
  // Loki.prototype.saveRemote = Loki.prototype.no_op;


  /*----------------------------+
  | INDEXING                    |
  +----------------------------*/

  /**
   * Ensure indexes on a certain field
   */
  Collection.prototype.ensureIndex = function (property) {

    if (property === null || property === undefined) {
      throw 'Attempting to set index without an associated property';
    }

    var index, len = this.data.length, i = 0;
    if (this.indices.hasOwnProperty(property)) {
      index = this.indices[property];
    } else {
      this.indices[property] = [];
      index = this.indices[property];
    }

    for (i; i < len; i += 1) {
      index.push(this.data[i][property]);
    }
    if (property === 'id') {
      this.idIndex = index;
    }
  };

  /**
   * Ensure index async with callback - useful for background syncing with a remote server 
   */
  Collection.prototype.ensureIndexAsync = function (property, callback) {
    this.async(function () {
      this.ensureIndex(property);
    }, callback);
  };

  /**
   * Ensure all indexes
   */
  Collection.prototype.ensureAllIndexes = function () {
    var i = this.indices.length;
    while (i--) {
      this.ensureIndex(this.indices[i].name);
    }

    if (i === 0) {
      this.ensureIndex('id');
    }
  };

  Collection.prototype.ensureAllIndexesAsync = function (callback) {
    this.async(function () {
      this.ensureAllIndexes();
    }, callback);
  };

  /**
   * find and update: pass a filtering function to select elements to be updated
   * and apply the updatefunctino to those elements iteratively
   */
  Collection.prototype.findAndUpdate = function (filterFunction, updateFunction) {

    var results = this.view(filterFunction), i = 0, obj;
    try {
      for (i; i < results.length; i++) {
        obj = updateFunction(results[i]);
        this.update(obj);
      }

    } catch (err) {
      this.rollback();
    }
  };

  /**
   * generate document method - ensure objects have id and objType properties
   * Come to think of it, really unfortunate name because of what document normally refers to in js.
   * that's why there's an alias below but until I have this implemented 
   */
  Collection.prototype.insert = function (doc) {
    doc.id = null;
    doc.objType = this.objType;
    this.add(doc);
    return doc;
  };

  Collection.prototype.clear = function () {
    this.data = [];
    this.indices = {};
    this.idIndex = {};
    this.cachedIndex = null;
    this.cachedData = null;
    this.maxId = 0;
    this.Views = {};
  };

  /**
   * Update method
   */
  Collection.prototype.update = function (doc) {

    // verify object is a properly formed document
    if (!doc.hasOwnProperty('id')) {
      throw 'Trying to update unsynced document. Please save the document first by using add() or addMany()';
    }
    try {
      this.startTransaction();
      var i, arr = this.get(doc.id, true), obj = arr[0],
      // get current position in data array
        position = arr[1];
      // operate the update
      this.data[position] = doc;
      for (i in this.indices) {
        if (this.indices.hasOwnProperty(i)) {
          this.indices[i][position] = obj[i];
        }
      }
      this.commit();
    } catch (err) {
      this.rollback();
    }
  };

  /**
   * Add object to collection
   */
  Collection.prototype.add = function (obj) {

    // if parameter isn't object exit with throw
    if ('object' !== typeof obj) {
      throw 'Object being added needs to be an object';
    }
    /*
     * try adding object to collection
     */
    if (this.objType === "" && this.data.length === 0) {

      // set object type to that of the first object added to collection
      this.objType = obj.objType;

    } else {

      // throw an error if the object added is not the same type as the collection's
      if (this.objType !== obj.objType) {
        throw 'Object type [' + obj.objType + '] is incongruent with collection type [' + this.objType + ']';
      }
      if (this.objType === '') {
        throw 'Object is not a model';
      }

      if (obj.id !== null && obj.id > 0) {
        throw 'Document is already in collection, please use update()';
      }
      try {

        this.startTransaction();
        this.maxId++;
        var i;

        if (isNaN(this.maxId)) {
          this.maxId = (this.data[this.data.length - 1].id + 1);
        }

        obj.id = this.maxId;
        // add the object
        this.data.push(obj);

        // resync indexes to make sure all IDs are there
        for (i in this.indices) {
          if (this.indices.hasOwnProperty(i)) {
            this.indices[i].push(obj[i]);
          }
        }
        this.commit();
        return obj;
      } catch (err) {
        this.rollback();
      }
    }
  };

  /**
   * iterate through arguments and add indexes 
   */
  Collection.prototype.addMany = function () {
    var i = arguments.length;
    while (i--) {
      this.add(arguments[i]);
    }
  };


  /**
   * delete wrapped
   */
  Collection.prototype.remove = function (doc) {
    if ('object' !== typeof doc) {
      throw 'Parameter is not an object';
    }

    if (!doc.hasOwnProperty('id')) {
      throw 'Object is not a document stored in the collection';
    }

    try {
      this.startTransaction();
      var arr = this.get(doc.id, true),
        // obj = arr[0],
        position = arr[1],
        i;

      this.data.splice(position, 1);

      for (i in this.indices) {
        if (this.indices.hasOwnProperty(i)) {
          this.indices[i].splice(position, 1);
        }
      }
      this.commit();

    } catch (err) {
      this.rollback();
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
      data = this.indices.id,
      max = data.length - 1,
      min = 0,
      mid = Math.floor(min + (max - min) / 2);

    if(isNaN(id)){
      id = parseInt(id);
      if(isNaN(id)){
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
  Collection.prototype.findOne = function (prop, value) {

    var searchByIndex = false,
      indexObject = null,
      // iterate the indices to ascertain whether property is indexed
      i = this.indices.length,
      len,
      doc;
    for (i in this.indices) {
      if (this.indices.hasOwnProperty(i)) {
        if (i === prop) {
          searchByIndex = true;
          indexObject = this.indices[i];
          break;
        }
      }
    }

    if (searchByIndex) {
      // perform search based on index
      len = indexObject.data.length;
      while (len--) {
        if (indexObject.data[len] === value) {
          doc = this.data[len];
          return doc;
        }
      }

    } else {
      // search all collection and find first matching result
      return this.findOneUnindexed(prop, value);
    }
    return null;
  };

  /**
   * Find method, api is similar to mongodb except for now it only supports one search parameter.
   * for more complex queries use view() and storeView()
   */
  Collection.prototype.find = function (query) {
    // comparison operators
    function $eq(a, b) { return a === b; }
    function $gt(a, b) { return a > b; }
    function $gte(a, b) { return a >= b; }
    function $lt(a, b) { return a < b; }
    function $lte(a, b) { return a <= b; }
    function $ne(a, b) { return a !== b; }

    var queryObject = query || 'getAll',
      property,
      value,
      operator,
      p,
      key,
      operators = {
        '$eq': $eq,
        '$gt': $gt,
        '$gte': $gte,
        '$lt': $lt,
        '$lte': $lte,
        '$ne' : $ne
      },
      searchByIndex = false,
      index = null,
      len = this.indices.length,
      // the result array
      res = [],
      // comparison function
      fun,
      // collection data
      t,
      // collection data length
      i;

    if (queryObject === 'getAll') {
      return this.data;
    }

    for (p in queryObject) {

      if (queryObject.hasOwnProperty(p)) {
        property = p;
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

    if (this.data === null) {
      throw new TypeError();
    }

    while (len--) {
      if (this.indices[len].name === property) {
        searchByIndex = true;
        index = this.indices[len];
      }
    }

    // the comparison function
    fun = operators[operator];

    if (!searchByIndex) {
      t = this.data;
      i = t.length;
      while (i--) {
        if (fun(t[i][property], value)) {
          res.push(t[i]);
        }
      }
    } else {
      t = index.data;
      i = t.length;
      while (i--) {
        if (fun(t[i], value)) {
          res.push(this.data[i]);
        }
      }
    }
    return res;

  };

  /**
   * Find object by unindexed field by property equal to value, 
   * simply iterates and returns the first element matching the query
   */
  Collection.prototype.findOneUnindexed = function (prop, value) {

    var i = this.data.length, doc;
    while (i--) {
      if (this.data[i][prop] === value) {
        doc = this.data[i];
        return doc;
      }

    }
    return null;
  };

  /** roll back the transation */
  Collection.prototype.rollback = function () {
    if (this.transactional) {
      if (this.cachedData !== null && this.cachedIndex !== null) {
        this.data = this.cachedData;
        this.indices = this.cachedIndex;
      }
    }
  };

  /**
   * Transaction methods 
   */

  /** start the transation */
  Collection.prototype.startTransaction = function () {
    if (this.transactional) {
      this.cachedData = this.data;
      this.cachedIndex = this.indices;
    }
  };

  /** commit the transation */
  Collection.prototype.commit = function () {
    if (this.transactional) {
      this.cachedData = null;
      this.cachedIndex = null;
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
   * Create view function - CouchDB style
   */
  Collection.prototype.view = function (fun) {
    var viewFunction,
      result = [],
      i = this.data.length;

    if (('string' === typeof fun) && ('function' === typeof this.Views[fun])) {
      viewFunction = this.Views[fun];
    } else if ('function' === typeof fun) {
      viewFunction = fun;
    } else {
      throw 'Argument is not a stored view or a function';
    }
    try {
      while (i--) {
        if (viewFunction(this.data[i]) === true) {
          result[i] = this.data[i];
        }
      }
      return result;
    } catch (err) {
      throw err;
    }
  };

  /**
   * store a view in the collection for later reuse
   */
  Collection.prototype.storeView = function (name, fun) {
    if (typeof fun === 'function') {
      this.Views[name] = fun;
    }
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

  return Loki;
}());

if ('undefined' !== typeof module && module.exports) {
  module.exports = loki;
}