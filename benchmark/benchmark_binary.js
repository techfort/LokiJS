/**
 * This module is to be used to benchmark loki binary index lifecycle
 *
 * Attempt to simulate and benchmark effects of various rebuild strategies on
 * insert, find, remove, and update to be used to instrument refactorings/optimizations.
 *
 * Ideally a little overhead would be added to insert/update/remove ops to maintain the index
 *   rather than flag for full rebuild.
 *
 * This approach would definitely improve performance when insert/find ops are interlaced 1:1.
 * 
 * We should also wish to guage penalty of overhead when items are inserted consecutively, but
 *   not in batch array.
 *
 * Analysis of results might determine whether different rebuild strategies are configured via options.
 *
 * Refactorings of index rebuild strategies also need to be coordinated with extensive unit testing.
 */
 

var loki = require('../src/lokijs.js'),
  db = new loki('binary index perf'),
  samplecoll = null,
  uniquecoll = null,
  arraySize = 5000, // default, we usually override when calling init functions
  totalIterations = 20000, // how many times we search it
  results = [],
  getIterations = 2000000; // get is crazy fast due to binary search so this needs separate scale

function genRandomVal() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < 20; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

// in addition to the loki id we will create a key of our own
// (customId) which is number from 1- totalIterations
// we will later perform find() queries against customId with and 
// without an index

function createDatabaseUnindexed() {
  db = new loki('binary index perf');

  samplecoll = db.addCollection('samplecoll'); 
}

function createDatabaseIndexed(adaptive) {
  db = new loki('binary index perf');

  samplecoll = db.addCollection('samplecoll', {
      adaptiveBinaryIndices: (adaptive === true),
      indices: ['customId']
  }); 
}

// scenario for many individual, consecutive inserts
function initializeDatabase(silent, docCount) {
  var start, end, totalTime;
  var totalTimes = [];
  var totalMS = 0.0;

  if (typeof docCount === "undefined") {
    docCount = 5000;
  }

  arraySize = docCount;

  for (var idx = 0; idx < arraySize; idx++) {
    var v1 = genRandomVal();
    var v2 = genRandomVal();

    start = process.hrtime();
    samplecoll.insert({
      customId: idx,
      val: v1,
      val2: v2,
      val3: "more data 1234567890"
    });
    end = process.hrtime(start);
    totalTimes.push(end);
  }

  if (silent === true) {
    return;
  }

  for (var idx = 0; idx < totalTimes.length; idx++) {
    totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1] / 1e6;
  }

  // let's include final find which will probably punish lazy indexes more 
  start = process.hrtime();
  samplecoll.find({customIdx: 50});
  end = process.hrtime(start);
  totalTimes.push(end);

  //var totalMS = end[0] * 1e3 + end[1]/1e6;
  totalMS = totalMS.toFixed(2);
  var rate = arraySize * 1000 / totalMS;
  rate = rate.toFixed(2);
  console.log("load (individual inserts) : " + totalMS + "ms (" + rate + ") ops/s (" + arraySize + " documents)");
}

// silent : if true we wont log timing info to console
// docCount : number of random documents to generate collection with
function initializeDatabaseBatch(silent, docCount) {
  var start, end, totalTime;
  var totalTimes = [];
  var totalMS = 0.0;
  var batch = [];
  
  if (typeof docCount === "undefined") {
    docCount = 5000;
  }

  arraySize = docCount;

  for (var idx = 0; idx < arraySize; idx++) {
    var v1 = genRandomVal();
    var v2 = genRandomVal();

    batch.push({
      customId: idx,
      val: v1,
      val2: v2,
      val3: "more data 1234567890"
    });
  }

  start = process.hrtime();
  samplecoll.insert(batch);
  end = process.hrtime(start);
  totalTimes.push(end);

  if (silent === true) {
    return;
  }

  for (var idx = 0; idx < totalTimes.length; idx++) {
    totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1] / 1e6;
  }

  //var totalMS = end[0] * 1e3 + end[1]/1e6;
  totalMS = totalMS.toFixed(2);
  var rate = arraySize* 1000 / totalMS;
  rate = rate.toFixed(2);
  console.log("load (batch insert) : " + totalMS + "ms (" + rate + ") ops/s (" + arraySize + " documents)");
}

function perfFind(multiplier) {
  var start, end;
  var totalTimes = [];
  var totalMS = 0;

  var loopIterations = arraySize;
  if (typeof (multiplier) != "undefined") {
    loopIterations = loopIterations * multiplier;
  }

  for (var idx = 0; idx < loopIterations; idx++) {
    var customidx = Math.floor(Math.random() * arraySize) + 1;

    start = process.hrtime();
    var results = samplecoll.find({
      'customId': customidx
    });
    end = process.hrtime(start);
    totalTimes.push(end);
  }

  for (var idx = 0; idx < totalTimes.length; idx++) {
    totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1] / 1e6;
  }

  totalMS = totalMS.toFixed(2);
  var rate = loopIterations * 1000 / totalMS;
  rate = rate.toFixed(2);
  console.log("contiguous coll.find() : " + totalMS + "ms (" + rate + " ops/s) " + loopIterations + " iterations");
}

