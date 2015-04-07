// var loki = require('../src/lokijs.js'),
var db = new loki('perftest'),
    samplecoll = null,
    arraySize = 5000,			// how large of a dataset to generate
    totalIterations = 20000,	// how many times we search it
    results = [],
    getIterations = 2000000;	// get is crazy fast due to binary search so this needs separate scale

var domElement = null;
    

function genRandomVal()
{
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 20; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

// in addition to the loki id we will create a key of our own
// (customId) which is number from 1- totalIterations
// we will later perform find() queries against customId with and
// without an index

function initializeDB() {
	db = new loki('perftest');

	var start, end, totalTime;
	var totalTimes = [];
	var totalMS = 0.0;

	samplecoll = db.addCollection('samplecoll');
  /*
    {
      asyncListeners: true,
      disableChangesApi: true,
      transactional: false,
      clone: false
    }
  );
  */

	for (var idx=0; idx < arraySize; idx++) {
   	var v1 = genRandomVal();
    var v2 = genRandomVal();

		// start = process.hrtime();
    start = performance.now();
    	samplecoll.insert({
			customId: idx,
			val: v1,
			val2: v2,
			val3: "more data 1234567890"
		});
		end = performance.now() - start;
 		totalTimes.push([0, end * 1e6]);
   }

	for(var idx=0; idx < totalTimes.length; idx++) {
		totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1]/1e6;
	}


	//var totalMS = end[0] * 1e3 + end[1]/1e6;
	totalMS = totalMS.toFixed(2);
	var rate = arraySize * 1000 / totalMS;
	rate = rate.toFixed(2);
    trace("load (insert) : " + totalMS + "ms (" + rate + ") ops/s");
}

/**
 * initializeWithEval : repeat of insert bench with a dynamic view registered.
 *    All inserts will be passed into the view's evaluateDocument() method.
 *    This test is an attempt to gauge the level of impact of that overhead.
 */
function initializeWithEval() {
	var dbTest = new loki('perfInsertWithEval');

	var start, end, totalTime;
	var totalTimes = [];
	var totalMS = 0.0;

	var coll = dbTest.addCollection('samplecoll',
    {
      indices: ['customId'],
      asyncListeners: false,
      disableChangesApi: true,
      transactional: false,
      clone: false
    }
  );

  var dv = coll.addDynamicView('test');
  dv.applyFind({'customId': {'$lt': arraySize/4 }});

	for (var idx=0; idx < arraySize; idx++) {
    var v1 = genRandomVal();
    var v2 = genRandomVal();

		// start = process.hrtime();
    start = performance.now();
   	coll.insert({
			customId: idx,
			val: v1,
			val2: v2,
			val3: "more data 1234567890"
		});
		// end = process.hrtime(start);
    end = performance.now() - start;
 		totalTimes.push([0, end * 1e6]);
   }

	for(var idx=0; idx < totalTimes.length; idx++) {
		totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1]/1e6;
	}

	totalMS = totalMS.toFixed(2);
	var rate = arraySize * 1000 / totalMS;
	rate = rate.toFixed(2);
    trace("load (insert with dynamic view registered) : " + totalMS + "ms (" + rate + ") ops/s");
}

function testperfGet() {
	var start, end;
	var totalTimes = [];
	var totalMS = 0.0;

	for (var idx=0; idx < getIterations; idx++) {
    	var customidx = Math.floor(Math.random() * arraySize) + 1;

		// start = process.hrtime();
    start = performance.now();
        var results = samplecoll.get(customidx);
		// end = process.hrtime(start);
    end = performance.now() - start;
		totalTimes.push([0, end * 1e6]);
    }

	for(var idx=0; idx < totalTimes.length; idx++) {
		totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1]/1e6;
	}

	totalMS = totalMS.toFixed(2);
	var rate = getIterations * 1000 / totalMS;
	rate = rate.toFixed(2);
	trace("coll.get() : " + totalMS + "ms (" + rate + ") ops/s");
}

function testperfFind(multiplier) {
	var start, end;
	var totalTimes = [];
	var totalMS = 0;

	var loopIterations = totalIterations;
	if (typeof(multiplier) != "undefined") {
		loopIterations = loopIterations * multiplier;
	}

	for (var idx=0; idx < loopIterations; idx++) {
    	var customidx = Math.floor(Math.random() * arraySize) + 1;

		// start = process.hrtime();
    start = performance.now();
        var results = samplecoll.find({ 'customId': customidx });
		// end = process.hrtime(start);
    end = performance.now() - start;
		totalTimes.push([0, end * 1e6]);
    }

	for(var idx=0; idx < totalTimes.length; idx++) {
		totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1]/1e6;
	}

	totalMS = totalMS.toFixed(2);
	var rate = loopIterations * 1000 / totalMS;
	rate = rate.toFixed(2);
	trace("coll.find() : " + totalMS + "ms (" + rate + " ops/s) " + loopIterations + " iterations");
}

