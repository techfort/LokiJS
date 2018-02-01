/**
 * quickstart-core.js : example demonstrating 'core' lokijs methods
 *
 * This example will only use loki and collection classes.  We will not bother
 *    with persistence for this example.
 *
 */

const loki = require('../src/lokijs.js');

var db = new loki("quickstart-core.db");

var users = db.addCollection("users");

// seed data
users.insert({ name: "odin", gender: "m", age: 1000, tags : ["woden", "knowlege", "sorcery", "frenzy", "runes"], items: ["gungnir"], attributes: { eyes: 1} });
users.insert({ name: "frigg", gender: "f", age: 800, tags: ["foreknowlege"], items: ["eski"] });
users.insert({ name: "thor", gender: "m", age: 35, items: ["mjolnir", "beer"] });
users.insert({ name: "sif", gender: "f", age: 30 });
users.insert({ name: "loki", gender: "m", age: 29 });
users.insert({ name: "sigyn", gender: "f", age: 29 });
users.insert({ name: "freyr", age: 400 });
users.insert({ name: "heimdallr", age: 99 });
users.insert({ name: "mimir", age: 999 });

var result;

// find all records where age is equal to 1000 (just odin)
// query object is { age: 1000 }
// this form is shorthand where $eq op is implicit
// this will return array of all docs matching that filter
result = users.find({ age: 1000 });
console.log("result 1 : ");
console.log(result);

// do same query but explicitly state the $eq op
// this will return array of all docs matching that filter
result = users.find({ age: { $eq: 1000 } });
console.log("result 2 : ");
console.log(result);

// if we know we only want one record, use findOne instead
// this will single object reference of (first) found item or null if not found
result = users.findOne({ age: 1000 });
console.log("result 3 : ");
console.log(result);

// use a range operator ($gt)
// returns all documents with age greater than 500
result = users.find({age: { $gt: 500 }});
console.log("result 4 : ");
console.log(result);

// find implicit $and
result = users.find({ age: 29, gender: "f" });
console.log("result 5 : ");
console.log(result);

// find explicit $and
result = users.find({ $and: [
  { age: 29},
  { gender: "f" }
]});
console.log("result 6 : ");
console.log(result);

// find users in an age range
result = users.find({ age: { $between: [20, 40] } });
console.log("result 7 : ");
console.log(result);

// find within nested object by using dot notation
result = users.find({ "attributes.eyes": 1 });
console.log("one eyed : ");
console.log(result);

// find where array property contains a value
result = users.find({ items: { $contains: "eski" } });
console.log("frigg : ");
console.log(result);

// more array logic : find all users which have 2 elements in an 'items' property
result = users.find({ items: { $size: 2 } });
console.log("users with 2 items : ");
console.log(result);

// filter using a javascript "where" filter
// filter for users who's age is 400
result = users.where(function(obj) {
  return obj.age === 400;
});
console.log("where filter: ");
console.log(result);


// update a document
var mimir = users.findOne({name: "mimir" });
mimir.age = 998;
users.update(mimir);

// remove a document by id
users.remove(mimir.$loki);

// remove a document by instance 
var heimdallr = users.findOne({name: "heimdallr" });
users.remove(heimdallr);

console.log("");
console.log("deleted 2 items, current user count : " + users.count());
