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
    this.name = name || 'Loki';
    this.collections = [];

    this.ENV = (function(){
      if(typeof module != 'undefined' && module.exports){
        return 'NODEJS';
      } else {
        if(document){
          if(document.URL.indexOf('http://') == -1 && document.URL.indexOf('https://') == -1 ){
            return 'CORDOVA';
          } else {
            return 'BROWSER';
          }
        } else {
          return 'CORDOVA';
        }
      }
    })();

    if(this.ENV=='NODEJS'){
      this.fs = require('fs');
    }

    var self = this;
    
    this.getName = function(){
      return this.name;
    };

    this.addCollection = function(name, objType, indexesArray, transactional, safeMode){
      var collection = new Collection(name, objType, indexesArray, transactional, safeMode);
      self.collections.push(collection);
      return collection;
    };

    this.loadCollection = function(collection){
      self.collections.push(collection);
    }

    this.getCollection = function(collectionName){
      var found = false;
      var len = this.collections.length;
      for( var i =0; i < len; i++){
        if(this.collections[i].name == collectionName){
          found = true;
          return this.collections[i];
        }
      }
      if(!found) throw 'No such collection';

    };

    this.listCollections = function(){
      
      var i = self.collections.length;
      
    };

    // toJson
    this.serialize = function(){
      return JSON.stringify(self);
    };
    this.toJson = this.serialize;

    // load Json function - db is saved to disk as json
    this.loadJSON = function(serializedDb){
      // future use method for remote loading of db
      var obj = JSON.parse(serializedDb);

      self.name = obj.name;
      self.collections = [];
      for(var i = 0; i < obj.collections.length; i++){
        var coll = obj.collections[i];
        var copyColl = self.addCollection(coll.name, coll.objType);

        // load each element individually 
        var len = coll.data.length;
        for( var j = 0; j < len; j++){
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
    this.loadDatabase = function( filename, callback ){
      var callback = callback || function(){};
      if(this.ENV=='NODEJS'){
        this.fs.readFile( filename, {encoding: 'utf8'}, function(err, data){
          self.loadJSON(data);
          callback();
        });
      }
    };

    // save file to disk as json
    this.saveToDisk = function( filename, callback ){
      var callback = callback || function(){};
      // persist in nodejs
      if(this.ENV=='NODEJS'){
        this.fs.exists( filename, function(exists){
          if(exists){
            self.fs.writeFile( filename, this.serialize(), function(err){
              if(err) throw err;
              callback();
            });    
          }
        });
      }
    };

    this.saveRemote = function(url){
      // future use for saving collections to remote db
    };

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
    this.indices = {};
    this.idIndex = {}; // index of idx
    // the object type of the collection
    this.objType = _objType || "";

    /** Transactions properties */
    // is collection transactional
    this.transactional = transactional || false;
    // private holders for cached data
    var cachedIndex = null, cachedData = null;

    // currentMaxId - change manually at your own peril!
    this.maxId = 0;
    // view container is an object because each views gets a name
    this.Views = {};

    this.safe = safeMode || false;

    // pointer to self to avoid this tricks
    var coll = this;
    

    // set these methods if you want to add a before and after handler when using safemode
    this.onBeforeSafeModeOp = function(){ /* no op */};
    // the onAfter handler could take the result of the current operation as optional value
    this.onAfterSafeModeOp = function(result){ /* no op */ };

    this.onSafeModeError = function(err){
      console.error(err);
    };

    // wrapper for safe usage
    this._wrapCall = function( op, args ){
      
      try{
        coll.onBeforeSafeModeOp();
        var retval = coll[op].apply(coll, [args]);
        coll.onAfterSafeModeOp(retval);
        return retval;
      } catch(err){
        //console.error(err);
        coll.onSafeModeError();
      }
      
    };

    this.execute = function(methodName, args){
      return coll.safe ? coll._wrapCall(methodName, args) : coll[methodName](args);
    };


    // async executor. This is only to enable callbacks at the end of the execution. 
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
            this.maxId++;
            
            if(isNaN(this.maxId)){
              this.maxId = (coll.data[ coll.data.length - 1 ].id + 1);
            }

            obj.id = this.maxId;
            // add the object
            coll.data.push(obj);

            // resync indexes to make sure all IDs are there
            //coll.ensureAllIndexes(); 
            for (var i in coll.indices ) {

              coll.indices[i].push( obj[ i ] );

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
     * Come to think of it, really unfortunate name because of what document normally refers to in js.
     * that's why there's an alias below but until I have this implemented 
     */
    this.document = function(doc){
      doc.id == null;
      doc.objType = coll.objType;
      coll.add(doc);
      return doc;
    };
    // just an alias for compatibility with most APIs
    this.insert = this.document;

    /**
     * Ensure indexes on a certain field
     */
    this.ensureIndex = function(property){
      
      if (property == null || property === undefined) throw 'Attempting to set index without an associated property'; 
      
      var index;
      if(coll.indices.hasOwnProperty(property) ) {
        index = coll.indices[property];
      } else {
        coll.indices[property] = [];
        index = coll.indices[property];
      }

      var len = coll.data.length;
      for(var i=0; i < len; i++){
        index.push( coll.data[i][property] );
      }
      if(property == 'id'){
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
      if(i==0) ensureIndex('id');
    };

    this.ensureAllIndexesAsync = function(callback){
      this.async(function(){
        coll.ensureAllIndexes();
      }, callback);
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
          
          for( var i in coll.indices ) {
            coll.indices[i][position] = obj[ i ];
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
        var deleted = coll.data.splice(position,1);
        
        for (i in coll.indices ) {
          var deletedIndex = coll.indices[i].splice( position ,1);
        }
        coll.commit();

      } catch(err){
        coll.rollback();

      }

    };

    this.remove = function(obj){
      coll.execute('_remove', obj);
    }

    /*---------------------+
    | Querying methods     |
    +----------------------*/

    /**
     * Get by Id - faster than other methods because of the searching algorithm
     */
    this.get = function(id){
      
      var data = coll.indices['id'];
      var max = data.length - 1;
      var min = 0, mid = Math.floor(min +  (max - min ) /2 );
      
      while( data[min] < data[max] ){
        
        mid = Math.floor( (min + max )/2 );
        
        if(data[mid] < id){
          
          min = mid + 1;
        } else {
          
          max = mid;
        }
          
      }
      
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
    var indexesArray = indexesArray || ['id'];
    

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
