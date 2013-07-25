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
			if(coll.objType!=obj.objType) throw 'Object type [' + obj.objType + '] is incongruent with collection type [' + coll.objType +']';
			if(coll.objType=="") throw 'Object is not a model';
			trace('Adding object ' + obj.toString() + ' to collection ' + coll.name);
			
			// add the object
			coll.data.push(obj);
		}
	};

	this.addMany = function(){
		for(var i = 0; i < arguments.length; i++){
			coll.add(arguments[i]);
		}
	};

	var Document = function (_objType, doc){
		trace('_objType : ' + _objType);
		trace(doc);
		doc.id = new Date().getTime();
		doc.objType = _objType;
		doc.toString = function(){ return 'Type: ' + doc.objType + ', id: ' + doc.id; };
		return doc;
	};

	this.document = function(doc){
		return Document(coll.objType, doc);
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
		var searchByIndex = false;
		for(var i = 0; i < coll.indices.length; i++){
			if( coll.indices[i].name == prop){
				searchByIndex = true;
				trace('Querying with index');
				break;
			}
		}
		

	};


};

LokiJS.trace = trace.bind(LokiJS);
loki.prototype.Collection = Collection;