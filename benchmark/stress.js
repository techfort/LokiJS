// This script is meant to diagnose and stress the ability of loki to 
// internally serialize large databases.  I have found that within most
// javascript engines there seems to be memory contraints and inefficiencies  
// involved with using JSON.stringify.
//
// This example creates (by default) 30000 randomly generated objects
// which, when serialized will evaluate to roughly a 60MB string.
// Internal memory usage, however spiked to a little under 2GB on my 
// node 5.6.0 installation. 
//
// In order to run this, you will probably need 4GB of RAM and launch 
// with a command line similar to (for about a 2GB mem allocation):
// node --max-old-space-size=2000 stress
//
// Browser environments have no such customization and appear to be 
// roughly limited to a similar 50Meg or so database size for the moment.
// This would correlate with a rougly 2GB memory allocation.
//
// This script will be used as a reference for alternative serialization methods
// which have a much lower overhead than the above 60M/2GB ratio.

var loki = require('../src/lokijs.js');

var numObjects = 30000;

var db = new loki('sandbox.db', {
          verbose: true 
});
var items = db.addCollection('items');

// generate random 100 character string
function genRandomVal() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < 100; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

function step1InsertObjects() {
	var idx;
    
    for(idx=0; idx<numObjects; idx++) {
		items.insert({ 
        	start : (new Date()).getTime(),
        	first : genRandomVal(), 
            owner: genRandomVal(), 
            maker: genRandomVal(),
            orders: [
            	genRandomVal(),
                genRandomVal(),
                genRandomVal(),
                genRandomVal(),
                genRandomVal()
            ],
            attribs: {
            	a: genRandomVal(),
                b: genRandomVal(),
                c: genRandomVal(),
                d: {
                	d1: genRandomVal(),
                	d2: genRandomVal(),
                	d3: genRandomVal()
                }
            }
        });
	}
    
    console.log('inserted ' + numObjects + ' documents');
}

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
		autoloadCallback: dbLoaded
	});
}

function dbLoaded() {
    console.log('loaded database from indexed db');
	var itemsColl = db.getCollection('items');
    console.log('number of docs in items collection: ' + itemsColl.count());
	serializedLength = db.serialize().length;
	console.log('size of reloaded database length : ' + serializedLength);
}

// set up async pauses between steps to keep browser from 
// stopping long running random object generation step
step1InsertObjects();
step2CalcSerializeSize();
//step3SaveDatabase();
//step4ReloadDatabase();