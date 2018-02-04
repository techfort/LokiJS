/**
 * Sorting benchmark for comparing performance of sorting in various conditions.
 *
 * This benchmark was added to benchmark benefits of leveraging binary indices
 * to sort results -after- filtering had occurred.
 *
 * Typically, only the first indexed operation is able to use indices.
 * 
 * This benchmark will assume we are filtering at least 1 document and attempting
 * to perform a simplesort.
 *
 * Since we are working with a filtered resultset, in order to leverage the 
 * sorting index we have applied on a separate property we will employ 
 * a devised set intersection algorithm to reduce the (full) sort property binary index
 * by the actual documents in our resultset.  
 *
 * The mechanism we are using to optimally intersect arrays involves creating an 
 * 'inclusion' (hash) object for document indices in our resultset and then 
 * filtering (array scan) the sort property binary index, testing for each element's
 * inclusion in our inclusion object.
 *
 * Initial testing seems to indicate that our new algorithm is typically more efficient
 * than our previous simplesort() as long you were not able to filter more than 10% of 
 * total collection documents.  It's performance seems be directly correlated with 
 * your filtering ineffectiveness.  That means that the performance of the new simplesort 
 * over the old simplesort algorithm is greater when you were only able to filter 20% 
 * of total documents than if you were able to filter 80%).
 *
 * Since the roughly "10% or more" filtering rule seems to apply no matter how 
 * large dataset is, we have created another simplesort implementation which 
 * calculates ratio of current resultset documents to total documents and 
 * invokes either the old 'sort' codepath or the new index intersect algorithm.
 */
 
var loki = require('../src/lokijs.js');

// Total document count to seed database with
var DOCUMENT_COUNT = 60000;
// Variations of values to apply to our filter property, as well as queries.
// A value of 10 means we will generate and query values from 0-9 (10% hits) 
// Entering values of 10 or below should (on average) use our new intersect alg.
var QUERY_INDEX_RANGE = 5;

// Sorting index range of 10000 just means (out of 40k docs), there will be roughly 4 docs for every unique 'b' sort value
// I don't expect tweaking this param will yield significant differences but to be safe we can try best/worst (high/low) cases.
var SORTING_INDEX_RANGE = 4000;

var P1_ITER = 100;
var P2_ITER = 200;
var P3_ITER = 200;
var P4_ITER = 200;

var db, coll;
 
function createDatabase(isIndexed) {
  var idx, a, b;
  
  db = new loki('sorting-bench.db');
   
  // we will always apply index to our filter column.
  // our variation will be whether the sort column is also indexed.
  if (isIndexed) {   
    coll = db.addCollection('profile', { indices: ['a', 'b'] });
  }
  else {
    coll = db.addCollection('profile', { indices: ['a'] });
  }
  
  for(idx=0;idx<DOCUMENT_COUNT;idx++) {
    a = Math.floor(Math.random() * QUERY_INDEX_RANGE);
    b = Math.floor(Math.random() * SORTING_INDEX_RANGE);
    coll.insert({ "a": a, "b": b });
  }
}

// unindexed, unfiltered
function profile1() {
  var start, end;
  var totalTimes = [];
  var totalMS = 0;
  var loopIterations = P1_ITER;
  var idx, results;
  
  createDatabase(false);
  
  for(idx=0; idx<P1_ITER; idx++) {
    start = process.hrtime();

    results = coll.chain().simplesort("b").data();

    end = process.hrtime(start);
    totalTimes.push(end);
  }
  
  for (var idx = 0; idx < totalTimes.length; idx++) {
    totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1] / 1e6;
  }

  totalMS = totalMS.toFixed(2);
  var rate = loopIterations * 1000 / totalMS;
  rate = rate.toFixed(2);
  console.log("'a' unfiltered, 'b' unindexed : " + totalMS + "ms (" + rate + " ops/s) " + loopIterations + " iterations");
}

function sortfun(obj1, obj2) {
  if (obj1.b === obj2.b) return 0;
  if (obj1.b > obj2.b) return 1;
  if (obj1.b < obj2.b) return -1;
}

// unindexed, unfiltered, minimal sort function (pre-jitted)
function profile1a() {
  var start, end;
  var totalTimes = [];
  var totalMS = 0;
  var loopIterations = P1_ITER;
  var idx, results;
  
  createDatabase(false);
  
  for(idx=0; idx<P1_ITER; idx++) {
    start = process.hrtime();

    results = coll.chain().sort(sortfun).data();

    end = process.hrtime(start);
    totalTimes.push(end);
  }
  
  for (var idx = 0; idx < totalTimes.length; idx++) {
    totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1] / 1e6;
  }

  totalMS = totalMS.toFixed(2);
  var rate = loopIterations * 1000 / totalMS;
  rate = rate.toFixed(2);
  console.log("'a' unfiltered, 'b' unindexed (minimal sort function) : " + totalMS + "ms (" + rate + " ops/s) " + loopIterations + " iterations");
}

