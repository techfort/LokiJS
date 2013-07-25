/**
 * LokiJS
 * @author Joe Minichino <joe@dsforge.net>
 * 
 * A lightweight document oriented javascript database
 */
'use strict';

function trace(message) { 
	try{
		console.log(message);
	}catch(err){
		/* no op */
	}
};

var LokiJS = LokiJS || {};

LokiJS = {
	version : '0.0.1',
	debugMode : true, 
	db : function(_name){
		var name = _name;
		if(LokiJS.debugMode) trace('Creating db ' + name);

		var $getProperty = function(prop){ return prop; }
		this.getName = function(){
			return $getProperty.apply(db,['name']);
		};
	}

};

function Collection(_name, _objType){
	this.name = _name;
	this.data = [];
	this.objType = _objType || "";
	var coll = this;
	if(LokiJS.debugMode)  trace('Creating collection with name [' + this.name + '] of type [' + this.objType + ']');
	this.add = function(obj){
		/*
		 * try adding object to collection
		 */
		if(this.objType=="" && this.data.length == 0){
			// set object type to that of the first object added to collection
			this.objType = obj.objType;
		} else {
			// throw an error if the object added is not the same type as the collection's
			if(this.objType!=obj.objType) throw 'Object type [' + obj.objType + '] is incongruent with collection type [' + this.objType +']';
			if(this.objType=="") throw 'Object is not a model';
			if(LokiJS.debugMode) trace('Adding object ' + obj.toString() + ' to collection ' + this.name);
			// add the object
			this.data.push(obj);
		}
	};


	var Document = function (_objType, doc){
		if(LokiJS.debugMode) trace('_objType : ' + _objType);
		if(LokiJS.debugMode) trace(doc);
		doc.id = new Date().getTime();
		doc.objType = _objType;
		doc.toString = function(){ return 'Type: ' + doc.objType + ', id: ' + doc.id; };
		return doc;
	};

	this.model = function(doc){
		return Document(coll.objType, doc);
	}
}

function Id(){

}


function Query(queryObj){

}

LokiJS.trace = trace.bind(LokiJS);
LokiJS.collection = Collection;