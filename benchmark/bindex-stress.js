/**
 * Utility script for stress-testing binary indices.
 *
 * We will randomly insert/update/remove objects with binary indices
 * and verify integrity after predefined number of permutations.
 */
 
var crypto = require("crypto"); // for random string generation
var loki = require('../src/lokijs.js');

var INITIAL_DOCUMENT_COUNT = 10000;
var ITERATION_COUNT = 40000; // number of permutations to perform
var INTEGER_RANGE = 1000;

var db, coll;
 
// less memory 'leaky' way to generate random strings (node specific)
function genRandomString() {
  return crypto.randomBytes(50).toString('hex');
}

function genRandomObject() {
  a = Math.floor(Math.random() * INTEGER_RANGE);
  
  return { "a": a, "b": genRandomString(), "c": 0 };
}

// create database, collection, and seed initial documents
function createDatabase() {
  var idx, a, b;
  
  db = new loki('sorting-bench.db');
   
  coll = db.addCollection('profile', { indices: ['a', 'b', 'c'] });
  
  for(idx=0;idx<INITIAL_DOCUMENT_COUNT;idx++) {
    coll.insert(genRandomObject());
  }
}

// create initial database
console.log("creating database...");
createDatabase();
console.log("initial document count:" + coll.count());
console.log("");

// perform random permutations
console.log("performing " + ITERATION_COUNT + " random permutations (inserts/updates/removes)...");

var results, rnd, len;

for(idx=0;idx<ITERATION_COUNT;idx++) {
  // randomly determine if this permutation will be insert/update/remove
  op = Math.floor(Math.random() * 3); 
  switch(op) {
    // insert
    case 0: coll.insert(genRandomObject()); 
            break;
    // update
    case 1: rnd = Math.floor(Math.random() * INTEGER_RANGE);
            coll.chain().find({a:rnd}).update(function(obj) { 
              obj.c = Math.floor(Math.random() * INTEGER_RANGE); 
              obj.b = genRandomString();
            });
            break;
    // remove 2 matches of a single value in our range
    case 2: rnd = Math.floor(Math.random() * INTEGER_RANGE);
            coll.chain().find({a:rnd}).limit(2).remove();
            break;
  }
}

// verify document count
console.log("final document count:" + coll.count());
console.log("coll.data.length:" + coll.data.length);
console.log("");

// verify index lengths
console.log("verifying index lengths...");
console.log("a index length : " + coll.binaryIndices['a'].values.length);
console.log("b index length : " + coll.binaryIndices['b'].values.length);
console.log("c index length : " + coll.binaryIndices['c'].values.length);
console.log("");

// verify index ordering
var aIsValid=true, bIsValid=true, cIsValid=true;

console.log("verifying 'a' index ordering...");
results = coll.chain().simplesort("a").data();
len = results.length;
for(idx=0; idx<len-1; idx++) {
  if (!loki.LokiOps.$lte(results[idx]['a'], results[idx+1]['a'])) {
    aIsValid=false;
    console.err("@idx:"+idx+ ": " + results[idx]['a'] + " is not $lte " + results[idx+1]['a']);
  }
}

console.log("verifying 'b' index ordering...");
results = coll.chain().simplesort("b").data();
len = results.length;
for(idx=0; idx<len-1; idx++) {
  if (!loki.LokiOps.$lte(results[idx]['b'], results[idx+1]['b'])) {
    bIsValid=false;
    console.err("@idx:"+idx+ ": " + results[idx]['b'] + " is not $lte " + results[idx+1]['b']);
  }
}

console.log("verifying 'c' index ordering...");
results = coll.chain().simplesort("c").data();
len = results.length;
for(idx=0; idx<len-1; idx++) {
  if (!loki.LokiOps.$lte(results[idx]['c'], results[idx+1]['c'])) {
    cIsValid=false;
    console.err("@idx:"+idx+ ": " + results[idx]['c'] + " is not $lte " + results[idx+1]['c']);
  }
}

console.log("");
if (!aIsValid || !bIsValid || !cIsValid) {
  console.log("binary index order validation -FAILED-");
}
else {
  console.log("binary index order validation SUCCESSFUL");
}
