// This script can be used to stress the ability of loki to save large databases.  
// I have found that within most javascript engines there seems to be memory 
// contraints and inefficiencies involved with using JSON.stringify.
//
// One way to limit memory overhead is to serialize smaller objects rather than
// one large (single) JSON.stringify of the whole database.  Loki has added
// functionality to stream output of the database rather than saving a whole
// database as a single string. 
//
// This stress can be used to analyse memory overhead for saving a loki database.
// Both stress.js and destress.js need to be configured to use the same serialization 
// method and adapter.  By default, this is configured to use the 
// loki-fs-structured-adapter which will stream output and input.

var loki = require('../src/lokijs.js');
var lfsa = require('../src/loki-fs-structured-adapter.js');
var adapter = new lfsa();

// WARNING : large-ish 380M database will be created with default 700,000 value
var numObjects = 700000;

// use serializationMethod 
var serializationMethod = "normal";
//var serializationMethod = "pretty";
//var serializationMethod = "destructured";

// Currently using persistence adapter which implements its own
// serialization method.  To fallback to loki fs adapter, remove
// adapter option and enable serializationMethod both here and
// in destress.js to match.

var db = new loki('sandbox.db', {
          verbose: true,
          adapter: adapter
          //serializationMethod: serializationMethod
});
var items = db.addCollection('items');

// generate random 100 character string
// using a more memory (overhead) efficient algorithm found at :
// http://stackoverflow.com/a/8084248
function genRandomVal() {
  return Math.random().toString(36).substr(2, 100);
}

function stepInsertObjects() {
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

function stepSaveDatabase() {
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

function logMemoryUsage(msg) {
  console.log(msg);
  console.log(process.memoryUsage());
}

logMemoryUsage("before document inserts : ");
stepInsertObjects();

logMemoryUsage("after document inserts : ");
stepSaveDatabase();

logMemoryUsage("after database save : ");
