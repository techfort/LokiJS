/**
 * quickstart3.js example for lokijs (running in node.js environment)
 *
 * This exmple uses a higher performance, and better scaling LokiFsStructuredAdapter to persist its database.
 * This example uses autosave/autoload and we trap SIGINT (ctrl-c) to flush database on exit.
 * This example sets up multiple collections for our adapter (which has built in partitioning) to split out database into.
 */

const loki = require('../src/lokijs.js');
const lfsa = require('../src/loki-fs-structured-adapter.js');

var db = new loki('quickstart3.db', {
  adapter: new lfsa(),
	autoload: true,
	autoloadCallback : databaseInitialize,
	autosave: true, 
	autosaveInterval: 4000
});

// Since autosave timer keeps program from exiting, we exit this program by ctrl-c.
// (optionally) For best practice, lets use the standard exit events to force a db flush to disk 
//    if autosave timer has not had a fired yet (if exiting before 4 seconds).
process.on('SIGINT', function() {
  console.log("flushing database");
  db.close();
});

// Now let's implement the autoload callback referenced in loki constructor
function databaseInitialize() {
  var entries = db.getCollection("entries");
  var messages = db.getCollection("messages");

  // Since our LokiFsStructuredAdapter is partitioned, the default 'quickstart3.db'
  // file will actually contain only the loki database shell and each of the collections
  // will be saved into independent 'partition' files with numeric suffix.
  
  // Add our main example collection if this is first run.
  // This collection will save into a partition named quickstart3.db.0 (collection 0)  
  if (entries === null) {
    // first time run so add and configure collection with some arbitrary options
    entries = db.addCollection("entries", { indices: ['x'], clone: true });
  }

  // Now let's add a second collection only to prove that this saved partition (quickstart3.db.1) 
  // doesn't need to be saved every time the other partitions do if it never gets any changes
  // which need to be saved.  The first time we run this should be the only time we save it.
  if (messages === null) {
    messages = db.addCollection("messages");
    messages.insert({ txt: "i will only insert into this collection during databaseInitialize" });
  }

  // kick off any program logic or start listening to external events
  runProgramLogic();
}

// While we could have done this in our databaseInitialize function, 
//   lets go ahead and split out the logic to run 'after' initialization into this 'runProgramLogic' function
function runProgramLogic() {
  var entries = db.getCollection("entries");
  var entryCount = entries.count();
  var now = new Date();

  console.log("old number of entries in database : " + entryCount);

  entries.insert({ x: now.getTime(), y: 100 - entryCount });
  entryCount = entries.count();

  console.log("new number of entries in database : " + entryCount);
  console.log("");
  
  console.log("since autosave timer keeps program from existing, press ctrl-c to quit");
}