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

  function clone(data, method) {
    var cloneMethod = method || 'parse-stringify',
      cloned;
    if (cloneMethod === 'parse-stringify') {
      cloned = JSON.parse(JSON.stringify(data));
    }
    return cloned;
  }

  function EventEmitter() {}

  EventEmitter.prototype.events = {};

  EventEmitter.prototype.on = function (eventName, listener) {
    var event = this.events[eventName];
    if (!event) {
      event = this.events[eventName] = [];
    }
    return event.push(listener) - 1;
  };

  EventEmitter.prototype.emit = function (eventName, arg) {
    if (this.events[eventName]) {
      var self = this;
      setTimeout(function () {
        self.events[eventName].forEach(function (listener) {
          if (Array.isArray(arg)) {
            listener.apply(null, arg);
          } else {
            listener.call(null, arg);
          }
        });
      }, 1);
      return;
    } else {
      throw new Error('No event ' + eventName + ' defined');
    }
  };

  EventEmitter.prototype.remove = function (eventName, index) {
    if (this.events[eventName]) {
      this.events[eventName].splice(index, 1);
    }
  };

  /**
   * @constructor
   * The main database class
   */
  function Loki(filename) {
    this.filename = filename || 'loki.db';
    this.collections = [];
    this.events = {
      'close': []
    };

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

  Loki.prototype = new EventEmitter;
  Loki.prototype.close = function (callback) {
    if (callback) {
      this.on('close', callback);
    }
    this.emit('close');
  };

  /**
   * @constructor
   * Resultset class allowing chainable queries.  Intended to be instanced internally.
   *
   * Collection.find(), Collection.view(), and Collection.chain() instantiate this resultset
   * Examples:
   *  mycollection.chain().view("Toyota").find({ "doors" : 4 }).data();
   *  mycollection.view("Toyota");
   *  mycollection.find({ "doors": 4 });
   * When using .chain(), any number of view() and data() calls can be chained together to further filter
   * resultset, ending the chain with a .data() call to return as an array of collection document objects.
   */
  function Resultset(collection, queryObj, queryFunc) {
    // retain reference to collection we are querying against
    this.collection = collection;

    // if chain() instantiates with null queryObj and queryFunc, so we will keep flag for later
    this.searchIsChained = (!queryObj && !queryFunc);
    this.filteredrows = [];
    this.filterInitialized = false;

    // if user supplied initial queryObj or queryFunc, apply it 
    if (queryObj != null) return this.find(queryObj);
    if (queryFunc != null) return this.where(queryFunc);

    // otherwise return unfiltered Resultset for future filtering 
    return this;
  }

  Resultset.prototype.toJSON = function () {
    var copy = this.copy();
    copy.collection = null;
    return copy;
  }

  // limit() : allows you to limit the number of documents in the resultset (starting at 0).
  // A resultset copy() is made to avoid altering original resultset, 
  //   so future chain ops will not propagate back to original resultset
  //
  // Example :
  //   - You establish your resultset (directly or via a DynamicView)
  //   - You can then get documents 10-15 (array pos 9..14) via : results.offset(10).limit(5).data();
  Resultset.prototype.limit = function (qty) {
    // if this is chained resultset with no filters applied, just we need to populate filteredrows first
    if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length == 0) {
      this.filteredrows = Object.keys(this.collection.data);
    }

    var rscopy = this.copy();

    rscopy.filteredrows = rscopy.filteredrows.slice(0, qty);

    return rscopy;
  }

  // offset() : zero based pos allows you to skip the first pos+1 documents in the resultset
  // An offset(5) will start at the sixth document at array resultset.filteredrows[5]
  Resultset.prototype.offset = function (pos) {
    // if this is chained resultset with no filters applied, just we need to populate filteredrows first
    if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length == 0) {
      this.filteredrows = Object.keys(this.collection.data);
    }

    var rscopy = this.copy();

    rscopy.filteredrows = rscopy.filteredrows.splice(pos);

    return rscopy;
  }

  // To support reuse of resultset in forked query situations use copy()
  Resultset.prototype.copy = function () {
    var result = new Resultset(this.collection, null, null);

    result.filteredrows = this.filteredrows.slice();
    result.filterInitialized = this.filterInitialized;

    return result;
  }

  // User supplied compare function is provided two documents to compare. (chainable)
  // Example:
  // rslt.sort(function(obj1, obj2) { 
  //   if (obj1.name == obj2.name) return 0;
  //   if (obj1.name > obj2.name) return 1;
  //   if (obj1.name < obj2.name) return -1;
  // });
  Resultset.prototype.sort = function (comparefun) {
    // if this is chained resultset with no filters applied, just we need to populate filteredrows first
    if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length == 0) {
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
  }

  // Simpler, loose evaluation for user to sort based on a property name. (chainable)
  // Example :
  // rslt.simplesort("name");
  Resultset.prototype.simplesort = function (propname, isdesc) {
    // if this is chained resultset with no filters applied, just we need to populate filteredrows first
    if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length == 0) {
      this.filteredrows = Object.keys(this.collection.data);
    }

    if (typeof (isdesc) == "undefined") isdesc = false;

    var wrappedComparer =
      (function (prop, desc, rslt) {
        return function (a, b) {
          var obj1 = rslt.collection.data[a];
          var obj2 = rslt.collection.data[b];

          if (obj1[prop] == obj2[prop]) return 0;

          if (desc) {
            if (obj1[prop] < obj2[prop]) return 1;
            if (obj1[prop] > obj2[prop]) return -1;
          } else {
            if (obj1[prop] > obj2[prop]) return 1;
            if (obj1[prop] < obj2[prop]) return -1;
          }
        }
      })(propname, isdesc, this);

    this.filteredrows.sort(wrappedComparer);

    return this;
  }

  // binary search utility method to find segment of values matching criteria
  // this is used for collection.find() and first find filter of resultset/dynview
  // slightly different than get() binary search in that get() hones in on 1 value,
  // but we have to hone in on many (range)
  // returns array of [start, end] index array positions 
  Resultset.prototype.calcseg = function calcseg(op, prop, val, rst) {
    var rcd = rst.collection.data;
    var index = rst.collection.binaryIndices[prop].values;
    var min = 0;
    var max = index.length - 1;
    var mid = null;

    var minVal = rcd[index[min]][prop];
    var maxVal = rcd[index[max]][prop];

    // if value falls outside of our range return [0, -1] to designate
    // no results
    if (val < minVal || val > maxVal) return [0, -1];

    // hone in on start and end positions of value
    while (rcd[index[min]][prop] < rcd[index[max]][prop]) {
      mid = Math.floor((min + max) / 2);

      if (rcd[index[mid]][prop] < val) {
        min = mid + 1;
      } else {
        max = mid;
      }
    }

    switch (op) {
    case "$eq":
      return [min, max];
    case "$gt":
      return [max, rcd.length];
    case "$gte":
      return [max, rcd.length - 1]; // should be at least 1 or we would have existed at beginning
    case "$lt":
      return [0, min - 1]; // should be at least 1 or we would have existed at beginning
    case "$lte":
      return [0, min];
    case "$ne":
      // ne is weird case we may be able to return two ranges before[] and after[]
      // but for now just do full array scan
      return [0, rcd.length];
    default:
      return [0, rcd.length];
    }
  }

  // Resultset.find() returns reference to 'this' Resultset, use data() to get rowdata
  Resultset.prototype.find = function (query) {
    // comparison operators
    function $eq(a, b) {
      return a === b;
    }

    function $gt(a, b) {
      return a > b;
    }

    function $gte(a, b) {
      return a >= b;
    }

    function $lt(a, b) {
      return a < b;
    }

    function $lte(a, b) {
      return a <= b;
    }

    function $ne(a, b) {
      return a !== b;
    }

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
        '$ne': $ne
      },
      searchByIndex = false,
      result = [],
      index = null,
      // comparison function
      fun,
      // collection data
      t,
      // collection data length
      i;

    // apply no filters if they want all
    if (queryObject === 'getAll') {
      return this;
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

    if (this.collection.data === null) {
      throw new TypeError();
    }

    // if an index exists for the property being queried against, use it
    // for now only enabling for non-chained query (who's set of docs matches index)
    // or chained queries where it is the first filter applied and prop is indexed
    if ((!this.searchIsChained || (this.searchIsChained && !this.filterInitialized)) && this.collection.binaryIndices.hasOwnProperty(property)) {
      // this is where our lazy index rebuilding will take place
      // basically we will leave all indexes dirty until we need them
      // so here we will rebuild only the index tied to this property
      // ensureBinaryIndex() will only rebuild if flagged as dirty since we are not passing force=true param
      this.collection.ensureBinaryIndex(property);

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
        while (i--) {
          if (fun(t[i][property], value)) {
            result.push(t[i]);
          }
        }
      } else {
        // searching by binary index via calcseg() util method
        t = this.collection.data;
        var seg = this.calcseg(operator, property, value, this);

        for (var idx = seg[0]; idx <= seg[1]; idx++) {
          result.push(t[index.values[idx]]);
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
        if (!searchByIndex) {
          t = this.collection.data;
          i = this.filteredrows.length;
          while (i--) {
            if (fun(t[this.filteredrows[i]][property], value)) {
              result.push(this.filteredrows[i]);
            }
          }
        } else {
          t = index;
          i = this.filteredrows.length; //t.length;
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
        if (!searchByIndex) {
          t = this.collection.data;
          i = t.length;
          while (i--) {
            if (fun(t[i][property], value)) {
              result.push(i);
            }
          }
        } else {
          t = this.collection.data;
          var seg = this.calcseg(operator, property, value, this);

          for (var idx = seg[0]; idx <= seg[1]; idx++) {
            result.push(t[index.values[idx]]);
          }

          this.filteredrows = result;
        }

        this.filteredrows = result;
        this.filterInitialized = true; // next time work against filteredrows[]

        return this;
      }

    }
  }


  // Resultset.where() returns reference to 'this' Resultset, use data() to get rowdata
  Resultset.prototype.where = function (fun) {

    var viewFunction,
      result = [];

    if (('string' === typeof fun) && ('function' === typeof this.collection.Views[fun])) {
      viewFunction = this.collection.Views[fun];
    } else if ('function' === typeof fun) {
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
  }

  // Resultset.data() returns array or filtered documents 
  Resultset.prototype.data = function () {
    var result = [];

    // if this is chained resultset with no filters applied, just return collection.data
    if (this.searchIsChained && !this.filterInitialized) {
      if (this.filteredrows.length == 0) {
        return this.collection.data;
      } else {
        // filteredrows must have been set manually, so use it
        this.filterInitialized = true;
      }
    }

    for (var i in this.filteredrows) {
      result.push(this.collection.data[this.filteredrows[i]]);
    }

    return result;
  }

  /**
   * @constructor
   * DynamicView class is a versatile 'live' view class which is optionally persistent
   *
   * Collection.addDynamicView(name) instantiates this DynamicView object
   *
   * Examples:
   *	var mydv = mycollection.addDynamicView("test");  // default is non-persistent
   *	mydv.applyWhere(function(obj) { return obj.name == "Toyota"; });
   *	mydv.applyFind({ "doors" : 4 });
   * 	var results = mydv.data();
   *
   * Chaining is supported on apply functions : applyWhere().applyFind().data() is valid
   */
  function DynamicView(collection, name, persistent) {
    this.collection = collection;
    this.name = name;

    this.persistent = false;
    if (typeof (persistent) != "undefined") this.persistent = persistent;

    this.resultset = new Resultset(collection)
    this.resultdata = [];
    this.resultsdirty = false;

    this.cachedresultset = null;

    // keep ordered filter pipeline
    this.filterPipeline = [];

    // sorting member variables 
    // we only support one active search, applied using applySort() or applySimpleSort()
    this.sortFunction = null;
    this.sortColumn = null;
    this.sortColumnDesc = false;
    this.sortDirty = false;

    // may add map and reduce phases later
  }

  DynamicView.prototype.toJSON = function () {
    var copy = new DynamicView(this.collection, this.name, this.persistent);

    copy.resultset = this.resultset;
    copy.resultdata = this.resultdata;
    copy.resultsdirty = this.resultsdirty;
    copy.filterPipeline = this.filterPipeline;
    copy.sortFunction = this.sortFunction;
    copy.sortColumn = this.sortColumn;
    copy.sortColumnDesc = this.sortColumnDesc;
    copy.sortDirty = this.sortDirty;

    // avoid circular reference, reapply in db.loadJSON()
    copy.collection = null;

    return copy;
  }

  DynamicView.prototype.applySort = function (comparefun) {
    this.sortFunction = comparefun;
    this.sortColumn = null;
    this.sortColumnDesc = false;

    this.resultset.sort(comparefun);

    this.sortDirty = false;

    return this;
  }

  DynamicView.prototype.applySimpleSort = function (propname, isdesc) {
    if (typeof (isdesc) == "undefined") isdesc = false;

    this.sortColumn = propname;
    this.sortColumnDesc = isdesc;
    this.sortFunction = null;

    this.resultset.simplesort(propname, isdesc);

    this.sortDirty = false;

    return this;
  }

  DynamicView.prototype.startTransaction = function () {
    this.cachedresultset = this.resultset.copy();
  }

  DynamicView.prototype.commit = function () {
    this.cachedresultset = null;
  }

  DynamicView.prototype.rollback = function () {
    this.resultset = this.cachedresultset;

    if (this.persistent) {
      // i don't like the idea of keeping duplicate cached rows for each (possibly) persistent view
      // so we will for now just rebuild the persistent dynamic view data in this worst case scenario
      // (a persistent view utilizing transactions which get rolled back), we already know the filter so not too bad.
      this.resultdata = this.resultset.data();
    }
  }

  DynamicView.prototype.applyFind = function (query) {
    this.filterPipeline.push({
      type: 'find',
      val: query
    });

    // Apply immediately to Resultset; if persistent we will wait until later to build internal data
    this.resultset.find(query);

    this.sortDirty = true;
    if (this.persistent) this.resultsdirty = true;

    return this;
  }

  DynamicView.prototype.applyWhere = function (fun) {
    this.filterPipeline.push({
      type: 'where',
      val: fun
    });

    // Apply immediately to Resultset; if persistent we will wait until later to build internal data
    this.resultset.where(fun);

    this.sortDirty = true;
    if (this.persistent) this.resultsdirty = true;

    return this;
  }

  // will either build a resultset array or (if persistent) return reference to persistent data array
  DynamicView.prototype.data = function () {
    if (this.sortDirty) {
      if (this.sortFunction) this.resultset.sort(this.sortFunction);
      if (this.sortColumn) this.resultset.simplesort(this.sortColumn, this.sortColumnDesc);
      this.sortDirty = false;
      if (this.persistent) this.resultsdirty = true; // newly sorted, if persistent we need to rebuild resultdata
    }

    // if nonpersistent return resultset data evaluation
    if (!this.persistent) {
      return this.resultset.data();
    }

    // Persistent Views - we pay price of bulk row copy on first data() access after new filters applied
    if (this.resultsdirty) {
      this.resultdata = this.resultset.data();
      this.resultsdirty = false;
    }

    return this.resultdata;
  }

  // internal function called on collection.insert() and collection.update()
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
      case "find":
        evalResultset.find(this.filterPipeline[idx].val);
        break;
      case "where":
        evalResultset.where(this.filterPipeline[idx].val);
        break;
      }
    }

    // not a true position, but -1 if not pass our filter(s), 0 if passed filter(s)
    var newPos = (evalResultset.filteredrows.length == 0) ? -1 : 0;

    // wasn't in old, shouldn't be now... do nothing
    if (oldPos == -1 && newPos == -1) return;

    // wasn't in resultset, should be now... add
    if (oldPos == -1 && newPos != -1) {
      ofr.push(objIndex);

      if (this.persistent) this.resultdata.push(this.collection.data[objIndex]);

      // need to re-sort to sort new document
      if (this.sortFunction || this.sortColumn) this.sortDirty = true;

      return;
    }

    // was in resultset, shouldn't be now... delete
    if (oldPos != -1 && newPos == -1) {
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

        if (this.persistent) this.resultdata.length = oldlen - 1;
      }

      return;
    }

    // was in resultset, should still be now... (update persistent only?)
    if (oldPos != -1 && newPos != -1) {
      if (this.persistent) {
        // in case document changed, replace persistent view data with the latest collection.data document
        this.resultdata[oldPos] = this.collection.data[objIndex];
      }

      // in case changes to data altered a sort column
      if (this.sortFunction || this.sortColumn) this.sortDirty = true;

      return;
    }
  }

  // internal function called on collection.delete()
  DynamicView.prototype.removeDocument = function (objIndex) {
    var ofr = this.resultset.filteredrows;
    var oldPos = ofr.indexOf(objIndex);
    var oldlen = ofr.length;

    if (oldPos != -1) {
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
  }


  /**
   * @constructor
   * Collection class that handles documents of same type
   */
  function Collection(name, objType, indices, transactionOptions) {
    // the name of the collection 
    this.name = name;
    // the data held by the collection
    this.data = [];
    // indices multi-dimensional array
    //this.indices = {};
    this.binaryIndices = {};
    this.idIndex = {}; // index of idx
    // the object type of the collection
    this.objType = objType || "";

    /** Transactions properties */
    // is collection transactional
    this.transactional = transactionOptions || false;
    // private holders for cached data
    this.cachedIndex = null;
    this.cachedBinaryIndex = null;
    this.cachedData = null;

    // currentMaxId - change manually at your own peril!
    this.maxId = 0;
    // view container is an object because each views gets a name
    this.Views = {};

    this.DynamicViews = [];

    // events 
    this.events = {
      'insert': [],
      'update': [],
      'close': [],
      'flushbuffer': [],
      'error': [],
      'delete': []
    };

    // initialize the id index
    this.ensureIndex();
  }

  Collection.prototype = new EventEmitter;

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
    if (!found) {
      throw 'No such collection';
    }
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

  Loki.prototype.removeCollection = function (name) {
    var i = 0,
      len = this.collections.length;
    for (i; i < len; i += 1) {
      if (this.collections[i].name === name) {
        this.collections.splice(i, 1);
        break;
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

      copyColl.maxId = (coll.data.length == 0) ? 0 : coll.data.maxId;
	  copyColl.idIndex = coll.idIndex;
	  // if saved in previous format recover id index out of it
	  if (typeof (coll.indices) != "undefined") copyColl.idIndex = coll.indices.id;
      if (typeof (coll.binaryIndices) != "undefined") copyColl.binaryIndices = coll.binaryIndices;
      copyColl.transactional = coll.transactional;
      copyColl.ensureIndex();

      // in case they are loading a database created before we added dynamic views, handle undefined
      if (typeof (coll.DynamicViews) == "undefined") continue;

      // reinflate DynamicViews and attached Resultsets
      for (var idx = 0; idx < coll.DynamicViews.length; idx++) {
        var colldv = coll.DynamicViews[idx];

        var dv = copyColl.addDynamicView(colldv.name, colldv.persistent);
        dv.resultdata = colldv.resultdata;
        dv.resultsdirty = colldv.resultsdirty;
        dv.filterPipeline = colldv.filterPipeline;
        dv.sortColumn = colldv.sortColumn;
        dv.sortColumnDesc = colldv.sortColumnDesc;
        dv.sortFunction = colldv.sortFunction;
        dv.sortDirty = colldv.sortDirty;
        dv.resultset.filteredrows = colldv.resultset.filteredrows;
        dv.resultset.searchIsChained = colldv.resultset.searchIsChained;
        dv.resultset.filterInitialized = colldv.resultset.filterInitialized;
      }
    }
  };



  // load db from a file
  Loki.prototype.loadDatabase = function (callback) {
    var cFun = callback || function () {
        return;
      },
      self = this;

    if (this.ENV === 'NODEJS') {
      this.fs.readFile(this.filename, {
        encoding: 'utf8'
      }, function (err, data) {
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
    var cFun = callback || function () {
        return;
      },
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
   * Ensure binary index on a certain field
   */
  Collection.prototype.ensureBinaryIndex = function (property, force) {
    // optional parameter to force rebuild whether flagged as dirty or not
    if (typeof (force) == "undefined") force = false;

    if (property === null || property === undefined) {
      throw 'Attempting to set index without an associated property';
    }

    if (this.binaryIndices.hasOwnProperty(property) && !force) {
      if (!this.binaryIndices[property].dirty) return;
    } else {
      this.binaryIndices[property] = {
        "name": property,
        "dirty": true,
        "values": []
      };
    }

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

          if (obj1[prop] == obj2[prop]) return 0;
          if (obj1[prop] > obj2[prop]) return 1;
          if (obj1[prop] < obj2[prop]) return -1;
        }
      })(property, this);

    index.values.sort(wrappedComparer);
    index.dirty = false;
  };

  /**
   * Ensure all binary indices
   */
  Collection.prototype.ensureAllBinaryIndexes = function (force) {
    var i = this.binaryIndices.length;
    while (i--) {
      this.ensureBinaryIndex(this.binaryIndices[i].name, force);
    }

    this.binaryIndicesDirty = false;
  };

  Collection.prototype.flagBinaryIndexesDirty = function () {
    var i = this.binaryIndices.length;
    while (i--) {
      this.binaryIndices[i].dirty = true;
    }
  }

  /**
   * Rebuild idIndex 
   */
  Collection.prototype.ensureIndex = function () {

	var len = this.data.length, i = 0;

	this.idIndex = [];
    for (i; i < len; i += 1) {
      this.idIndex.push(this.data[i].id);
    }
  };

  /**
   * Rebuild idIndex async with callback - useful for background syncing with a remote server
   */
  Collection.prototype.ensureIndexAsync = function (callback) {
    this.async(function () {
      this.ensureIndex();
    }, callback);
  };

  /**
   * Each collection maintains a list of DynamicViews associated with it
   **/

  Collection.prototype.addDynamicView = function (name, persistent) {
    var dv = new DynamicView(this, name, persistent);
    this.DynamicViews.push(dv);

    return dv;
  }

  Collection.prototype.removeDynamicView = function (name) {
    for (var idx = 0; idx < this.DynamicViews.length; idx++) {
      if (this.DynamicViews[idx].name == name) {
        this.DynamicViews.splice(idx, 1);
      }
    }
  }

  Collection.prototype.getDynamicView = function (name) {
    for (var idx = 0; idx < this.DynamicViews.length; idx++) {
      if (this.DynamicViews[idx].name == name) {
        return this.DynamicViews[idx];
      }
    }
  }

  /**
   * find and update: pass a filtering function to select elements to be updated
   * and apply the updatefunctino to those elements iteratively
   */
  Collection.prototype.findAndUpdate = function (filterFunction, updateFunction) {

    var results = this.view(filterFunction),
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
   */
  Collection.prototype.insert = function (doc) {
    var self = this;

    if (this.binaryIndices.length > 0) this.flagBinaryIndexesDirty();

    if (Array.isArray(doc)) {
      doc.forEach(function (d) {
        d.id = null;
        d.objType = self.objType;
        self.add(d);
      });
      this.emit('insert', doc);
      return doc;
    } else {
      if (typeof doc !== 'object') {
        throw new TypeError("Document needs to be an object");
        return;
      }
      if (!doc) {
        var error = new Error('Object cannot be null');
        this.emit('error', error);
        throw error;
      }
      doc.id = null;
      doc.objType = this.objType;
      this.add(doc);
      this.emit('insert', doc);
      return doc;
    }

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

    if (this.binaryIndices.length > 0) this.flagBinaryIndexesDirty();

    // verify object is a properly formed document
    if (!doc.hasOwnProperty('id')) {
      throw 'Trying to update unsynced document. Please save the document first by using add() or addMany()';
    }
    try {
      this.startTransaction();
      var i, arr = this.get(doc.id, true),
        obj = arr[0],
        // get current position in data array
        position = arr[1];
        
      // operate the update
      this.data[position] = doc;

      // now that we can efficiently determine the data[] position of newly added document,
      // submit it for all registered DynamicViews to evaluate for inclusion/exclusion
      for (var idx = 0; idx < this.DynamicViews.length; idx++) {
        this.DynamicViews[idx].evaluateDocument(position);
      }

      this.idIndex[position] = obj.id;
		  
      this.commit();
      this.emit('update', doc);
    } catch (err) {
      this.rollback();
      console.error(err.message);
      this.emit('error', err);
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

        // now that we can efficiently determine the data[] position of newly added document,
        // submit it for all registered DynamicViews to evaluate for inclusion/exclusion
        for (var idx = 0; idx < this.DynamicViews.length; idx++) {
          this.DynamicViews[idx].evaluateDocument(this.data.length - 1);
        }

        // now that we can efficiently determine the data[] position of newly added document,
        // submit it for all registered DynamicViews to evaluate for inclusion/exclusion
        for (var idx = 0; idx < this.DynamicViews.length; idx++) {
          this.DynamicViews[idx].evaluateDocument(this.data.length - 1);
        }

        // add new obj id to idIndex
        this.idIndex.push(obj.id);
		
        this.commit();
        return obj;
      } catch (err) {
        this.rollback();
        console.error(err.message);
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

    if (this.binaryIndices.length > 0) this.flagBinaryIndexesDirty();

    try {
      this.startTransaction();
      var arr = this.get(doc.id, true),
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
  Collection.prototype.findOne = function (prop, value) {

    var searchByIndex = false,
      indexObject = null,
      // iterate the indices to ascertain whether property is indexed
      i = this.indices.length,
      len,
      doc;
	  
	  // this method will probably be replaced with find() overload 
	  // for now just run unindexed since no value-cache indexes exist anymore 
	  // if finding by id, use get instead
      return this.findOneUnindexed(prop, value);
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
  Collection.prototype.view = function (fun) {
    // find logic moved into Resultset class
    return new Resultset(this, null, fun);
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