function profile2() {
  var start, end;
  var totalTimes = [];
  var totalMS = 0;
  var loopIterations = P3_ITER;
  var idx, compare, results;
  
  createDatabase(true);
  
  for(idx=0; idx<loopIterations; idx++) {
    compare = Math.floor(Math.random() * QUERY_INDEX_RANGE);
    
    start = process.hrtime();

    results = coll.chain().simplesort("b").data();

    end = process.hrtime(start);
    totalTimes.push(end);
  }
  
  for (var idx = 0; idx < totalTimes.length; idx++) {
    totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1] / 1e6;
  }

  totalMS = totalMS.toFixed(2);
  var rate = loopIterations * 1000 / totalMS;
  rate = rate.toFixed(2);
  console.log("'a' unfiltered, 'b' indexed : " + totalMS + "ms (" + rate + " ops/s) " + loopIterations + " iterations");
}

// filtered, unindexed
function profile3() {
  var start, end;
  var totalTimes = [];
  var totalMS = 0;
  var loopIterations = P2_ITER;
  var idx, compare, results;
  
  createDatabase(false);
  
  for(idx=0; idx<loopIterations; idx++) {
    compare = Math.floor(Math.random() * QUERY_INDEX_RANGE);
    
    start = process.hrtime();

    results = coll.chain().find({a:compare}).simplesort("b").data();

    end = process.hrtime(start);
    totalTimes.push(end);
  }
  
  for (var idx = 0; idx < totalTimes.length; idx++) {
    totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1] / 1e6;
  }

  totalMS = totalMS.toFixed(2);
  var rate = loopIterations * 1000 / totalMS;
  rate = rate.toFixed(2);
  console.log("'a' filtered, 'b' unindexed : " + totalMS + "ms (" + rate + " ops/s) " + loopIterations + " iterations");
}

// filtered, unindexed, minimal sort function (pre-jitted)
function profile3a() {
  var start, end;
  var totalTimes = [];
  var totalMS = 0;
  var loopIterations = P2_ITER;
  var idx, compare, results;
  
  createDatabase(false);
  
  for(idx=0; idx<loopIterations; idx++) {
    compare = Math.floor(Math.random() * QUERY_INDEX_RANGE);
    
    start = process.hrtime();

    results = coll.chain().find({a:compare}).sort(sortfun).data();

    end = process.hrtime(start);
    totalTimes.push(end);
  }
  
  for (var idx = 0; idx < totalTimes.length; idx++) {
    totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1] / 1e6;
  }

  totalMS = totalMS.toFixed(2);
  var rate = loopIterations * 1000 / totalMS;
  rate = rate.toFixed(2);
  console.log("'a' filtered, 'b' unindexed (minimal sort function) : " + totalMS + "ms (" + rate + " ops/s) " + loopIterations + " iterations");
}

// filtered, unindexed useJavascriptSorting (runtime jit)
function profile3b() {
  var start, end;
  var totalTimes = [];
  var totalMS = 0;
  var loopIterations = P2_ITER;
  var idx, compare, results;
  
  createDatabase(false);
  
  for(idx=0; idx<loopIterations; idx++) {
    compare = Math.floor(Math.random() * QUERY_INDEX_RANGE);
    
    start = process.hrtime();

    // if we had enabled an index but wanted to force js sorting we would also pass 'disableIndexItercept:true'
    results = coll.chain().find({a:compare}).simplesort('b', { useJavascriptSorting: true }).data();

    end = process.hrtime(start);
    totalTimes.push(end);
  }
  
  for (var idx = 0; idx < totalTimes.length; idx++) {
    totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1] / 1e6;
  }

  totalMS = totalMS.toFixed(2);
  var rate = loopIterations * 1000 / totalMS;
  rate = rate.toFixed(2);
  console.log("'a' filtered, 'b' unindexed (useJavascriptSorting) : " + totalMS + "ms (" + rate + " ops/s) " + loopIterations + " iterations");
}

