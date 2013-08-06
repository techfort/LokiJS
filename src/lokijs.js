/**
 * LokiJS
 * @author Joe Minichino <joe@dsforge.net>
 * 
 * A lightweight document oriented javascript database
 */
'use strict';


/**
 * Define library loki
 */
var loki = (function(){


  /**
   * @constructor
   * The main database class
   */
  function Loki(name){
    var name = name || 'Loki';
    var collections = [];

    var self = this;
    
    this.getName = function(){
      return $getProperty.apply(this,['name']);
    };

    this.addCollection = function(name, objType, indexesArray, transactional, safeMode){
      var collection = new Collection(name, objType, indexesArray, transactional, safeMode);
      collections.push(collection);
      return collection;
    };

    this.loadCollection = function(collection){
      collections.push(collection);
    }

    this.listCollections = function(){
      
      var i = collections.length;
      
    };

    this.serialize = function(){
      return JSON.stringify(collections);
    };

    this.load = function(url){
      // future use method for remote loading of db
    };

    this.syncRemote = function(url){
      // future use for saving collections to remote db
    };

    var $getProperty = function(prop){ return prop; }
  };

  /**
   * @constructor 
   * Collection class that handles documents of same type
   */
  function Collection(_name, _objType, indexesArray, transactional, safeMode ){
    // the name of the collection 
    this.name = _name;
    // the data held by the collection
    this.data = [];
    // indices multi-dimensional array
    this.indices = [];
    this.idIndex = {}; // index of idx
    // the object type of the collection
    this.objType = _objType || "";

    /** Transactions properties */
    // is collection transactional
    this.transactional = transactional || false;
    // private holders for cached data
    var cachedIndex = null, cachedData = null;
    // safe mode
    var safe = safeMode || false;

    /**
     * Collection write lock
     * Javascript is single threaded but you can trigger async functions that may cause indexes
     * to be out of sync with the collection data. This lock blocks write access to collection indexes
     * and data. Operations will retry every 10ms until the lock is released
     */
    var writeLock = false;
    // timeout property - if lock is used for more than this value the current operation will throw an error
    var timeout = 5000;
    var elapsed = 0;

    var maxId = 1;
    // view container is an object because each views gets a name
    this.Views = {};

    // pointer to self to avoid this tricks
    var coll = this;

    this.setTimeOutValue = function(duration){
      timeout = duration;
    };
    this.timeOutExceededHandler = function(){
      throw 'Operation timed out';
    };

    // gets the current lock status
    this.getLock = function(){
      return writeLock;
    };
    // locks collection for writing
    function lock(){
      writeLock = true;
    };
    // releases lock on collection
    function releaseLock(){
      writeLock = false;
      // reset the lock elapse counter
      elapsed = 0;
    };

    function acquireLock(){
      elapsed += 10;
      if(elapsed > timeout){
        coll.timeOutExceededHandler();
      }
      if(coll.getLock()){
        
        setTimeout(acquireLock, 10);
      } else {
        lock();
      }
    }
    // wrapper for safe usage
    this._wrapCall = function( op, args ){
      
      try{
        acquireLock();
        var retval = coll[op].apply(coll, [args]);
        releaseLock();
        return retval;
      } catch(err){
        //console.error(err);
      }
      
    };

    this.execute = function(methodName, args){
      return safe ? coll._wrapCall(methodName, args) : coll[methodName](args);
    };


    // async executor with callback
    this.async = function( fun, callback){
      setTimeout(function(){
        if(typeof fun == 'function'){
          fun();  
        } else {
          throw 'Argument passed for async execution is not a function'
        }
        if(typeof fun == 'callback') callback();
      }, 0);
    };

    /**
     * Add object to collection
     */
    this._add = function(obj){      

      // if parameter isn't object exit with throw
      if( 'object' != typeof obj) {
        console.log(obj);
        throw 'Object being added needs to be an object';
      }
      /*
       * try adding object to collection
       */
      if(coll.objType=="" && coll.data.length == 0){

        // set object type to that of the first object added to collection
        coll.objType = obj.objType;

      } else {
        
        // throw an error if the object added is not the same type as the collection's
        if(coll.objType!=obj.objType) {
          throw 'Object type [' + obj.objType + '] is incongruent with collection type [' + coll.objType +']';
        }
        if(coll.objType=="") {
          throw 'Object is not a model';
        }
        
        if(obj.id != null && obj.id > 0){
          throw 'Document is already in collection, please use update()';
        } else {

          try {
            
            coll.startTransaction();
            maxId++;
            obj.id = maxId;
            // add the object
            coll.data.push(obj);

            // resync indexes to make sure all IDs are there
            //coll.ensureAllIndexes();    
            var i = coll.indices.length;
            while (i--) {
              coll.indices[i].data.push( obj[coll.indices[i].name ]);
            };
            coll.commit();
            return obj;
          } catch(err){
            
            coll.rollback();
          }
          
        }

      }
    };

    
    this.add = function(obj){
      return coll.execute('_add', obj);
    };


    /**
     * iterate through arguments and add indexes 
     */
    this.addMany = function(){
      var i = arguments.length;
      while(i--){
        coll.execute('_add',arguments[i]);
      }
    };

    /**
     * generate document method - ensure objects have id and objType properties
     */
    this.document = function(doc){
      doc.id == null;
      doc.objType = coll.objType;
      coll.add(doc);
      return doc;
    };

    /**
     * Ensure indexes on a certain field
     */
    this.ensureIndex = function(property){
      
      if (property == null || property === undefined) throw 'Attempting to set index without an associated property'; 
      
      var index = {
        name : property,
        data : []
      };

      var i = coll.indices.length;
      while( i-- ){
        if( coll.indices[i].name == property){
          
          index = coll.indices[i];
        } else {
          
          // to do
              
        }
      }

      coll.indices.push(index);
      delete index.data;

      index.data = [];
      var i = coll.data.length;
      while( i-- ){
        index.data.push( coll.data[i][index.name] );
      }

      if(index.name == 'id'){
        coll.idIndex = index;
      }
      
      
    };

    /**
     * Ensure index async with callback - useful for background syncing with a remote server 
     */
    this.ensureIndexAsync = function(property, callback){
      this.async(function(){
        coll.ensureIndex(property);
      }, callback);
    };

    /**
     * Ensure all indexes
     */
    this.ensureAllIndexes = function(){
      var i = coll.indices.length;
      while (i--) {
        coll.ensureIndex(coll.indices[i].name);
      };
    };

    this.ensureAllIndexesAsync = function(callback){
      this.async(function(){
        coll.ensureAllIndexes();
      }, callback);
    };

    /*---------------------+
    | Querying methods     |
    +----------------------*/

    /**
     * Get by Id - faster than other methods because of the searching algorithm
     */
    this.get = function(id){
      console.log(coll.idIndex);
      var data = coll.idIndex.data;
      var max = data.length - 1;
      var min = 0, mid = Math.floor(min +  (max - min ) /2 );
      console.log(data[min] + ' ' + data[max]);
      while( data[min] < data[max] ){
        
        mid = Math.floor( (min + max )/2 );
        console.log(max + ' ' + mid + ' ' + min + ' ' + data[mid]) ;
        
        if(data[mid] < id){
          
          min = mid + 1;
        } else {
          
          max = mid;
        }
          
      }
      console.log('stats : ' + max + ' ' + mid + ' ' + min);
      if( max == min && data[min] == id)
        return coll.data[min];
      else
        return null;

    };

    /**
     * Find one object by index property
     */
    this.findOne = function(prop, value){
      
      var searchByIndex = false;
      var indexObject = null;

      // iterate the indices to ascertain whether property is indexed
      var i = coll.indices.length;
      while(i--){
        if( coll.indices[i].name == prop){
          searchByIndex = true;
          indexObject = coll.indices[i];
          break;
        }
      }      
      
      if(searchByIndex){
        // perform search based on index
        var i = indexObject.data.length;
        while (i--) {
          
          if(indexObject.data[i] == value){
            var doc = coll.data[i];
            doc.__pos__ = i;
            return doc;
          }
        };;

      } else {
        // search all collection and find first matching result
        return coll.findOneUnindexed(prop, value);
      }
      return null;
    };

    /**
     * Find object by unindexed field
     */
    this.findOneUnindexed = function(prop, value){
      
      var i = coll.data.length;
      while (i--) {
        if(coll.data[i][prop]==value){
          var doc = coll.data[i];
          doc.__pos__ = i;
          return doc;
        }
        return null;
      };
    };

    /**
     * Update method
     */
    this._update = function(doc){
      
      // verify object is a properly formed document
      if( doc.id == 'undefined' || doc.id == null || doc.id < 0){
        throw 'Trying to update unsynced document. Please save the document first by using add() or addMany()';
      } else {

        try{

          coll.startTransaction();
          var obj = coll.findOne('id', doc.id);
          // get current position in data array
          var position = obj.__pos__;
          delete obj.__pos__;
          // operate the update
          coll.data[position] = doc;
          // coll.ensureAllIndexes();
          var i = coll.indices.length;
          while(i--) {
            coll.indices[i].data[position] = obj[ coll.indices[i].name ];
          };
          coll.commit();

        } catch(err){
          coll.rollback();
        }
      }
      
    };

    this.update = function(obj){
      return coll.execute('_update', obj);
    }

    this.findAndModify = function(filterFunction, updateFunction ){
      
      var results = coll.view(filterFunction);
      try {
        for( var i in results){
          var obj = updateFunction(results[i]);
          coll.update(obj);
        }

      } catch(err){
        coll.rollback();
      }
    };

    /**
     * Delete function
     */
    this._remove = function(doc){
      
      if('object' != typeof doc){
        throw 'Parameter is not an object';
      }

      if(doc.id == null || doc.id == undefined){
        throw 'Object is not a document stored in the collection';
      }

      try {
        coll.startTransaction();
        var obj = coll.findOne('id', doc.id);
        var position = obj.__pos__;
        delete obj.__pos__;
        coll.data.splice(position,1);

        var i = coll.indices.length;
        while (i--) {
          coll.indices[i].data.splice( position ,1);
        }
        coll.commit();

      } catch(err){
        coll.rollback();

      }

    };

    this.remove = function(obj){
      coll.execute('_remove', obj);
    }

    /**
     * Create view function - CouchDB style
     */
    this.view = function(fun){
      var viewFunction;
      if( ('string' == typeof fun) && ('function' == typeof coll.Views[fun]) ){
        viewFunction = coll.Views[fun];
      } else if('function' == typeof fun){
        viewFunction = fun;
      } else {
        throw 'Argument is not a stored view or a function';
      }
      try {
        var result = [];
        var i = coll.data.length;
        while(i--){
          if( viewFunction( 
            coll.data[i] ) ){
            result[i] = coll.data[i];
          };
        }
        return result;
      } catch(err){
        
      }
    };

    this.storeView = function(name, fun){
      if(typeof fun == 'function'){
        coll.Views[name] = fun;
        
      }
    };

    /**
     * Map Reduce placeholder (for now...)
     */
    this.mapReduce = function(mapFunction, reduceFunction){
      try {
        return reduceFunction( coll.data.map(mapFunction) );  
      } catch(err) {
        console.log(err)
      }
    };
    /**
     * Find method, api is similar to mongodb except for now it only supports one search parameter
     */
    this.find = function(queryObject){
      queryObject = queryObject || 'getAll';
      if(queryObject == 'getAll'){
        return coll.data;
      }

      var property, value, operator;
      for(var p in queryObject){
        property = p;
        if(typeof queryObject[p] != 'object'){
          operator = '$eq';
          value = queryObject[p];
        } else if (typeof queryObject[p] == 'object'){
          for(var key in queryObject[p]){
            operator = key;
            value = queryObject[p][key];
          }
        } else {
          throw 'Do not know what you want to do.';
        }
        break;
      }

      console.log('Op: ' + operator + ' value: ' + value + ' prop: ' + property);
      // comparison operators
      function $eq ( a, b){ return a == b; }
      function $gt ( a, b){ return a > b; }
      function $gte( a, b){ return a >= b; }
      function $lt ( a, b){ return a < b; }
      function $lte( a, b){ return a <= b; }
      function $ne ( a, b){ return a != b; }

      var operators = {
        '$eq': $eq,
        '$gt': $gt,
        '$gte': $gte,
        '$lt': $lt,
        '$lte': $lte,
        '$ne' : $ne
      };

      if (coll.data == null)
          throw new TypeError();

      var searchByIndex = false;
      var index = null;
      var len = coll.indices.length >>> 0;
      while(len--){
        if(coll.indices[len].name == property){
          searchByIndex = true;
          index = coll.indices[len];
        }
      }

      // the result array
      var res = [];
      var fun = operators[operator];

      if(!searchByIndex){
        var t = coll.data;
        var i = t.length;
        while (i--) {
          if( fun(t[i][property], value)) res.push(t[i]); 
        }  
      } else {
        var t = index.data;
        var i = t.length;
        while(i--){
          if( fun(t[i], value)) res.push(coll.data[i]);
        }
      }
      
      return res;

    };

    this.filter = function(operator, property, value){
      return coll.data.query(operator, property, value);
    }

    

    this.no_op = function(){
      
    };

    /**
     * Transaction methods 
     */
    /** start the transation */
    this.startTransaction = function(){
      if(coll.transactional) {
        cachedData = coll.data;
        cachedIndex = coll.indices;  
      }
    };
    /** commit the transation */
    this.commit = function(){
      if(coll.transactional) { 
        cachedData = null;
        cachedIndex = null;
      }
    };

    /** roll back the transation */
    this.rollback = function(){
      if(coll.transactional) {
        if(cachedData != null && cachedIndex != null){
          coll.data = cachedData;
          coll.indices = cachedIndex;
        }  
      }
    };

    // handle the indexes passed
    var indexesArray = indexesArray || [];
    

    // initialize optional indexes from arguments passed to Collection
    var i = indexesArray.length;
    while ( i--) {
    
      coll.ensureIndex(indexesArray[i]);
    };

    // initialize the id index
    coll.ensureIndex('id');
  };

  return Loki;
}());



if(typeof module !== 'undefined' && module.exports){

  module.exports = loki;
}