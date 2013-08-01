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
  function Loki(_name){
    var name = _name;
    var collections = [];

    var self = this;
    
    this.getName = function(){
      return $getProperty.apply(this,['name']);
    };

    this.addCollection = function(name, objType, indexesArray){
      var collection = new Collection(name, objType, indexesArray);
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
  function Collection(_name, _objType, indexesArray, transactional ){
    // the name of the collection 
    this.name = _name;
    // the data held by the collection
    this.data = [];
    // indices multi-dimensional array
    this.indices = [];
    // the object type of the collection
    this.objType = _objType || "";

    /** Transactions properties */
    // is collection transactional
    this.transactional = transactional || false;
    // private holders for cached data
    var cachedIndex = null, cachedData = null;

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

    /**
     * Add object to collection
     */
    this.add = function(obj){
      // acquire collection lock
      acquireLock();
      

      // if parameter isn't object exit with throw
      if( 'object' != typeof obj) {
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

            obj.id = new Date().getTime();
            // add the object
            coll.data.push(obj);

            // resync indexes to make sure all IDs are there
            //coll.ensureAllIndexes();    
            var i = coll.indices.length;
            while (i--) {
              coll.indices[i].data.push( obj[coll.indices[i].name ]);
            };
            
            coll.commit();

          } catch(err){

            
            coll.rollback();
          }
          
        }

      }
      // release lock
      releaseLock();

    };

    /**
     * iterate through arguments and add indexes 
     */
    this.addMany = function(){
      var i = arguments.length;
      while(i--){
        coll.add(arguments[i]);
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
      
      acquireLock();

      var index = {
        name : property,
        data : []
      };

      var i = coll.indices.length;
      while( i-- ){
        if( coll.indices[i].name == property){
          
          index = coll.indices[i];
        } else {
          
          
              
        }
      }

      coll.indices.push(index);
      delete index.data;

      index.data = new Array();
      var i = coll.data.length;
      while( i-- ){
        index.data.push( coll.data[i][index.name] );
      }
      
      releaseLock();
    };

    /**
     * Ensure index async with callback - useful for background syncing with a remote server 
     */
    this.ensureIndexAsync = function(property, callback){
      
      setTimeout( function(){
        coll.ensureIndex(property);
        callback();
      }, 1);
      
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
      
      var callback = callback || coll.no_op;
      setTimeout( function(){ 
        coll.ensureAllIndexes();
        callback();
      }, 1 );
    };

    /*---------------------+
    | Querying methods     |
    +----------------------*/

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
    this.update = function(doc){
      acquireLock();
      // verify object is a properly formed document
      if( doc.id == undefined || doc.id == null || doc.id < 0){
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
      releaseLock();
    };

    this.findAndModify = function(filterFunction, updateFunction ){
      acquireLock();
      var results = coll.view(filterFunction);
      try {
        for( var i in results){
          
          var obj = updateFunction(results[i]);
          coll.update(obj);

        }

      } catch(err){

        
        coll.rollback();

      }
      
      releaseLock();
    };

    /**
     * Delete function
     */
    this.delete = function(doc){
      
      acquireLock();

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


      releaseLock();
    };

    /**
     * Create view function - CouchDB style
     */
    this.view = function(filterFunction){
      try {
        var result = [];
        var i = coll.data.length;
        while(i--){
          if( filterFunction( coll.data[i] ) ){
            result[i] = coll.data[i];
          };
        }
        return result;
      } catch(err){
        
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
     * Function similar to array.filter but optimized for array of objects
     */
    this.query = function(operator, property, value){
      
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

    this.find = function(){
      return coll.data;     
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