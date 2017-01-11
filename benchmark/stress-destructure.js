// This script is meant to diagnose and stress the ability of loki to 
// internally serialize large databases.  I have found that within most
// javascript engines there seems to be memory contraints and inefficiencies  
// involved with using JSON.stringify.
//
// This example creates (by default) 130,000 randomly generated objects
// (each document being about 1.4k each)
// which, when serialized will evaluate to roughly a 100MB string.
//
// If you increase numObjects too high you will run out of memory
// when serializing for save.  In that case you might need to run 
// with a command line similar to (for about a 2GB mem allocation):
// node --max-old-space-size=2000 stress
//
// Browser environments have no such customization and appear to be 
// roughly limited to a roughly 2GB memory allocation.
//
// This script will be used as a reference for alternative serialization methods
// which have a much lower overhead than the above 100M/1.4GB ratio.

var loki = require('../src/lokijs.js');

var numObjects = 130000;

var db = new loki('sandbox.db', {
          verbose: true 
});
var items = db.addCollection('items');

// generate random 100 character string
// using a more memory (overhead) efficient algorithm found at :
// http://stackoverflow.com/a/8084248
function genRandomVal() {
  return Math.random().toString(36).substr(2, 100);
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
    text = "";
    console.log('inserted ' + numObjects + ' documents');
}

function step2CalcSerializeSize() {
//	var serializedLength = db.serialize().length;
//	console.log('size of original database length : ' + serializedLength);
}

function destructure() {
  var delim = "$<\n"; // move to database option
  var collCount = db.collections.length;
  var idx, docidx, doccount;
  var dstlines = [];
  
  // destructured format will serialize database along with collections without any data
  // as the first delimited string
  
  // make copy so that we do not alter original database
  // delete all data/object references from collection copy.
  var cdb = new loki(db.name);
  cdb.loadJSONObject(db);
  for(idx=0; idx < collCount; idx++) {
    cdb.collections[idx].data = [];
  }
  
  dstlines.push(cdb.serialize());

  // for each collection 
  for(idx=0; idx < collCount; idx++) {
    doccount = db.collections[idx].data.length;
    for(docidx=0; docidx<doccount; docidx++) {
      dstlines.push(JSON.stringify(db.collections[idx].data[docidx]));
    }
    dstlines.push("");
  }
  
  return dstlines.join(delim);
}

function step3SaveDatabase() {
  var result = destructure();
  console.log("destructured json length : " + result.length);
//	db.saveDatabase(function(err) {
//		if (err === null) {
//	    	console.log('finished saving database');
//	    }
//	    else {
//	    	console.log('error encountered saving database : ' + err);
//	    }
//	});
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

console.log(process.memoryUsage());

step2CalcSerializeSize();
step3SaveDatabase();
//step4ReloadDatabase();

console.log(process.memoryUsage());
