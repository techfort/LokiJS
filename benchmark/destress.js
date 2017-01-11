// This script is meant to diagnose and stress the ability of loki to 
// internally deserialize large databases.  I have found that within most
// javascript engines there seems to be memory contraints and inefficiencies  
// involved with using JSON.stringify.
//
// This example loads (by default) aournd 130000 randomly generated 
// objects which, when serialized will evaluate to roughly a 100MB string.
// Internal memory usage, however spiked to a little under 2GB on my 
// node 5.6.0 installation. 
//
// If you increase the numObject variable to a level that exceeds the 
// deault heap size you may encounter an out of error or stack error
// node --max-old-space-size=2000 stress
//
// Browser environments have no such customization and appear to be 
// roughly limited to a similar 50Meg or so database size for the moment.
// This would correlate with a rougly 2GB memory allocation.
//
// This script will be used as a reference for alternative serialization methods
// which have a much lower overhead than the above 60M/2GB ratio.

var loki = require('../src/lokijs.js');

//var serializationMethod = "normal";
var serializationMethod = "destructured";

var db = new loki('sandbox.db', {
          verbose: true,
          serializationMethod: serializationMethod
});
var items = db.addCollection('items');

function step2CalcSerializeSize() {
	var serializedLength = db.serialize().length;
	console.log('size of original database length : ' + serializedLength);
}

function step3SaveDatabase() {
	db.saveDatabase(function(err) {
		if (err === null) {
	    	console.log('finished saving database');
	    }
	    else {
	    	console.log('error encountered saving database : ' + err);
	    }
	});
}

function step4ReloadDatabase() {
	db = new loki('sandbox.db', {
		verbose: true,
		autoload: true,
		autoloadCallback: dbLoaded,
    serializationMethod: serializationMethod
	});
}

function dbLoaded() {
  console.log('loaded database from indexed db');
	var itemsColl = db.getCollection('items');

  console.log("After loading database : ");
  console.log(process.memoryUsage());
  console.log('number of docs in items collection: ' + itemsColl.count());

  step2CalcSerializeSize();

  console.log("After calling db.serialize on newly loaded database : ");
  console.log(process.memoryUsage());
}

console.log("Before loading database : ");
console.log(process.memoryUsage());
step4ReloadDatabase();
