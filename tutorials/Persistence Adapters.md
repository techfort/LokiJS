# Overview
In LokiJS version 1.1 we have made several enhancements to provide more refined persistence options.  We added indexeddb support (via new adapter interface), added autosave and autoload options, and allow explicit specification of persistenceMethod (with fallback to older environment detection if not provided).

So LokiJS now supports three primary persistenceMethods : _filesystem ('fs'), 'localStorage', and indexeddb ('adapter')_.  If you do not provide any configuration of this, we will fallback to environment detection, using _filesystem_ for node and _localstorage_ for browser/cordova environment.

IndexedDB support is now provided as an implementation of a new 'adapter interface'. This new adapter interface (described in detail later), allows for future adaptation to any number of datasources.  Adapters may potentially be written for key/value stores like redis, jxcore memory store, custom web services/databases, or even websql (most likely to function as a key/value store).  This will hopefully allow loki to be adapted to environments where many loki clients can share a common data store.  

> In addition to our filesystem, localStorage, and indexedDB adapters, several community members have created their own adapters using this adapter interface.  Some of these include : 
* Cordova adapter : https://github.com/cosmith/loki-cordova-fs-adapter
* localForage adapter : https://github.com/paulhovey/loki-localforage-adapter

# Description of LokiIndexedAdapter
Since LokiJS is an in-memory database, persistence is mostly appropriate for saving the entire database as a single serialized string.  So for our implementation of an indexeddb adapter we have chosen an App/Key/Value catalog approach which essentially turns indexeddb into an enhanced key/value database.  Advantages include larger storage limits over localstorage, and a catalog based approach where you can store many databases, grouped by an 'App' context.  Since indexedDB storage is provided 'per-domain', and on any given domain you might be running several web 'apps' each with its own database(s), this structure allows for organization and expandibility.
> _**Note : the 'App' context is an conceptual separation, not a security partition. Security is provided by your web browser, partitioned per-domain within client storage in the browser/system.**_

### Simple Example of using LokiIndexedAdapter (for browser environments) :
```javascript
<script src="scripts/lokijs/lokijs.js"></script>
<script src="scripts/lokijs/loki-indexed-adapter.js"></script>
```
...
```javascript
var idbAdapter = new LokiIndexedAdapter('finance');
var db = new loki('test', { adapter: idbAdapter });
```

Note the 'finance' in this case represents an 'App' context and the 'test' designates the key (or database name).

# Configuring persistence adapters
If you are using the indexeddb adapter or just wish to explicitly specify which persistenceMethod (fs, localstorage, indexeddb) to use you can specify that in loki constructor options as well : 
    var db = new loki('test', { persistenceMethod: 'adapter', adapter: myAdapter });
This is currently optional and unnecessary since specifying an adapter automatically assumes persistence method of 'adapter', but this 'persistenceMethod' option exists for future override of default persistence Method.

## Autosave, Autoload and close()
LokiJS now supports automatic saving at user defined intervals, configured via loki constructor options.  This is supported for all persistenceMethods.  Data is only saved if changes have occurred since the last save.  You can also specify an autoload to immediately load a saved database during new loki construction.  If you need to process anything on load completion you can also specify your own autoloadCallback.  Finally, in an autosave scenario, if the user wants to exit or is notified of leaving the webpage (window.onbeforeunload) you can call close() on the database which will perform a final save (if needed).

> _**Note : the ability of loki to 'flush' data on events such as a browsers onbeforeunload event, depends on the storage adapter being synchronous.  Local storage and file system adapters are synchronous but indexeddb is asynchronous and cannot save when triggered from db.close() in an onbeforeunload event.**_


### Autosave example
```javascript
    var idbAdapter = new LokiIndexedAdapter('loki');
    var db = new loki('test', 
      {
        autosave: true, 
        autosaveInterval: 10000,
        adapter: idbAdapter
      });
```

### Autosave with autoload example
```javascript
    var idbAdapter = new lokiIndexedAdapter('loki');
    var db = new loki('test', 
      {
        autoload: true,
        autoloadCallback : loadHandler,
        autosave: true, 
        autosaveInterval: 10000,
        adapter: idbAdapter
      }); 

    function loadHandler() {
      // if database did not exist it will be empty so I will intitialize here
      var coll = db.getCollection('entries');
      if (coll === null) {
        coll = db.addCollection('entries');
      }
    }
```
# Minimal adapter interface
Since a persistence adapter is registered with loki, loki can call it within **saveDatabase()** and **loadDatabase()**.  All other adapter functionality is for the benefit of the user, directly calling the adapter.  As such if you want to create your own adapter, an example of a minimum interface you need your adapter class to provide might look like this : 

```javascript
MyCustomAdapter.prototype.loadDatabase = function(dbname, callback) {
  // using dbname, load the database from wherever your adapter expects it
  var serializedDb = localStorage[dbname];

  var success = true; // make your own determinations

  if (success) {
    callback(serializedDb);
  }
  else {
    callback(new Error("There was a problem loading the database"));
  }
}
```

