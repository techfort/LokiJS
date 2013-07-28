/**
 * LokiJS
 * @author Joe Minichino <joe@dsforge.net>
 * 
 * A lightweight document oriented javascript database
 */
'use strict';


var LokiJS = LokiJS || {};

LokiJS = {
  version : '0.0.1',
  /** @define {boolean} */
  DEBUG_MODE: true
};

function trace(message) { 
  try{
    if(LokiJS.DEBUG_MODE) console.log(message);
  }catch(err){
    /* no op */
  }
}

/**
 * Define library loki
 */
window.loki = (function(){

  

  /**
   * @constructor
   * The main database class
   */
  function Loki(_name){
    var name = _name;
    var collections = [];

    var self = this;
    trace('Creating db ' + name);

    
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
      trace('Collections: ' + collections.length);
      var i = collections.length;
      while(i--){ trace('Collection name : ' + collections[i].name); }
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
  function Collection(_name, _objType, indexesArray ){
    // the name of the collection 
    this.name = _name;
    // the data held by the collection
    this.data = [];
    // indices multi-dimensional array
    this.indices = [];
    // the object type of the collection
    this.objType = _objType || "";
    // pointer to self to avoid this tricks
    var coll = this;
    /**
     * Collection write lock
     * Javascript is single threaded but you can trigger async functions that may cause indexes
     * to be out of sync with the collection data. This lock blocks write access to collection indexes
     * and data. Operations will retry every 10ms until the lock is released
     */
    var writeLock = false;
    this.getLock = function(){
      return writeLock;
    };
    function lock(){
      trace('()==() :: Locking collection ' + coll.name);
      writeLock = true;
    };

    function releaseLock(){
      trace('()==/ :: Releasing lock on ' + coll.name);
      writeLock = false;
    };

    function acquireLock(){
      if(coll.getLock()){
        trace('|=|) :: Collection ' + coll.name + ' locked, retrying in 10ms');
        setTimeout(acquireLock, 10);
      } else {
        lock();
      }
    }
  

    trace('Creating collection with name [' + this.name + '] of type [' + this.objType + ']');

    /**
     * Add object to collection
     */
    this.add = function(obj){

      acquireLock();
      

      // if parameter isn't object exit with throw
      if( 'object' != typeof obj ) {
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
        trace('Adding object ' + obj.toString() + ' to collection ' + coll.name);
        
        if(obj.id != null && obj.id > 0){
          throw 'Document is already in collection, please use update()';
        } else {
          obj.id = new Date().getTime();
          // add the object
          coll.data.push(obj);

          // resync indexes to make sure all IDs are there
          //coll.ensureAllIndexes();    
          var i = coll.indices.length;
          while (i--) {
            coll.indices[i].data.push( obj[coll.indices[i].name ]);
          };
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
      trace('_objType : ' + coll.objType);
      trace(doc);
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
          trace('Index ' + property + ' already exists, re-indexing....');
          index = coll.indices[i];
        } else {
          trace('Creating new index ' + property);
          
              
        }
      }

      coll.indices.push(index);
      delete index.data;

      index.data = new Array();
      var i = coll.data.length;
      while( i-- ){
        index.data.push( coll.data[i][index.name] );
        trace('Storing into index ' + index.name + ' value ' + index.data[i]);
      }
      trace( coll.indices );

      releaseLock();
    };

    /**
     * Ensure index async with callback - useful for background syncing with a remote server 
     */
    this.ensureIndexAsync = function(property, callback){
      trace('Calling ensureIndexAsync...');
      setTimeout( function(){
        coll.ensureIndex(property);
        callback();
      }, 1);
      trace('started indexing...');
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
      trace('Calling ensureAllIndexesAsync...');
      var callback = callback || coll.no_op;
      setTimeout( function(){ 
        coll.ensureAllIndexes();
        callback();
      }, 1 );
    };


    /**
     * Find one object by index property
     */
    this.findOne = function(prop, value){
      trace('Querying for ' + prop + '=' + value);
      var searchByIndex = false;
      var indexObject = null;

      // iterate the indices to ascertain whether property is indexed
      var i = coll.indices.length;
      while(i--){
        if( coll.indices[i].name == prop){
          searchByIndex = true;
          indexObject = coll.indices[i];
          trace('Querying with index');
          trace(indexObject);
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
      trace('Querying without index');
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

        var obj = coll.findOne('id', doc.id);
        trace(obj);
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
      trace('Deleting object...');
      trace(doc);
      var obj = coll.findOne('id', doc.id);
      var position = obj.__pos__;
      delete obj.__pos__;
      coll.data.splice(position,1);

      var i = coll.indices.length;
      while (i--) {
        coll.indices[i].data.splice( position ,1);
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
        trace(err);
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
      trace('Operator: ' + operator);
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

        var t = coll.data;
        var fun = operators[operator];

        var res = [];

        var i = t.length;
        while (i--) {
          if( fun(t[i][property], value)) res.push(t[i]); 
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
      trace('Operation completed.');
    };

    var indexesArray = indexesArray || [];
    trace('Passed indexes ' + indexesArray.join(', '))

    // initialize optional indexes from arguments passed to Collection
    var i = indexesArray.length;
    while ( i--) {
      trace('Initializing index ' + indexesArray[i]);
      coll.ensureIndex(indexesArray[i]);
    };

    // initialize the id index
    coll.ensureIndex('id');
  };

  LokiJS.trace = trace.bind(LokiJS);
  //Loki.prototype.Collection = Collection;

  return Loki;
}());