//  Find Interlaced Inserts ->  insert 5000, for 5000 more iterations insert same test obj after
function perfFindInterlacedInserts(multiplier) {
  var start, end;
  var totalTimes = [];
  var totalMS = 0;

  var loopIterations = arraySize;
  if (typeof (multiplier) != "undefined") {
    loopIterations = loopIterations * multiplier;
  }

  for (var idx = 0; idx < loopIterations; idx++) {
    var customidx = Math.floor(Math.random() * arraySize) + 1;

    start = process.hrtime();
    var results = samplecoll.find({
      'customId': customidx
    });
    // insert junk record, now (outside timing routine) to force index rebuild
    var obj = samplecoll.insert({
        customId: 999,
        val: 999,
        val2: 999,
        val3: "more data 1234567890"
    });  
    
    end = process.hrtime(start);
    totalTimes.push(end);
    
  }

  for (var idx = 0; idx < totalTimes.length; idx++) {
    totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1] / 1e6;
  }

  totalMS = totalMS.toFixed(2);
  var rate = loopIterations * 1000 / totalMS;
  rate = rate.toFixed(2);
  console.log("interlaced inserts + coll.find() : " + totalMS + "ms (" + rate + " ops/s) " + loopIterations + " iterations");
  
}

//  Find Interlaced Removes -> use linear customid for() loop find() and delete that obj when found
function perfFindInterlacedRemoves() {
  var start, end;
  var totalTimes = [];
  var totalMS = 0;

  for (var idx = 0; idx < arraySize; idx++) {
    //var customidx = Math.floor(Math.random() * arraySize) + 1;

    start = process.hrtime();
    var result = samplecoll.findOne({
      'customId': idx
    });
    // remove document now (outside timing routine) to force index rebuild
    samplecoll.remove(result); 
    
    end = process.hrtime(start);
    totalTimes.push(end);
  }

  for (var idx = 0; idx < totalTimes.length; idx++) {
    totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1] / 1e6;
  }

  totalMS = totalMS.toFixed(2);
  var rate = arraySize * 1000 / totalMS;
  rate = rate.toFixed(2);
  console.log("interlaced removes + coll.find() : " + totalMS + "ms (" + rate + " ops/s) " + arraySize + " iterations");
}

//  Find Interlaced Updates -> same as now except mix up customId val (increment by 10000?)
function perfFindInterlacesUpdates() {
  var start, end;
  var totalTimes = [];
  var totalMS = 0;

  for (var idx = 0; idx < arraySize; idx++) {
    //var customidx = Math.floor(Math.random() * arraySize) + 1;

    start = process.hrtime();
    var results = samplecoll.find({
      'customId': idx
    });
    // just call update on document to force index rebuild
    samplecoll.update(results[0]);
    
    end = process.hrtime(start);
    totalTimes.push(end);
  }

  for (var idx = 0; idx < totalTimes.length; idx++) {
    totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1] / 1e6;
  }

  totalMS = totalMS.toFixed(2);
  var rate = arraySize * 1000 / totalMS;
  rate = rate.toFixed(2);
  console.log("interlaced updates + coll.find() : " + totalMS + "ms (" + rate + " ops/s) " + arraySize + " iterations");
}

console.log("");
console.log("Perf: Unindexed Inserts---------------------");
createDatabaseUnindexed();
initializeDatabase(false, 100000);

createDatabaseUnindexed();
initializeDatabaseBatch(false, 100000);

console.log("");
console.log("Perf: Indexed Inserts (Lazy) ------------------------");
createDatabaseIndexed();
initializeDatabase(false, 100000);

createDatabaseIndexed();
initializeDatabaseBatch(false, 100000);

console.log("");
console.log("Perf: Indexed Inserts (Adaptive) ------------------------");
createDatabaseIndexed(true);
initializeDatabase(false, 100000);

createDatabaseIndexed(true);
initializeDatabaseBatch(false, 100000);

console.log("");
console.log("Perf: Unindexed finds ------------------------");

createDatabaseUnindexed();
initializeDatabase(true, 10000);
perfFind(); 

createDatabaseUnindexed();
initializeDatabase(true, 10000);
perfFindInterlacedInserts(); 

createDatabaseUnindexed();
initializeDatabase(true, 10000);
perfFindInterlacedRemoves();

createDatabaseUnindexed();
initializeDatabase(true, 10000);
perfFindInterlacesUpdates();

console.log("");
console.log("Perf: Indexed finds (Nightmare Lazy Index Thrashing Test) ------");

createDatabaseIndexed(false);
initializeDatabase(true, 80000);
perfFind(); 

createDatabaseIndexed(false);
initializeDatabase(true, 3000);
perfFindInterlacedInserts(1); 

createDatabaseIndexed(false);
initializeDatabase(true, 3000);
perfFindInterlacedRemoves();

createDatabaseIndexed(false);
initializeDatabase(true, 3000);
perfFindInterlacesUpdates();

console.log("");
console.log("Perf: Indexed finds (Nightmare Adaptive Index Thrashing Test) ---");

createDatabaseIndexed(true);
initializeDatabase(true, 80000);
perfFind(); 

createDatabaseIndexed(true);
initializeDatabase(true, 10000);
perfFindInterlacedInserts(1); 

createDatabaseIndexed(true);
initializeDatabase(true, 10000);
perfFindInterlacedRemoves();

createDatabaseIndexed(true);
initializeDatabase(true, 10000);
perfFindInterlacesUpdates();