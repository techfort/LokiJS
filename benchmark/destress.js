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
var db;
var start, end;

//var serializationMethod = "normal";
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

function reloadDatabase() {
  start = process.hrtime();

  // loki fs structured adapter
  db = new loki('sandbox.db', {
    verbose: true,
    autoload: true,
    autoloadCallback: dbLoaded,
    adapter:adapter
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

function dbLoaded() {
  end = process.hrtime(start);
  console.info("database loaded... time : %ds %dms", end[0], end[1]/1000000);
	var doccount =0, cidx;
  db.collections.forEach(function(coll) {
    doccount += coll.data.length;
  })

  logMemoryUsage("After loading database : ");
  console.log('number of docs in items collection(s) : ' + doccount);
  
  // if you want to verify that only dirty collections are saved (and thus faster), uncomment line below
  //dirtyCollAndSaveDatabase();
}

function dirtyCollAndSaveDatabase() {
  var start, end;

  start = process.hrtime();

  // dirty up a collection and save to see if just that collection (along with db) gets written
  db.collections[0].insert({ a: 1, b : 2});
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

logMemoryUsage("Before loading database : ");
reloadDatabase();
