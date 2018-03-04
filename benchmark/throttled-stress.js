/**
 * This stress test is designed to test effectiveness of throttled saves in
 * worst-case scenarios.  
 * 
 * In order to stress overlapping saves we will use an async adapter along 
 * with synchronous logic with many calls to save in which we do not wait 
 * for the save to complete before attempting to save again.  This usage
 * pattern is not recommended but lokijs throttled saves is intended to 
 * safeguard against it.
 * 
 * The test will verify that nothing is lost when this usage pattern is 
 * used by comparing the database when we are done with the copy in memory.
 * 
 * We are forced to consider async adapter behavior on final save and reload,
 * since throttled saves protect only within a single loki object instance.
 * You must still wait after for the throttled queue to drain after finishing 
 * before you can attempt to reload it and you must wait for the database 
 * to finish loading before you can access its contents.
 */

var crypto = require("crypto"); // for random string generation
var loki = require('../src/lokijs.js');

const INITIALCOUNT = 2000;
const ITERATIONS = 2000;
const RANGE = 1000;

// synchronous adapter using LokiMemoryAdapter
var memAdapterSync = new loki.LokiMemoryAdapter();

// simulate async adapter with 100ms save/load times
var memAdapterAsync = new loki.LokiMemoryAdapter({
    asyncResponses: true,
    asyncTimeout: 100
});

var db, db2;
var maxThrottledCalls = 0;

// less memory 'leaky' way to generate random strings (node specific)
function genRandomString() {
  return crypto.randomBytes(50).toString('hex');
}

function genRandomObject() {
  var av = Math.floor(Math.random() * RANGE);
  var cv = Math.floor(Math.random() * RANGE);
  
  return { "a": av, "b": genRandomString(), "c": cv };
}

function setupDatabaseSync() {
    var newDatabase = new loki("throttle-test.db", { adapter: memAdapterSync });

    // since our memory adapter is by default synchronous (unless simulating async),
    // we can assume any load will complete before our next statement executes.
    newDatabase.loadDatabase();

    // initialize collections
    if (!newDatabase.getCollection("items")) {
        newDatabase.addCollection("items");
    }

    return newDatabase;
}

function setupDatabaseAsync(callback) {
    var newDatabase = new loki("throttle-test.db", { adapter: memAdapterAsync });

    // database won't exist on first pass, but let's use forced
    // async syntax in case is did
    newDatabase.loadDatabase({}, function(err) {
        if (err) {
            callback(err);
        }

        // initialize collections
        if (!newDatabase.getCollection("items")) {
            newDatabase.addCollection("items");

            // bad practice, stress test
            newDatabase.saveDatabase();
        }

        callback(err);
    });

    return newDatabase;
}

function performStressedOps() {
    var items = db.getCollection("items");
    var idx, op;

    for(idx=0;idx<INITIALCOUNT;idx++) {
        items.insert(genRandomObject());

        // bad practice, stress test
        db.saveDatabase();

        if (db.throttledCallbacks.length > maxThrottledCalls) {
            maxThrottledCalls = db.throttledCallbacks.length;
        }
    }

    for(idx=0;idx<ITERATIONS;idx++) {
        // randomly determine if this permutation will be insert/update/remove
        op = Math.floor(Math.random() * 3); 
        switch(op) {
          // insert
          case 0: items.insert(genRandomObject()); 
                  break;
          // update
          case 1: rnd = Math.floor(Math.random() * RANGE);
                  items.chain().find({a:rnd}).update(function(obj) { 
                    obj.a = Math.floor(Math.random() * RANGE); 
                    obj.c = Math.floor(Math.random() * RANGE); 
                    obj.b = genRandomString();
                  });
                  break;
          // remove 2 matches of a single value in our range
          case 2: rnd = Math.floor(Math.random() * RANGE);
                  items.chain().find({a:rnd}).limit(1).remove();
                  break;
        }

        db.saveDatabase();
        if (db.throttledCallbacks.length > maxThrottledCalls) {
            maxThrottledCalls = db.throttledCallbacks.length;
        }
      }
}

function compareDatabases() {
    var c1 = db.getCollection("items");
    var c2 = db2.getCollection("items");
    var idx;

    var count = c1.count();
    if (count !== c2.count()) return false;

    for(idx=0; idx < count; idx++) {
        if (c1.data[idx].a !== c2.data[idx].a) return false;
        if (c1.data[idx].b !== c2.data[idx].b) return false;
        if (c1.data[idx].c !== c2.data[idx].c) return false;
        if (c1.data[idx].$loki !== c2.data[idx].$loki) return false;
    }

    return true;
}

console.log("");

// let's test in truly sync manner
var start = process.hrtime();
db = setupDatabaseSync();
performStressedOps();
db.saveDatabase();
db2 = setupDatabaseSync();
var end = process.hrtime(start);
var result = compareDatabases();
console.log("## Fully synchronous operations with excessive saving after each operation ##");
console.log("Database are " + (result?"the same.":"NOT the same!"));
console.log("Execution time (hr): %ds %dms", end[0], end[1]/1000000);
console.log("maxThrottledCalls: " + maxThrottledCalls);

console.log("");

// now let's test with simulated async adpater
// first pass setup will create in memory
start = process.hrtime();
db = setupDatabaseAsync(function() {
    performStressedOps();

    // go ahead and do a final save (even though we save after every op)
    // and then wait for queue to drain before trying to reload it.
    db.saveDatabase();
    db.throttledSaveDrain(function () {
        db2 = setupDatabaseAsync(function () {
            var end = process.hrtime(start);
            var result = compareDatabases();

            console.log("## Asynchronous operations with excessive saving after each operation ##");
            console.log("Async database are " + (result?"the same.":"NOT the same!"));
            console.log("Execution time (hr): %ds %dms", end[0], end[1]/1000000);
            console.log("maxThrottledCalls: " + maxThrottledCalls);
        });
    });
});

