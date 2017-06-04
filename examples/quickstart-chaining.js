/**
 * quickstart-chaining.js : example demonstrating lokijs method chaining via Resultset class.
 *
 * This example will only use loki, collection, and resultset classes.  We will not bother
 *    with persistence for this example.
 *
 */

const loki = require('../src/lokijs.js');

var db = new loki("quickstart-chaining.db");

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

// call chain() method on collection to begin chaining
// call data() method to terminate chain and return results

var result;

// find all records
result = users.chain().data();

// find all records sorted by age :
result = users.chain().simplesort("age").data();

// find all records greater than or equal to 400 sorted by age descending
result = users.chain().find({age: { $gte: 400 }}).simplesort("age", true).data();
console.log("result 1");
console.log(result);

// find the two oldest users
result = users.chain().simplesort("age", true).limit(2).data();
console.log("result 2");
console.log(result);

// find everyone but the two oldest users
result = users.chain().simplesort("age", true).offset(2).data();
console.log("result 3");
console.log(result);

// incrementally chaining filters
result = users.chain().find({ age: 29}).find({ gender: "f"}).data();
console.log("result 4");
console.log(result);

// mixing filter methods
result = users
  .chain()
  .find({ age: 29})
  .where(function(obj) { return obj.gender === "f" })
  .data();
console.log("result 5");
console.log(result);
  
// find all users between 30-40 and add a year to their age using javascript update function
// dont need data back so don't need to call data()
users
  .chain()
  .find({ age: { $between: [30, 40] } })
  .update(function(obj) { obj.age = obj.age+1; });
  
// remove all users with age of 29
// dont need data back so don't need to call data()
users
  .chain()
  .find({ age: 29 })
  .remove();
  
// get all documents but strip $loki and meta properties from results
result = users.chain().data({removeMeta: true});
console.log("result 6");
console.log(result);

// get all documents but return clones even though we did not define clones on collection
result = users.chain().data({forceClones: true});
console.log("result 7");
console.log(result);
