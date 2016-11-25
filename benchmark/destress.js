// This script can be used to stress the ability of loki to load large databases.  
// I have found that within most javascript engines there seems to be memory 
// contraints and inefficiencies involved with using JSON.stringify.
//
// One way to limit memory overhead is to serialize smaller objects rather than
// one large (single) JSON.stringify of the whole database.  Loki has added
// functionality to stream output of the database rather than saving a whole
// database as a single string. 
//
// This destress can be used to analyse memory overhead for loading a database
// created by the stress.js script. Both stress.js and destress.js need to be
// configured to use the same serialization method and adapter.  By default,
// this is configured to use the loki-fs-structured-adapter which will 
// stream output and input.

var loki = require('../src/lokijs.js');
var lfsa = require('../src/loki-fs-structured-adapter.js');
var adapter = new lfsa();

//var serializationMethod = "normal";

function reloadDatabase() {
	db = new loki('sandbox.db', {
		verbose: true,
		autoload: true,
		autoloadCallback: dbLoaded,
    adapter:adapter
	});
}

function dbLoaded() {
  console.log('loaded database from indexed db');
	var itemsColl = db.getCollection('items');

  console.log("After loading database : ");
  console.log(process.memoryUsage());
  console.log('number of docs in items collection: ' + itemsColl.count());
}

console.log("Before loading database : ");
console.log(process.memoryUsage());
reloadDatabase();