function testperfRS(multiplier) {
	var start, end;
	var totalTimes = [];
	var totalMS = 0;

	var loopIterations = totalIterations;
	if (typeof(multiplier) != "undefined") {
		loopIterations = loopIterations * multiplier;
	}

	for (var idx=0; idx < loopIterations; idx++) {
    	var customidx = Math.floor(Math.random() * arraySize) + 1;

		// start = process.hrtime();
    start = performance.now();
        var results = samplecoll.chain().find({ 'customId': customidx }).data();
		// end = process.hrtime(start)
    end = performance.now() - start;
		totalTimes.push([0, end * 1e6]);
    }

	for(var idx=0; idx < totalTimes.length; idx++) {
		totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1]/1e6;
	}

	totalMS = totalMS.toFixed(2);
	var rate = loopIterations * 1000 / totalMS;
	rate = rate.toFixed(2);
	trace("resultset chained find() :  " + totalMS + "ms (" + rate + " ops/s) " + loopIterations + " iterations");
}

function testperfDV(multiplier) {
	var start, end;
	var start2, end2, totalTime2 = 0.0;
	var totalTimes = [];
	var totalTimes2 = [];
	var totalMS = 0;
	var totalMS2 = 0;

	var loopIterations = totalIterations;
	if (typeof(multiplier) != "undefined") {
		loopIterations = loopIterations * multiplier;
	}

	for (var idx=0; idx < loopIterations; idx++) {
    	var customidx = Math.floor(Math.random() * arraySize) + 1;

		// start = process.hrtime();
    start = performance.now();
		var dv = samplecoll.addDynamicView("perfview");
        dv.applyFind({ 'customId': customidx });
        var results = dv.data();
		// end = process.hrtime(start);
    end = performance.now() - start;
		totalTimes.push([0, end * 1e6]);

      	// test speed of repeated query on an already set up dynamicview
      	// start2 = process.hrtime();
        start2 = performance.now();
        var results = dv.data();
        // end2 = process.hrtime(start2);
        end2 = performance.now() - start2;
		totalTimes2.push([0, end2 * 1e6]);

        samplecoll.removeDynamicView("perfview");
    }

	for(var idx=0; idx < totalTimes.length; idx++) {
		totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1]/1e6;
		totalMS2 += totalTimes2[idx][0] * 1e3 + totalTimes2[idx][1]/1e6;
	}

	totalMS = totalMS.toFixed(2);
	totalMS2 = totalMS2.toFixed(2);
	var rate = loopIterations * 1000 / totalMS;
	var rate2 = loopIterations * 1000 / totalMS2;
	rate = rate.toFixed(2);
	rate2 = rate2.toFixed(2);

	trace("loki dynamic view first find : " + totalMS + "ms (" + rate + " ops/s) " + loopIterations + " iterations");
	trace("loki dynamic view subsequent finds : " + totalMS2 + "ms (" + rate2 + " ops/s) " + loopIterations + " iterations");
}

function trace(string) 
{
    domElement.innerHTML = domElement.innerHTML + string + "<br/>";
}

// async yielding after each step to avoid browser warnings of long running scripts
function runStep(step) 
{
  switch (step) {
    case 1 : 
      trace("-- Beginning benchmark --");
      initializeDB();
      setTimeout(function() { runStep(2) }, 100);
      break;
    case 2 : 
      testperfGet();
      setTimeout(function() { runStep(3) }, 100);
      trace("");
      trace("-- Benchmarking query on non-indexed column --");
      break;
    case 3 : 
      testperfFind();	// find benchmark on unindexed customid field
      setTimeout(function() { runStep(4) }, 100);
      break;
    case 4 : 
      testperfRS();	// resultset find benchmark on unindexed customid field
      setTimeout(function() { runStep(5) }, 100);
      break;
    case 5 : 
      testperfDV();
      setTimeout(function() { runStep(6) }, 100);
      trace("");
      trace("-- Adding Binary Index to query column and repeating benchmarks --");
      break;
    case 6 : 
      samplecoll.ensureIndex("customId");
      setTimeout(function() { runStep(7) }, 100);
      break;
    case 7 : 
      testperfFind(20);
      setTimeout(function() { runStep(8) }, 100);
      break;
    case 8 : 
      testperfRS(15);
      setTimeout(function() { runStep(9) }, 100);
      break;
    case 9 : 
      testperfDV(15);
      trace("");
      trace("done.");
      break;
  }
}

function startBenchmark(divElement) 
{
  domElement = divElement;

  // async yielding after each step to avoid browser warnings of long running scripts
  runStep(1);
  
  /*
  initializeDB();

  testperfGet();	// get bechmark on id field

  trace("-- Benchmarking query on NON-INDEXED column --");

  testperfFind();	// find benchmark on unindexed customid field
  testperfRS();	// resultset find benchmark on unindexed customid field
  testperfDV();	// dataview find benchmarks on unindexed customid field

  trace("");
  trace("-- ADDING BINARY INDEX to query column and repeating benchmarks --");
  samplecoll.ensureIndex("customId");
  testperfFind(20);
  testperfRS(15);
  testperfDV(15);
  */
}