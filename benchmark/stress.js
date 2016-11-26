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

// number of collections to create and populate
var numCollections = 2;

// number of documents to populate -each- collection with

// For default loki adapter you will probably max out at around (350,000/numCollections) of our test documents before exceeding memory space
//var numObjects = 150000;

// For loki fs structured adapter you will probably max out at around (750,000/numCollections) of our test documents before exceeding memory space
var numObjects = 350000;

// #
// # USE ONE method or another and make sure to match in destress.js
// #

// Using : default loki fs adapter serialization
/*
var db = new loki('sandbox.db', {
          verbose: true
          //serializationMethod: "normal"
});
*/

// Using : loki fs structured adapter
var db = new loki('sandbox.db', {
          verbose: true,
          adapter: adapter
});

// generate random 100 character string
// using a more memory (overhead) efficient algorithm found at :
// http://stackoverflow.com/a/8084248
function genRandomVal() {
  return Math.random().toString(36).substr(2, 100);
}

function stepInsertObjects() {
	var cidx, idx;

  for (cidx=0; cidx < numCollections; cidx++) {
    var items = db.addCollection('items' + cidx);
    
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
  }
  text = "";
  console.log('inserted ' + numObjects + ' documents');
}

function stepSaveDatabase() {
  var start, end;

  start = process.hrtime();

	db.saveDatabase(function(err) {
		if (err === null) {
      console.log('finished saving database');
      logMemoryUsage("after database save : ");
      end = process.hrtime(start);
      console.info("database save time : %ds %dms", end[0], end[1]/1000000);
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

function formatBytes(bytes,decimals) {
   if(bytes == 0) return '0 Byte';
   var k = 1000; // or 1024 for binary
   var dm = decimals + 1 || 3;
   var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
   var i = Math.floor(Math.log(bytes) / Math.log(k));
   return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function logMemoryUsage(msg) {
  var pmu = process.memoryUsage();
  console.log(msg + " > rss : " + formatBytes(pmu.rss) + " heapTotal : " + formatBytes(pmu.heapTotal) + " heapUsed : " + formatBytes(pmu.heapUsed));
}

logMemoryUsage("before document inserts : ");
stepInsertObjects();

logMemoryUsage("after document inserts : ");
stepSaveDatabase();

