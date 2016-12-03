'use strict';
// This script can be used to stress the ability of loki to save large databases.  
// I have found that within most javascript engines there seems to be memory 
// contraints and inefficiencies involved with using JSON.stringify.
//
// One way to limit memory overhead is to serialize smaller objects rather than
// one large (single) JSON.stringify of the whole database.  
//
// The LokiFsStructuredAdapter streams the database in an out as a series
// of smaller, individual serializations.  It also partitions database into 
//
// The native node fs adapter is hands down the most memory efficient and 
// fastest adapter if you are using node.js.  It accomplishes this by 
// using io streams to save and load the database to disk rather than saving 
// the whole database as a single string. 
//
// This stress can be used to analyse memory overhead for saving a loki database.
// Both stress.js and destress.js need to be configured to use the same serialization 
// method and adapter.  By default, this is configured to use the 
// loki-fs-structured-adapter which will stream output and input.

// On my first review i saw no significant benefit to "destructured" format if you
// are going to save in single file, but subsequent benchmarks show that saves
// are actually faster.  I wasn't expecting this and if i had to guess at why I would
// guess that by not doing one huge JSON.stringify, but instead doing many smaller 
// ones, that this is faster than whatever string manipulation they do in a single 
// deep object scan.  Since this serialization is done within db.saveDatabase()
// it showed up on my disk io benchmark portion of this stress test.

// The closer you get to running out of heap space, the less memory is left over 
// for io bufferring so saves are slower.  A few hundred megs of free heap space
// will keep db save io speeds from exponentially rising.

var crypto = require("crypto"); // for random string generation
var loki = require('../src/lokijs.js');
var lfsa = require('../src/loki-fs-structured-adapter.js');

// number of collections to create and populate
var numCollections = 2;

// number of documents to populate -each- collection with
// if using 2 collections, will probably max @ 75000, structured adapter @ 310000
var numObjects = 150000;  

// #
// # Choose -one- method of serialization and make sure to match in destress.js
// #

//var mode = "fs-normal";
//var mode = "fs-structured";
//var mode = "fs-partitioned";
var mode = "fs-structured-partitioned";

var adapter;

switch (mode) {
  case "fs-normal": 
  case "fs-structured": adapter = new loki.LokiFsAdapter(); break;
  case "fs-partitioned": adapter = new loki.LokiPartitioningAdapter(new loki.LokiFsAdapter()); break;
  case "fs-structured-partitioned" : adapter = new lfsa(); break;
  default:adapter = new loki.LokiFsAdapter(); break;
};

console.log(mode);

var db = new loki('sandbox.db', { 
  adapter : adapter, 
  serializationMethod: (mode === "fs-structured")?"destructured":"normal" 
});

// using less 'leaky' way to generate random strings
// node specific
function genRandomVal() {
  return crypto.randomBytes(50).toString('hex');
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

    console.log('inserted ' + numObjects + ' documents');
  }
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

