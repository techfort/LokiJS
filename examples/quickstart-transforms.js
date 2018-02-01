/**
 * quickstart-transforms.js : example demonstrating lokijs 'collection transform' usage
 *
 * This example will use persistence and set up a transforms in the databaseInitialize
 * autoloadCallback.
 *
 * Collection Transforms are object representations of a query 'chain' which 
 *   can be named and used similarly to a stored procedure.
 *
 * They can also be used when branching dynamic views to created named 'extracts'
 *
 * We'll just use the default LokiFsAdapter for this.
 */

const loki = require('../src/lokijs.js');

var db = new loki('quickstart-transforms.db', {
	autoload: true,
	autoloadCallback : databaseInitialize,
	autosave: true, 
	autosaveInterval: 4000 // save every four seconds for our example
});

/**
 * Initialize the database with :
 *   - our collections (if first run and they don't exist)
 *   - our named collection transforms (if first run and they don't exist)
 *   - example data seeding
 *   - we will also add a  dynamic view from dynview example.
 */
function databaseInitialize() {
  var users = db.getCollection("users");

  // on first run, this will be null so add collection
  if (!users) {
    users = db.addCollection("users");
  }

  // add simple 1 step 'females' transform on first run
  if (!users.getTransform("females")) {
    users.addTransform("females", [{ type: 'find', value: { gender: 'f' }}]);
  }
  
  // simple parameterized document paging transform
  if (!users.getTransform("paged")) {
    users.addTransform("paged", [
      {
        type: 'offset',
        value: '[%lktxp]pageStart'
      },
      {
        type: 'limit',
        value: '[%lktxp]pageSize'
      }
    ]);
  }

  // let's keep the dynamic view from dynview example without its sort
  if (!users.getDynamicView("over 500")) {
    let ov500 = users.addDynamicView("over 500");
    ov500.applyFind({ age: { $gte : 500 } });
  }

  // for this example we will also seed data on first run
  if (users.count() === 0) {
    seedData();
  }
  
  // at this point all collections, transforms and dynamic view should exist 
  // so go ahead and run your program logic
  runProgramLogic();
}

/**
 * example-specific seeding of user data
 */
function seedData() {
  var users = db.getCollection("users");

  users.insert({ name: "odin", gender: "m", age: 1000, tags : ["woden", "knowlege", "sorcery", "frenzy", "runes"], items: ["gungnir"], attributes: { eyes: 1} });
  users.insert({ name: "frigg", gender: "f", age: 800, tags: ["foreknowlege"], items: ["eski"] });
  users.insert({ name: "thor", gender: "m", age: 35, items: ["mjolnir", "beer"] });
  users.insert({ name: "sif", gender: "f", age: 30 });
  users.insert({ name: "loki", gender: "m", age: 29 });
  users.insert({ name: "sigyn", gender: "f", age: 29 });
  users.insert({ name: "freyr", age: 400 });
  users.insert({ name: "heimdallr", age: 99 });
  users.insert({ name: "mimir", age: 999 });
}

/**
 * Logic to run after database is initialized
 *
 * Our example add 1 randomly generated user each time the program is run.
 * 
 * Let's run some transforms...
 *
 */
function runProgramLogic() {
  var users = db.getCollection("users");
  var ov500 = users.getDynamicView("over 500");

  // generate random user and add
  var randomAge = Math.floor(Math.random() * 1000) + 1;
  var randomGender = Math.floor(Math.random() * 2);
  var newUser = {
    name : "user #" + users.count(),
    age : randomAge,
    gender : (randomGender?"m":"f")
  }
  users.insert(newUser);
  
  console.log("---- added user ----");
  console.log(newUser);
  console.log("");
  
  // lets get all female users in the users collection
  let result = users.chain("females").data();
  console.log("females:");
  console.log(result);
  console.log("");

  // let's use this within a chain
  result = users.chain().find({age: { $between: [300,700] } }).transform("females").data();
  console.log("females between 300-700 (empty initially) : ");
  console.log(result);
  console.log("");

  // if the 'females' transform filtered the results better, we might re-word this query as :
  result = users.chain("females").find({age: { $between: [300,700] } }).data();
  console.log("females between 300-700 (empty initially) : ");
  console.log(result);
  console.log("");
  
  
  // now let's use the transform as an extract for our dynamic view
  result = ov500.branchResultset("females").data();
  console.log("over 500 females : ");
  console.log(result);
  console.log("");
  
  // now let's hook up a paging algorithm to grab 1st page of 5 document page
  let page = 1,
    pageSize = 5,
    start = (page-1)*pageSize;

  // so transforms can be passed to chain() and transform() methods on collection as well
  // as to dynamic view's branchResultset()... in all instances you can pass parameters as an
  // optional parameter hash object.
  
  // call our parameterized transform as a dynamic view extract
  result = ov500.branchResultset("paged", { pageStart: start, pageSize: pageSize }).data();
  console.log("1st through 5th users over 500 : ");
  console.log(result);
  console.log("");

  // mix multiple transforms into a basic query chain...
  result = users
    .chain()
    .find({ age: { $gt: 200 } })
    .transform("females")
    .transform("paged", { pageStart: start, pageSize: pageSize })
    .data();
    
  console.log("first page (1-5) of females over 200");
  console.log(result);
  console.log("");
    
  console.log("press ctrl-c to quit");

}

// All our logic ran in runProgramLogic so we are done...

// We could have -not- enabled the autosave options in loki constructor
// and then made a call to db.saveDatabase() as the last line of our runProgramLogic() 
// function if we wanted the program to end automatically.

// Since autosave timer keeps program from exiting, we exit this program by ctrl-c.
// (optionally) For best practice, lets use the standard exit events to force a db flush to disk 
//    if autosave timer has not had a fired yet (if exiting before 4 seconds).
process.on('SIGINT', function() {
  console.log("flushing database");
  
  // db.close() will save the database -if- any collections are marked as 'dirty'
  db.close();
});

