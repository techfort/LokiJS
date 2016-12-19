# Overview
LokiJS persistence is implemented via an adapter interface.  We support autosave and autoload options, simple key/value adapters as well as 'reference mode' adapters, and now internally support various methods of structured serialization which can ease creation of your own persistence adapters, as well as bulk or streamed data exchange.  

An important distinction between an in-memory database like lokijs and traditional database systems is that all documents/records are kept in memory and are not loaded as needed.  Persistence is therefore only for saving and restoring the state of this in-memory database.

# Node.js QuickStart
If you are using lokijs in a node environment, we will automatically detect and use the built-in LokiFsAdapter without your needing to provide an adapter.
```javascript
var loki = require("../src/lokijs.js");
var db = new loki("test.db");

```

If you expect your database to grow over 100mb or you experience slow save speeds you might to use our more high-performance LokiFsStructuredAdapter. This adapter utilitizes es6 generator iterators and node streams to stream the database line by line.  It will also save each collection into its own file with a file name derived from the base name.  This database should scale to support databases just under 1 gb on the default node heap allocation of 1.4gb.  Increasing heap allocation, you can push this limit further. 

An example using this LokiFsStructuredAdapter might look like :
```javascript
var loki = require('../src/lokijs.js');
var lfsa = require('../src/loki-fs-structured-adapter.js');

var db = new loki('sandbox.db', { adapter : lfsa});
```

# Web QuickStart
If you are using lokijs in a web environment, we will automatically use the built-in LokiLocalStorageAdapter.  This adapter is limited to around 5gb so that won't last long but here is how to quickly get started experimenting with lokijs :
```
<script src="../../src/lokijs.js"></script>
```
```javascript
var loki = new loki("test.db");
```

If you expect your database to grow up to 60megs you might want to use our LokiIndexedAdapter which can save to IndexedDb, if your browser supports it.  More information follows on this adapter but here is how to get started quickly with this adapter :
```
<script src="../../src/lokijs.js"></script>
<script src="../../src/loki-indexed-adapter.js"></script>
```
```javascript
var idbAdapter = new LokiIndexedAdapter();
var db = new loki("test.db", { adapter: idbAdapter });
```

If you expect your database to grow over 60megs things start to get browser dependent.  To provide singular guidance and since Chrome is the most popular web browser you will want to employ our LokiPartitioningAdapter in addition to our LokiIndexedAdapter.  To sum up as briefly as possible, this will divide collections into their own files and if a collection exceeds 25megs (customizable) it will subdivide into separate pages(files).  This allows our indexed db adapter to accomplish a single database save/load using many key/value pairs.  This adapter will allow scaling up to around 300mb or so in current testing.  

An example using the LokiPartitioningAdapter along with LokiIndexedAdapter might appear as :
```
<script src="../../src/lokijs.js"></script>
<script src="../../src/loki-indexed-adapter.js"></script>
```
```javascript
var idbAdapter = new LokiIndexedAdapter();
var pa = new loki.LokiPartitioningAdapter(idbAdapter, { paging: true });

var db = new loki('test.db', { adapter: pa });
```

# Description of LokiNativescriptAdapter
This adapter can be used when developing a nativescript application for iOS or Android, it persists the loki db to the filesystem using the native platform api.

### Simple Example of using LokiNativescriptAdapter :
```javascript
const loki = require ('lokijs');
const LokiNativescriptAdapter = require('lokijs/src/loki-nativescript-adapter');
let db = new loki('loki.json',{
            adapter:new LokiNativescriptAdapter()
});
```

> In addition to the above adapters which are included in the lokijs distro, several community members have also created their own adapters using this adapter interface.  Some of these include : 
* Cordova adapter : https://github.com/cosmith/loki-cordova-fs-adapter
* localForage adapter : https://github.com/paulhovey/loki-localforage-adapter

