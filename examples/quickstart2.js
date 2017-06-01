// quickstart2.js example : 
// This exmple uses the default persistence adapter for node environment (LokiFsAdapter), to persist its database
// Since loki is synchronous -except- when dealing with persistence (I/O), 
//   and this database uses no persistence, this example can deal with loki entirely synchronously.

const loki = require('../src/lokijs.js');

var db = new loki('quickstart2.db', {
	autoload: true,
	autoloadCallback : databaseInitialize,
	autosave: true, 
	autosaveInterval: 4000 // save every four seconds for our example
});

// implement the autoloadback referenced in loki constructor
function databaseInitialize() {
  // on the first load of (non-existent database), we will have no collections so we can 
  //   detect the absence of our collections and add (and configure) them now.
  var entries = db.getCollection("entries");
  if (entries === null) {
    entries = db.addCollection("entries");
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
  console.log("Wait 4 seconds for the autosave timer to save our new addition and then press [Ctrl-c] to quit")
  console.log("If you waited 4 seconds, the next time you run this script the numbers should increase by 1");
}