and a saveDatabase example might look like : 

```javascript
MyCustomAdapter.prototype.saveDatabase = function(dbname, dbstring, callback) {
  // store the database, for this example to localstorage
  localStorage[dbname] = dbstring;

  var success = true;  // make your own determinations
  if (success) {
    callback(null);
  }
  else {
    callback(new Error("An error was encountered loading " + dbname + " database."));
  }
}
```

# Advanced adapter interface
An additional 'level' of adapter support would be for your adapter to support what I am referring to as **'reference'** mode support.  This 'reference' mode will allow lokijs to provide your adapter with a reference to your loki object itself, from which you do advanced destructuring.

To instruct loki that your adapter supports 'reference' mode, you will need to implement a top level property called 'mode' on your adapter and set it equal to 'reference'.  Having done that and configured that adapter to be used, whenever loki wishes to save the database it will instead call out to an exportDatabase() method on your adapter.  

A simple example of an advanced 'reference' mode adapter might look like : 
```javascript
function YourAdapter() {
   this.mode = "reference";
}

YourAdapter.prototype.exportDatabase = function(dbname, dbref, callback) {
  // deconstruct and persist the database however you want
  //dbref.collections.forEach(function(coll) {
  //  if (coll.dirty) {
  //    localStorage[dbname + "-" + coll.name] = JSON.stringify(coll);
  //  }
  //});

  var success = true; // make your own determinations

  if (success) {
    callback(null);
  }
  else {
    callback(new Error("some error occurred."));
  }
}

// reference mode uses the same loadDatabase method signature
YourAdapter.prototype.loadDatabase = function(dbname, callback) {
  // do some magic to reconstruct a new loki database object instance from wherever
  var newDatabase = new loki(dbname);
  newDatabase.loadJSON(localStorage[dbname]);
  
  // once reconstructed, loki expects serialized response
  var newSerialized = newDatabase.serialize();
  
  var success = true; // make you own determinations

  if (success) {
    callback(newSerialized);
  }
  else {
    callback(new Error("some error"));
  }
}
```


# Loki Indexed adapter interface
In addition to core loadDatabase and saveDatabase methods, the loki Indexed adapter provides the ability to getDatabaseList (for the current app context), deleteDatabase, and getCatalogSummary to retrieve unfiltered list of app/keys along with the size in database.  (Note sizes reported may not be Unicode sizes so effective 'size' it may consume might be double that amount as indexeddb saves in Unicode).  The loki indexed adapter also is console-friendly... even though indexeddb is highly asynchronous, relying on callbacks, you can omit callbacks for many of its methods and will log results to console instead.  This makes experimenting, diagnosing, and maintenance of loki catalog easier to learn and inspect.

### Full Examples of using loki indexed adapter
```javascript
  // SAVE : will save App/Key/Val as 'finance'/'test'/{serializedDb}
  // if appContect ('finance' in this example) is omitted, 'loki' will be used
  var idbAdapter = new lokiIndexedAdapter('finance');
  var db = new loki('test', { adapter: idbAdapter });
  var coll = db.addCollection('testColl');
  coll.insert({test: 'val'});
  db.saveDatabase();  // could pass callback if needed for async complete

  // LOAD
  var idbAdapter = new LokiIndexedAdapter('finance');
  var db = new loki('test', { adapter: idbAdapter });
  db.loadDatabase({}, function(result) {
    console.log('done');
  });

  // GET DATABASE LIST
  var idbAdapter = new LokiIndexedAdapter('finance');
  idbAdapter.getDatabaseList(function(result) {
    // result is array of string names for that appcontext ('finance')
    result.forEach(function(str) {
      console.log(str);
    });
  });
  
  // DELETE DATABASE
  var idbAdapter = new LokiIndexedAdapter('finance');
  idbAdapter.deleteDatabase('test'); // delete 'finance'/'test' value from catalog

  // SUMMARY
  var idbAdapter = new LokiIndexedAdapter('finance');
  idbAdapter.getCatalogSummary(function(entries) {
    entries.forEach(function(obj) {
      console.log("app : " + obj.app);
      console.log("key : " + obj.key);
      console.log("size : " + obj.size);
    });
  });

```

### Examples of using loki Indexed adapter from console
```javascript
  // CONSOLE USAGE : if using from console for management/diagnostic, here are a few examples :
  var adapter = new LokiIndexedAdapter('loki');  // or whatever appContext you want to use
  adapter.getDatabaseList(); // with no callback passed, this method will log results to console
  adapter.saveDatabase('UserDatabase', JSON.stringify(myDb));
  adapter.loadDatabase('UserDatabase'); // will log the serialized db to console
  adapter.deleteDatabase('UserDatabase');
  adapter.getCatalogSummary(); // gets list of all keys along with their sizes
```