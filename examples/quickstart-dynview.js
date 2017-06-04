/**
 * quickstart-dynview.js : example demonstrating lokijs 'dynamic view' usage
 *
 * This example will use persistence and set up a dynamic view in the databaseInitialize
 * autoloadCallback.
 *
 * We'll just use the default LokiFsAdapter for this.
 */

const loki = require('../src/lokijs.js');

var db = new loki('quickstart-dynview.db', {
	autoload: true,
	autoloadCallback : databaseInitialize,
	autosave: true, 
	autosaveInterval: 4000 // save every four seconds for our example
});

/**
 * Initialize the database with :
 *   - our collections (if first run and they don't exist)
 *   - our dynamic view (if first run and they don't exist)
 *   - example data seeding
 *
 *  Other applications might need to also
 *   - reapply and 'where' filters in any dynamicviews
 *   - you might initiatialize some collection transforms
 *   - which can be used with or without dynamic views
 */
function databaseInitialize() {
  var users = db.getCollection("users");

  // on first run, this will be null so add collection
  if (!users) {
    users = db.addCollection("users");
  }
  
  // on first run, add the dynamic view to the collection
  if (!users.getDynamicView("over 500")) {
    // add empty dynamic view
    let ov500 = users.addDynamicView("over 500");
    
    // apply a find filter, you can do add as many find filters as 
    // you want and these filters will be saved along with the database
    // and its collections.
    ov500.applyFind({ age: { $gte : 500 } });

    // apply a sort (if you need to)
    ov500.applySimpleSort('age', true);
  }

  // if we needed 'where' filters our persisted database, we would need to
  // reapply everytime. (commented out since we don't want to use it in this example)
  // ov500.applyWhere(function(obj) { return obj.gender === 'm'; });
  
  // for this example we will also seed data on first run
  if (users.count() === 0) {
    seedData();
  }
  
  // at this point all collections and dynamic view should exist 
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
 * Our example program will add one document each time this program is run.
 * We will then dump the view so you can see if it passed the view filter.
 *
 */
function runProgramLogic() {
  var users = db.getCollection("users");
  var ov500 = users.getDynamicView("over 500");

  // generate random number between 1-1000
  // since our view is 'over500' there is 50% change it will be
  // in our dynamic view results
  var randomAge = Math.floor(Math.random() * 1000) + 1;
  // another 50% chance of being male
  var randomGender = Math.floor(Math.random() * 2);

  var newUser = {
    name : "user #" + users.count(),
    age : randomAge,
    gender : (randomGender?"m":"f")
  }

  console.log("");
  console.log("adding user : ");
  console.log(newUser);
  console.log("");

  users.insert(newUser);

  let result = ov500.data();
  console.log("'over 500' dynamic view results : ");
  console.log(result);
  console.log("");

  // now let's take our 'generic' bulk filtering dynamic view and further query its 'current' results
  // to find only the gender 'm' users in the dynamic view results.
  result = ov500.branchResultset().find({gender: 'm'}).data();
  console.log("over 500 males : ");
  console.log(result);
  console.log("");
  
  // branchResultset can also take transforms if you want to craft frequently used transformations
  // on view results... see the wiki page on collection transforms for examples of that if interested.

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

