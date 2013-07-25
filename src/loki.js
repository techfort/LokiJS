/**
 * LokiJS
 * @author Joe Minichino <joe@dsforge.net>
 * 
 * A lightweight document oriented javascript database
 */
'use strict';

function trace(message) { 
	try{
		if(LokiJS.debugMode) console.log(message);
	}catch(err){
		/* no op */
	}
};

var LokiJS = LokiJS || {};

LokiJS = {
	version : '0.0.1',
	debugMode : true
};

function loki(_name){
	try {
		var name = _name;
		trace('Creating db ' + name);

		var $getProperty = function(prop){ return prop; }
		this.getName = function(){
			return $getProperty.apply(this,['name']);
		};
	} catch(err) {
		trace(err);
	}	
};

function Collection(_name, _objType){
	this.name = _name;
	this.data = [];
	this.objType = _objType || "";
	var coll = this;

	this.indices = [];

	trace('Creating collection with name [' + this.name + '] of type [' + this.objType + ']');
	this.add = function(obj){

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
					
				// add the object
				coll.data.push(obj);
				coll.ensureIndexAsync('id', coll.no_op);				
			}

		}
	};

	this.addMany = function(){
		for(var i = 0; i < arguments.length; i++){
			coll.add(arguments[i]);
		}
	};

	this.document = function(doc){
		trace('_objType : ' + coll.objType);
		trace(doc);
		doc.id = new Date().getTime();
		doc.objType = coll.objType;
		return doc;
	};

	this.ensureIndex = function(property){
		
		if (property == null || property === undefined) throw 'Attempting to set index without an associated property';	
		var index = {
			name : property,
			data : []
		};
		for(var i =0; i < coll.indices.length; i++){
			if( coll.indices[i].name == property){
				trace('Index already exists, re-indexing....');
			}
		}

		coll.indices.push(index);
		for(var i =0; i < coll.data.length; i++){
			index.data.push( coll.data[i][index.name] );
		}
		trace( coll.indices );

	};

	this.ensureIndexAsync = function(property, callback){
		setTimeout( function(){
			coll.ensureIndex(property);
			callback();
		}, 1);
		trace('started indexing...');
	};

	this.findOne = function(prop, value){
		trace('Querying for ' + prop + '=' + value);
		var searchByIndex = false;
		var indexObject = null;
		for(var i = 0; i < coll.indices.length; i++){
			if( coll.indices[i].name == prop){
				searchByIndex = true;
				indexObject = coll.indices[i];
				trace('Querying with index');
				trace(indexObject);
				break;
			}
		}
		
		if(searchByIndex){
			// @TODO: perform search based on index
			var size = indexObject.data.length;
			for (var i = size - 1; i >= 0; i--) {
				trace('Current position : ' + i);
				if(indexObject.data[i] == value){
					var doc = coll.data[i];
					doc.__pos__ = i;
					return doc;
				}
			};;

		} else {
			// @TODO: search all collection and find first matching result
			return coll.findOneUnindexed(prop, value);
		}
		return null;
	};

	this.findOneUnindexed = function(prop, value){
		for (var i = coll.data.length - 1; i >= 0; i--) {
			if(coll.data[i][prop]==value){
				var doc = coll.data[i];
				doc.__pos__ = i;
				return doc;
			}
			return null;
		};
	};

	this.update = function(model){
		if(	model.id == undefined || model.id == null || model.id < 0){
			throw 'Trying to update unsynced model. Please save the model first by using add() or addMany()';
		} else {

		}
	};

	this.delete = function(obj){

	};

	this.query = function(queryObject){

	};

	this.no_op = function(){
		trace('Operation completed.');
	};

};

LokiJS.trace = trace.bind(LokiJS);
loki.prototype.Collection = Collection;