# Configuring persistence adapters
## Autosave, Autoload and close()
LokiJS now supports automatic saving at user defined intervals, configured via loki constructor options.  This is supported for all persistenceMethods.  Data is only saved if changes have occurred since the last save.  You can also specify an autoload to immediately load a saved database during new loki construction.  If you need to process anything on load completion you can also specify your own autoloadCallback.  Finally, in an autosave scenario, if the user wants to exit or is notified of leaving the webpage (window.onbeforeunload) you can call close() on the database which will perform a final save (if needed).

> _**Note : the ability of loki to 'flush' data on events such as a browsers onbeforeunload event, depends on the storage adapter being synchronous.  Local storage and file system adapters are synchronous but indexeddb is asynchronous and cannot save when triggered from db.close() in an onbeforeunload event.  The mouseleave event may allow enough time to perform a preemptive save.**_


### Autosave example
```javascript
    var idbAdapter = new LokiIndexedAdapter('loki');
    var db = new loki('test', 
      {
        autosave: true, 
        autosaveInterval: 10000, // 10 seconds
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
        autosaveInterval: 10000, // 10 seconds
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
[Try in Loki Sandbox](https://rawgit.com/techfort/LokiJS/master/examples/sandbox/LokiSandbox.htm#rawgist=https://gist.githubusercontent.com/obeliskos/447edca33d1274dd9a64767d23df56e9/raw/740d3bedc1ed76d3718acd207b6913281a11ed78/autoloadCallback).

# Creating your own Loki Persistence Adapters
Lokijs currently supports two types of database adapters : 'basic', and 'reference' mode adapters. Basic adapters are passed a string to save and return a string when loaded... this is well suited to key/value stores.  Reference mode adapters are passed a reference to the database itself where it can save however it wishes to.  When loading, reference mode adapters can return an object reference or serialized string.  Below we will describe the minimal functionality which lokijs requires, you may want to provide additional adapter functionality for deleting or inspecting its persistence store.

# Creating your own 'Basic' persistence adapter 

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

# Creating your own 'Reference Mode' persistence adapter 
An additional 'level' of adapter support would be for your adapter to support **'reference'** mode support.  This 'reference' mode will allow lokijs to provide your adapter with a reference to a lightweight 'copy' of the database sharing only the collection.data[] document object instances with the original database. You would use this reference to destructure or save however you want to.

To instruct loki that your adapter supports 'reference' mode, you will need to implement a top level property called 'mode' on your adapter and set it equal to 'reference'.  Having done that and configured that adapter to be used, whenever loki wishes to save the database it will instead call out to an exportDatabase() method on your adapter.  

A simple example of an advanced 'reference' mode adapter might look like : 
```javascript
function YourAdapter() {
   this.mode = "reference";
}

YourAdapter.prototype.exportDatabase = function(dbname, dbref, callback) {
  this.customSaveLogic(dbref);

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
  var newDatabase = this.customLoadLogic();
 
  var success = true; // make you own determinations

  // once reconstructed, loki will expect either a serialized response or a Loki object instance to reinflate from
  if (success) {
    callback(newSerialized);
  }
  else {
    callback(new Error("some error"));
  }
}
```

# LokiPartitioningAdapter
This is an adapter for adapters.  It wraps around and converts any 'basic' persistence adapter into one that scales nicely to your memory contraints.  It can split your database up, saving each collection independently and only if changes have occurred since the last save.  Since each collection is saved separately there is lower memory overhead and since only dirty collections are saved there is improved i/o save speeds. 
> Chrome (using indexedDb) places a restriction on how large a single saved 'chunk' can be, this Partitioning adapter with just partitioning raises that limit from being 'per db' to 'per collection'... when paging is enabled that limit is raised to being 'per document'.  Chrome indexedDb limit is somewhere around 30-60megs sized chunks.  

An example using partition adapter with our LokiIndexedAdapter might appear such as :

```javascript
var idbAdapter = new LokiIndexedAdapter('appAdapter');
var pa = new loki.LokiPartitioningAdapter(idbAdapter);

