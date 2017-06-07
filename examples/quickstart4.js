/**
 * quickstart4.js example for lokijs with manual loading and saving
 *
 * This example shows how you can manually load and save your loki 
 * database if do not need or want to use the 'autosave' functionality.
 *
 * Since most of loki's persistence adapters are asynchronous this example
 * shows you still need to use the appropriate callbacks to ensure those 
 * processes complete before you reload.
 */

const loki = require('../src/lokijs.js');

var db = new loki('quickstart4.db');

// set up an initialize function for first load (when db hasn't been created yet)
function databaseInitialize() {
  var entries = db.getCollection("entries");
  var messages = db.getCollection("messages");

  // Add our main example collection if this is first run.
  // This collection will save into a partition named quickstart3.db.0 (collection 0)  
  if (entries === null) {
    // first time run so add and configure collection with some arbitrary options
    entries = db.addCollection("entries");
  }

  if (messages === null) {
    messages = db.addCollection("messages");
    messages.insert({ txt: "i will only insert into this collection during databaseInitialize" });
  }
}

// place any bootstrap logic which needs to be run after loadDatabase has completed
function runProgramLogic() {
  var entries = db.getCollection("entries");
  var entryCount = entries.count();
  var now = new Date();

  console.log("old number of entries in database : " + entryCount);

  entries.insert({ x: now.getTime(), y: 100 - entryCount });
  entryCount = entries.count();

  console.log("new number of entries in database : " + entryCount);
  console.log("");
  
  // manually save
  db.saveDatabase(function(err) {
    if (err) {
      console.log(err);
    }
    else {
      console.log("saved... it can now be loaded or reloaded with up to date data");
    }
  });
}

console.log("");
console.log("Loading database...");

// manual bootstrap
db.loadDatabase({}, function(err) {
  databaseInitialize();
  console.log("db initialized");
  runProgramLogic();
  console.log("program logic run but it's save database probably not finished yet");
});

console.log("wait for it...");