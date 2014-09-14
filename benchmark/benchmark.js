var loki = require('../src/lokijs.js'),
	db = new loki('perftest'),
    samplecoll = null,
    arraySize = 5000,			// how large of a dataset to generate
    totalIterations = 20000,	// how many times we search it
    results = [],
	getIterations = 2000000;	// get is crazy fast due to binary search so this needs separate scale
  
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
    
	start = process.hrtime();

	samplecoll = db.addCollection('samplecoll', 'samplecoll');
    
	for (var idx=0; idx < arraySize; idx++) {
    	//var v1 = genRandomVal();
        //var v2 = genRandomVal();
    	samplecoll.insert({ 
			customId: idx//, 
			//val: v1, 
			//val2: v2, 
			//val3: "more data 1234567890"
		});
    }
    
	end = process.hrtime(start);
    
    console.log("data load time : " + end[0] + "s " + end[1]/1e6 + "ms");
}

function testperfGet() {
	var start, end;
	var totalTimes = [];
	var totalMS = 0;
	
	for (var idx=0; idx < getIterations; idx++) {
    	var customidx = Math.floor(Math.random() * arraySize) + 1;
        
		start = process.hrtime();
        var results = samplecoll.get(customidx);
		end = process.hrtime(start);
		totalTimes.push(end);
    }
    
	for(var idx=0; idx < totalTimes.length; idx++) {
		totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1]/1e6;
	}
	console.log("loki coll.get() benchmark " + totalMS + "ms");
}

function testperfFind() {
	var start, end;
	var totalTimes = [];
	var totalMS = 0;
	
	for (var idx=0; idx < totalIterations; idx++) {
    	var customidx = Math.floor(Math.random() * arraySize) + 1;
        
		start = process.hrtime();
        var results = samplecoll.find({ 'customId': customidx });
		end = process.hrtime(start);
		totalTimes.push(end);
    }
    
	for(var idx=0; idx < totalTimes.length; idx++) {
		totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1]/1e6;
	}
	console.log("loki coll.find() benchmark " + totalMS + "ms");
}

function testperfRS() {
	var start, end;
	var totalTimes = [];
	var totalMS = 0;

	for (var idx=0; idx < totalIterations; idx++) {
    	var customidx = Math.floor(Math.random() * arraySize) + 1;
        
		start = process.hrtime();
        var results = samplecoll.chain().find({ 'customId': customidx }).data();
		end = process.hrtime(start)
		totalTimes.push(end);
    }
    
	for(var idx=0; idx < totalTimes.length; idx++) {
		totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1]/1e6;
	}
	
	console.log("loki coll.chain().find() benchmark " + totalMS + "ms");
}

function testperfDV() {
	var start, end;
	var start2, end2, totalTime2 = 0.0;
	var totalTimes = [];
	var totalTimes2 = [];
	var totalMS = 0;
	var totalMS2 = 0;
    
	for (var idx=0; idx < totalIterations; idx++) {
    	var customidx = Math.floor(Math.random() * arraySize) + 1;
       
		start = process.hrtime();
		var dv = samplecoll.addDynamicView("perfview");
        dv.applyFind({ 'customId': customidx });
        var results = dv.data();
		end = process.hrtime(start);
		totalTimes.push(end);
      
      	// test speed of repeated query on an already set up dynamicview
      	start2 = process.hrtime();
        var results = dv.data();
        end2 = process.hrtime(start2);
		totalTimes2.push(end2);
        
        samplecoll.removeDynamicView("perfview");
    }
    
	for(var idx=0; idx < totalTimes.length; idx++) {
		totalMS += totalTimes[idx][0] * 1e3 + totalTimes[idx][1]/1e6;
		totalMS2 += totalTimes2[idx][0] * 1e3 + totalTimes2[idx][1]/1e6;
	}
	
	console.log("loki dynamic view first find benchmark : " + totalMS + "ms");
	console.log("loki dynamic view subsequent find benchmark : " + totalMS2 + "ms");
}

initializeDB();

console.log("Benchmarking query on non-indexed column");
testperfGet();	// get bechmark on id field
testperfFind();	// find benchmark on unindexed customid field
testperfRS();	// resultset find benchmark on unindexed customid field
testperfDV();	// dataview find benchmarks on unindexed customid field

console.log("Adding index to query column and repeating benchmarks");
samplecoll.ensureIndex("customId");
testperfFind();
testperfRS();
testperfDV();