function profile4() {
  var start, end;
  var totalTimes = [];
  var totalMS = 0;
  var loopIterations = P4_ITER;
  var idx, compare, results;
  
  createDatabase(true);
  
  for(idx=0; idx < loopIterations; idx++) {
    compare = Math.floor(Math.random() * QUERY_INDEX_RANGE);
    
    start = process.hrtime();

    results = coll.chain().find({a:compare}).simplesort("b", { disableIndexIntersect: true }).data();

    end = process.hrtime(start);
    totalTimes.push(end);
  }
  
  for (var idx = 0; idx < totalTimes.length; idx++) {
    totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1] / 1e6;
  }

  totalMS = totalMS.toFixed(2);
  var rate = loopIterations * 1000 / totalMS;
  rate = rate.toFixed(2);
  console.log("'a' filtered, 'b' indexed (old simplesort) : " + totalMS + "ms (" + rate + " ops/s) " + loopIterations + " iterations");
}
 
function profile5() {
  var start, end;
  var totalTimes = [];
  var totalMS = 0;
  var loopIterations = P4_ITER;
  var idx, compare, results;
  
  createDatabase(true);
  
  for(idx=0; idx < loopIterations; idx++) {
    compare = Math.floor(Math.random() * QUERY_INDEX_RANGE);
    
    start = process.hrtime();

    results = coll.chain().find({a:compare}).simplesort("b", { forceIndexIntersect: true}).data();

    end = process.hrtime(start);
    totalTimes.push(end);
  }
  
  for (var idx = 0; idx < totalTimes.length; idx++) {
    totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1] / 1e6;
  }

  totalMS = totalMS.toFixed(2);
  var rate = loopIterations * 1000 / totalMS;
  rate = rate.toFixed(2);
  console.log("'a' filtered, 'b' indexed (x-sect): " + totalMS + "ms (" + rate + " ops/s) " + loopIterations + " iterations");
}
 
// using 'smart?' simplesort which attempts to determine whether
// array intersect or array sort would be more efficient.
// by default the fallback is to loki sorting (same order as indexes)
function profile6() {
  var start, end;
  var totalTimes = [];
  var totalMS = 0;
  var loopIterations = P4_ITER;
  var idx, compare, results;
  
  createDatabase(true);
  
  for(idx=0; idx < loopIterations; idx++) {
    compare = Math.floor(Math.random() * QUERY_INDEX_RANGE);
    
    start = process.hrtime();

    results = coll.chain().find({a:compare}).simplesort("b").data();

    end = process.hrtime(start);
    totalTimes.push(end);
  }
  
  for (var idx = 0; idx < totalTimes.length; idx++) {
    totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1] / 1e6;
  }

  totalMS = totalMS.toFixed(2);
  var rate = loopIterations * 1000 / totalMS;
  rate = rate.toFixed(2);
  console.log("'a' filtered, 'b' indexed (smart): " + totalMS + "ms (" + rate + " ops/s) " + loopIterations + " iterations");
}
 
// using 'smart' simplesort with fallback to 'useJavascriptSorting' if filtering
function profile7() {
  var start, end;
  var totalTimes = [];
  var totalMS = 0;
  var loopIterations = P4_ITER;
  var idx, compare, results;
  
  createDatabase(true);
  
  for(idx=0; idx < loopIterations; idx++) {
    compare = Math.floor(Math.random() * QUERY_INDEX_RANGE);
    
    start = process.hrtime();

    results = coll.chain().find({a:compare}).simplesort("b", { useJavascriptSorting: true }).data();

    end = process.hrtime(start);
    totalTimes.push(end);
  }
  
  for (var idx = 0; idx < totalTimes.length; idx++) {
    totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1] / 1e6;
  }

  totalMS = totalMS.toFixed(2);
  var rate = loopIterations * 1000 / totalMS;
  rate = rate.toFixed(2);
  console.log("'a' filtered, 'b' indexed (smart w/js fallback): " + totalMS + "ms (" + rate + " ops/s) " + loopIterations + " iterations");
}
 
console.log("loki sorting benchmark diagnostic");
console.log("---------------------------------");
console.log("DOCUMENT_COUNT      : " + DOCUMENT_COUNT);
console.log("QUERY_INDEX_RANGE   : " + QUERY_INDEX_RANGE);
console.log("SORTING_INDEX_RANGE : " + SORTING_INDEX_RANGE);
console.log("");
console.log("average expected resultset size to be sorted: " + DOCUMENT_COUNT/QUERY_INDEX_RANGE);
console.log("expected filtering ratio : " + Math.floor(100-(1/QUERY_INDEX_RANGE)*100) + "%");
console.log("");
console.log("Running query+sorting benchmarks, please wait...");
console.log("");

profile1();
profile1a();
profile2();
profile3();
profile3a();
profile3b();
profile4();
profile5();
profile6();
profile7();