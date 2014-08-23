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
   * Resultset class allowing chainable queries.  Intended to be instanced internally.
   *
   * Collection.find(), Collection.view(), and Collection.chain() instantiate this resultset 
   * Examples:
   *	mycollection.chain().view("Toyota").find({ "doors" : 4 }).data();
   * 	mycollection.view("Toyota");
   *	mycollection.find({ "doors": 4 });
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
	if (queryFunc != null) return this.view(queryFunc);
	
	// otherwise return unfiltered Resultset for future filtering 
	return this;
  }
  
  // To support reuse of resultset in forked query situations use copy()
  Resultset.prototype.copy = function() {
		var result = new Resultset(this.collection, null, null);
		
		result.filteredrows = this.filteredrows;
		
		return result;
  }
  
  // Resultset.find() returns reference to 'this' Resultset, use data() to get rowdata
  Resultset.prototype.find = function(query) {
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
    if (this.collection.indices.hasOwnProperty(property)) {
       searchByIndex = true;
       index = this.collection.indices[property];
    }

    // the comparison function
    fun = operators[operator];

	// Query executed differently depending on :
	//		- whether it is chained or not
	//		- whether the property being queried has an index defined
	//		- if chained, we handle first pass differently for initial filteredrows[] population
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
		} 
		else {
			t = index;
			i = index.length; 
			while (i--) {
				if (fun(t[i], value)) {
					result.push(this.collection.data[i]);
				}
			}
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
			} 
			else {
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
			} 
			else {
				t = index;
				i = t.length; 
				while (i--) {
					if (fun(t[i], value)) {
						result.push(i);
					}
				}
			}
			
			this.filteredrows = result;
			this.filterInitialized = true;   // next time work against filteredrows[]
			
			return this;
		}
		
	}
  }
  
  // Resultset.where() returns reference to 'this' Resultset, use data() to get rowdata
  Resultset.prototype.where = function(fun) { 
    var viewFunction,
	  result = [];

    if (('string' === typeof fun) && ('function' === typeof this.Views[fun])) {
      viewFunction = this.Views[fun];
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
    } 
	catch (err) {
		throw err;
    }
  }
  
  // Resultset.data() returns array or filtered documents 
  Resultset.prototype.data = function() {
	var result = [];
	
	for(var i in this.filteredrows) {
		result.push(this.collection.data[this.filteredrows[i]]);
	}
	
	return result;
  }
  
  /**
   * @constructor
   * DynamicView class is a versatile 'live' view class which is optionally persistent
   */
 function DynamicView(collection, name, persistent) {
	this.collection = collection;
	this.name = name;
	
	this.persistent = false;
	if (typeof(persistent) != "undefined") this.persistent = persistent;	
	
	this.resultset = new Resultset(collection)
	this.resultdata = [];
	this.resultsInitialized = false;
	
	this.cachedresultset = null;

	// keep ordered filter pipeline
	this.filterPipeline = [];
	
	// may add sortPipeline, map and reduce phases later
 }
 
 DynamicView.prototype.startTransaction() {
	this.cachedresultset = this.resultset;
 }
 
 DynamicView.prototype.commit() {
	this.cachedresultset = null;
 }
 
 DynamicView.prototype.rollback() {
	this.resultset = this.cachedresultset;
	
	if (this.persistent) {
		// i don't like the idea of keeping duplicate cached rows for each (possibly) persistent view
		// so we will for now just rebuild the persistent dynamic view data in this worst case scenario
		// (a persistent view utilizing transactions which get rolled back), we already know the filter so not too bad.
		this.resultdata = this.resultset.data();
	}
 }
 
 DynamicView.prototype.applyFind(query) {
	this.filterPipeline.push['find', query];
	
	// Apply immediately to Resultset; if persistent we will wait until later to build internal data
	this.resultset.find(query);
 }
 
 DynamicView.prototype.applyWhere(fun) {
	this.filterPipeline.push['where', fun];
	
	// Apply immediately to Resultset; if persistent we will wait until later to build internal data
	this.resultset.where(fun);
 }
 
 // will either build a resultset array or (if persistent) return reference to persistent data array
 DynamicView.prototype.data() {
	// if nonpersistent return resultset data evaluation
	if (!this.persistent) return Resultset.data();

	// Persistent Views - we keep Resultset updated dynamically, so 'rebuilding' and 'initializing'
	// the internal resuldata array means we pay cost of row copy now.
	if (!this.resultsInitialized || this.resultsdirty) {
		this.resultdata = Resultset.data();
		return this.resultdata;
	}
 }

 // internal function called on collection.insert() and collection.update()
 DynamicView.prototype.evaluateDocument(objIndex) {
	var ofr = this.resultset.filteredrows;
	var oldPos = ofr.indexOf(objIndex);
	var oldlen = ofr.length;

	// creating a 1-element resultset to run filter chain ops on to see if that doc passes filters;
	// mostly efficient algorithm, slight stack overhead price (this function is called on inserts and updates)
	var evalResultset = new Resultset(this.collection);
	evalResultset.filteredrows = [objIndex];
	evalResultset.filterInitialized = true;
	for(var idx=0; idx < this.filterPipeline.length; idx++) {
		switch(this.filterPipeline[idx][0]) {
			case "find": evalResultset.find(this.filterPipeline[idx][1]);
			case "where": evalResultset.where(this.filterPipeline[idx][1]);
		}
	}
	
	var newPos = (ofr.length == 0) ? -1: 0;
	
	// wasn't in old, shouldn't be now... do nothing
	if (oldPos == -1 && newPos == -1) return;
	
	// wan't in resultset, should be now... add
	if (oldPos == -1 && newPos != -1) {
		ofr.push(objIndex);
		this.resultdata.push(this.collection.data[objIndex]);
		
		return;
	}
	
	// was in resultset, shouldn't be now... delete
	if (oldPos != -1 && newPos == -1) {
		if (oldPos < oldlen-1) {
			// http://dvolvr.davidwaterston.com/2013/06/09/restating-the-obvious-the-fastest-way-to-truncate-an-array-in-javascript/comment-page-1/
			ofr[oldPos] = ofr[oldlen-1];
			ofr.length(oldlen-1);
			
			this.resultdata[oldPos] = this.resultdata[oldlen-1];
			this.resultdata.length(oldlen-1);
		}
		else {
			ofr.length(oldlen-1);
			this.resultdata.length(oldlen-1);
		}
	}
	
	// was in resultset, should still be now... (update persistent only?)
	if (oldPos != -1 && newPos != -1) {
		if (this.persistent) {
			// in case document changed, replace persistent view data with the latest collection.data document
			this.resultdata[oldPos] = this.collection.data[oldPos];
		}
		
		return;
	}
 }
 
 // internal function called on collection.delete()
 DynamicView.prototype.removeDocument(objIndex) {
	var ofr = this.resultset.filteredrows;
	var oldPos = ofr.indexOf(objId);
	var oldlen = ofr.length;
	
	if (oldPos != -1) {
		if (oldPos < oldlen-1) {
			ofr[oldPos] = ofr[oldlen-1];
			ofr.length(oldlen-1);
			
			this.resultdata[oldPos] = this.resultdata[oldlen-1];
			this.resultdata.length(oldlen-1);
		}
		else {
			ofr.length(oldlen-1);
			this.resultdata.length(oldlen-1);
		}
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
	
	this.DynamicViews = [];

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

      copyColl.maxId = (coll.data.length == 0)?0:coll.data.maxId;
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
   * Each collection maintains a list of DynamicViews associated with it
   **/
  Collection.prototype.addDynamicView(name, persistent) {
	this.DynamicViews.push(new DynamicView(this, name, persistent);
  }
  
  Collection.prototype.removeDynamicView(name) {
	for(var idx=0; idx < this.DynamicViews.length; idx++) {
		if (this.DynamicViews[idx] == name) {
			this.DynamicViews.splice(idx, 1);
		}
	}
  }
  
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
		
		// now that we can efficiently determine the data[] position of newly added document,
		// submit it for all registered DynamicViews to evaluate for inclusion/exclusion
		for (var idx=0; idx < this.DynamicViews.length; idx++) {
			this.DynamicViews[idx].evaluateDocument(this.data.length);
		}

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

		// now that we can efficiently determine the data[] position of newly added document,
		// submit it for all registered DynamicViews to remove
		for (var idx=0; idx < this.DynamicViews.length; idx++) {
			this.DynamicViews[idx].removeDocument(position);
		}
		
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
   * Chain method, used for beginning a series of chained find() and/or view() operations 
   * on a collection.
   */
  Collection.prototype.chain = function (query) {
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
	  
		// propagate rollback to dynamic views
		for (var idx=0; idx < this.DynamicViews.length; idx++) {
			this.DynamicViews[idx].rollback();
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

		// propagate startTransaction to dynamic views
		for (var idx=0; idx < this.DynamicViews.length; idx++) {
			this.DynamicViews[idx].startTransaction();
		}
    }
  };

  /** commit the transation */
  Collection.prototype.commit = function () {
    if (this.transactional) {
		this.cachedData = null;
		this.cachedIndex = null;

		// propagate commit to dynamic views
		for (var idx=0; idx < this.DynamicViews.length; idx++) {
			this.DynamicViews[idx].commit();
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
   * Create view function - CouchDB style
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