var db = new loki('sandbox.db', { adapter: pa });
```

If you expect a single collection to grow rather large you may even want to utilize an additional 'paging' mode that this adapter provides.  This is useful if you want to limit the size of data sent to the inner persistence adapter. This paging mode was added to accomodate a Chrome limitation on maximum record sizes.  An example using paging mode might appear as follows :
```javascript
var idbAdapter = new LokiIndexedAdapter('appAdapter');
var pa = new loki.LokiPartitioningAdapter(idbAdapter, { paging: true });

var db = new loki('sandbox.db', { adapter: pa });
```

You can also pass in a pageSize option if you wish to use a page size other than the default 25meg page size.
```javascript
// set up adapter to page using 35 meg page size
var pa = new loki.LokiPartitioningAdapter(idbAdapter, { paging: true, pageSize:35*1024*1024 });
```

# LokiMemoryAdapter
This 'basic' persistence adapter is only intended for experimenting and testing since it retains its key/value store in memory and will be lost when session is done.  This enables us to verify the partitioning adapter works and can be used to mock persistence for unit testing. 

You might access this memory adapter (which is included in the main source file) similarly to the following :
```javascript
var mem = new loki.LokiMemoryAdapter();
var db = new loki('sandbox.db', {adapter: mem});
```
> In order to see LokiPartitioningAdapter used in conjunction with LokiMemoryAdapter you can view this [Loki Sandbox gist](https://rawgit.com/techfort/LokiJS/master/examples/sandbox/LokiSandbox.htm#rawgist=https://gist.githubusercontent.com/obeliskos/15c1aa87da16cd89b328eb84bbcdf8fa/raw/d91ac3fee212dc5aa96cb05f479d825faa17c1c8/PartitionedMemoryAdapterTest) in your browser.  

What is happening in the gist linked above is that we create an instance of a LokiMemoryAdapter and pass that instance to the LokiPartitioningAdapter.  We utilimately pass in the created LokiPartitioningAdapter instance to the database constructor.  We then add multiple collections to our database, save it, update one of the collections (causing that collection's 'dirty' flag to be set), and save again.  When we examine the output of the script we can view the contents of the memory adapter's internal hash store to see how there are multiple keys for a single database.  We can also see that our modified collection (along with the database container itself) was saved again.  The database container currently has no 'dirty' flag set but since we remove all collection.data[] object instances from it, it is relatively lightweight.

# 'Rolling your own' structured serialization mechanism
In addition to the [ChangesAPI](https://github.com/techfort/LokiJS/wiki/Changes-API) which can be utilized to isolate changesets, LokiJS has established several internal utility methods to assist users in developing optimal persistence or transmission of database contents. 

Those mechanisms include the ability to decompose the database into 'partitions' of structured serializations or assembled into a line oriented format (non-partitioned) and either delimited (single delimited string per collection) or non-delimited (array of strings, one per document).  These utility methods are located on the Loki object instance itself as the 'serializeDestructured' and 'deserializeDestructured' methods.  They can be invoked to create structured json serialization for the entire database, or (if you pass a partition option) it can provide a single partition at a time.  Internal loki structured serialization in its current form provides mild memory overhead reduction and increases I/O time if only some collections need to be saved.  It may also be useful for other data exchange or synchronization mechanisms. 

In lokijs terminology the partitions of a database include the database container (partition -1) along with each individual collection (partitions 0-n).

To destructure in various formats you can experiment with the following parameters :
```javascript
var result = db.serializeDestructured({
  partitioned: false,
  delimited: false
});
```
To destructure a single partition you might use the following syntax and experiment with 'delimited' and 'partition' properties :
```javascript
var result = db.serializeDestructured({
  partitioned: true,
  partition: 1,
  delimited: false
});
```
> To experiment with the various structured serialization formats you can view this [Loki Sandbox gist](https://rawgit.com/techfort/LokiJS/master/examples/sandbox/LokiSandbox.htm#rawgist=https://gist.githubusercontent.com/obeliskos/98a73205d7fe9746a687634e19a5eb89/raw/3821c9bbb6bae2689b00d16be9fae78dff430e28/destructuring%2520demo) and try various combinations of 'partitioned' and 'delimited' options (making sure both the serializeDestructured and deserializeDestructured use the same values.

Destructuring (making many smaller json serializations vs one large serialization) does not lower memory overhead but seems to be a little faster.  Partitioning can reduce memory overhead if you can dispose of those memory chunks before advancing to the next (which our adapter implementations do).  Our 2.0.0 branch which is able to use ES6 language constructs may gain an iterable interface in the future for data exchange or line-by-line streaming.

If your database is small enough you can use the LokiPartitioningAdapter (with or without paging) along with LokiMemoryAdapter to decompose database into appropriately sized 'chunks' for transmission.

# Detailed LokiIndexedAdapter Description

Our LokiIndexedAdapter is implemented as a 'basic' mode loki persistence adapter.  Since this will probably be the default web persistence adapter, this section will overview some of its advanced features.  

It implements persistence by defining an app/key/value database in indexeddb for storing serialized databases (or partitions).  The 'app' portion is designated when instantiating the adapter and loki only supplies it key/value pair for storage.

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

Note the 'finance' in this case represents an 'App' context and the 'test' designates the key (or database name)... the 'value' is the serialized strings representing your database which loki will provide. Advantages include larger storage limits over localstorage, and a catalog based approach where you can store many databases, grouped by an 'App' context.  Since indexedDB storage is provided 'per-domain', and on any given domain you might be running several web 'apps' each with its own database(s), this structure allows for organization and expandibility.
> _**Note : the 'App' context is an conceptual separation, not a security partition. Security is provided by your web browser, partitioned per-domain within client storage in the browser/system.**_

# Loki Indexed adapter interface

In addition to core loadDatabase and saveDatabase methods, the loki Indexed adapter provides the ability to getDatabaseList (for the current app context), deleteDatabase, and getCatalogSummary to retrieve unfiltered list of app/keys along with the size in database.  (Note sizes reported may not be Unicode sizes so effective 'size' it may consume might be double that amount as indexeddb saves in Unicode).  The loki indexed adapter also is console-friendly... even though indexeddb is highly asynchronous, relying on callbacks, you can omit callbacks for many of its methods and will log results to console instead.  This makes experimenting, diagnosing, and maintenance of loki catalog easier to learn and inspect.

### Full Examples of using loki indexed adapter
```javascript
  // Save : will save App/Key/Val as 'finance'/'test'/{serializedDb}
  // if appContect ('finance' in this example) is omitted, 'loki' will be used
  var idbAdapter = new lokiIndexedAdapter('finance');
  var db = new loki('test', { adapter: idbAdapter });
  var coll = db.addCollection('testColl');
  coll.insert({test: 'val'});
  db.saveDatabase();  // could pass callback if needed for async complete

  // Load database
  var idbAdapter = new LokiIndexedAdapter('finance');
  var db = new loki('test', { adapter: idbAdapter });
  db.loadDatabase({}, function(result) {
    console.log('done');
  });

  // Get database list
  var idbAdapter = new LokiIndexedAdapter('finance');
  idbAdapter.getDatabaseList(function(result) {
    // result is array of string names for that appcontext ('finance')
    result.forEach(function(str) {
      console.log(str);
    });
  });
  
  // Delete database
  var idbAdapter = new LokiIndexedAdapter('finance');
  idbAdapter.deleteDatabase('test'); // delete 'finance'/'test' value from catalog

  // Delete database partitions and/or pages
  // This deletes all partitions or pages derived from this base filename
  var idbAdapter = new LokiIndexedAdapter('finance');
  idbAdapter.deleteDatabasePartitions('test'); 

  // Summary
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

