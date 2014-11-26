/*
  Examples : will delete once wired up to main lokijs script

  var ia = new IndexedAdapter('loki', function() {
    ia.SaveDatabase('test', "some raw serialized db string");
    ia.LoadDatabase('test', function(result) {
    	API_Inspect(result);
    });
    ia.GetDatabaseList(function(result) {
      API_Inspect(result);
    });
});

*/

/**
 * IndexedAdapter - Loki persistence adapter for indexedDb.
 *     Intended to provide abstract interface for loki to configure and use.
 *     Utilizes the LokiCatalog app/key/value database for database persistence.
 *     If you use loki across several applications on a single domain you can provide separate 'app' names for each.
 *
 * @param {string} appname - Application name context can be used to distinguish subdomains or just 'loki'
 * @param {function} callback - (Optional) callback to be notified when adapter is initialized
 */
function IndexedAdapter(appname, callback)
{
  this.app = 'loki';
  
  if (typeof (app) !== 'undefined') 
  {
    this.app = appname;
  }
  
  this.catalog = new LokiCatalog(callback);
}

/**
 * LoadDatabase() - Retrieves a serialized db string from the catalog.
 *
 * @param {string} dbname - the name of the database to retrieve.
 * @param {function} callback - callback should accept string param containing serialized db string.
 */
IndexedAdapter.prototype.LoadDatabase = function(dbname, callback)
{
  this.catalog.GetAppKey(this.app, dbname, function(result) {
    callback(result.val);
  });
}

/**
 * SaveDatabase() - Saves a serialized db to the catalog.
 *
 * @param {string} dbname - the name to give the serialized database within the catalog.
 * @param {string} dbstring - the serialized db string to save.
 * @param {function} callback - (Optional) callback passed obj.success with true or false
 */
IndexedAdapter.prototype.SaveDatabase = function(dbname, dbstring, callback)
{
  this.catalog.SetAppKey(this.app, dbname, dbstring, callback);
}

/**
 * DeleteDatabase() - Deletes a serialized db from the catalog.
 *
 * @param {string} dbname - the name of the database to delete from the catalog.
 */
IndexedAdapter.prototype.DeleteDatabase = function(dbname)
{
  var cat = this.catalog;
  
  this.catalog.GetAppKey(this.app, dbname, function(result) {
    var id = result.id;
    
    if (id !== 0) {
      cat.DeleteAppKey(id);
    }
  });
}

/**
 * GetDatabaseList() - Retrieves object array of catalog entries for current app.
 *
 * @param {function} callback - should accept array of database names in the catalog for current app.
 */
IndexedAdapter.prototype.GetDatabaseList = function(callback)
{
  // In constructor we define the app, so we will get entries for just that app.
  this.catalog.GetAppKeys(this.app, function(results) {
    var names = [];
    
    for(var idx = 0; idx < results.length; idx++) {
      names.push(results[idx].key);
    }
    
    callback(names);
  });
}

/**
 * LokiCatalog - underlying App/Key/Value catalog persistence
 *
 */
function LokiCatalog(callback) 
{
	this.db = null;

  this.InitializeLokiCatalog(callback);
}

LokiCatalog.prototype.InitializeLokiCatalog = function(callback)
{
  var openRequest = indexedDB.open("LokiCatalog", 1);
  var cat = this;
  
  // If database doesn't exist yet or its version is lower than our version specified above (2nd param in line above)
  openRequest.onupgradeneeded = function(e) {
    var thisDB = e.target.result;
    if (thisDB.objectStoreNames.contains("LokiAKV")) {
      thisDB.deleteObjectStore("LokiAKV");
    }

    if(!thisDB.objectStoreNames.contains("LokiAKV")) {
      var objectStore = thisDB.createObjectStore("LokiAKV", { keyPath: "id", autoIncrement:true });
      objectStore.createIndex("app","app", {unique:false});
      objectStore.createIndex("key","key", {unique:false});
      // hack to simulate composite key since overhead is low (main size should be in val field)
      // user (me) required to duplicate the app and key into comma delimited appkey field off object
      // This will allow retrieving single record with that composite key as well as 
      // still supporting opening cursors on app or key alone
      objectStore.createIndex("appkey", "appkey", {unique:true});
    }
  }

  openRequest.onsuccess = function(e) {
    cat.db = e.target.result;

    if (typeof (callback) === 'function') callback(e.target.result);
  }

  openRequest.onerror = function(e) {
    throw new Error(e);
  }
}

LokiCatalog.prototype.GetAppKey = function(app, key, callback) {
  var transaction = this.db.transaction(["LokiAKV"], "readonly");
  var store = transaction.objectStore("LokiAKV");
  var index = store.index("appkey");
  var appkey = app + "," + key;
  var request = index.get(appkey);

  request.onsuccess = (function(usercallback) {
    return function(e) {
      if (typeof(usercallback) == "function") {
        var lres = e.target.result;

        if (typeof(lres) == "undefined") {
          lres = { 
            id: 0, 
            success: false 
          };
        }

        usercallback(lres);
      }
    }
  })(callback);
	
  request.onerror = (function(usercallback) {
    return function(e) {
      if (typeof(usercallback) == "function") usercallback({ id: 0, success: false });
    }
  })(callback);
}

LokiCatalog.prototype.GetAppKeyById = function (id, callback, data) {
  var transaction = this.db.transaction(["LokiAKV"],"readonly");
  var store = transaction.objectStore("LokiAKV");
  var request = store.get(id);

  request.onsuccess = (function(data, usercallback){
    return function(e) { 
      if (typeof(usercallback) == "function") {
        usercallback(e.target.result, data);
      }
    };
  })(data, callback);   
}

LokiCatalog.prototype.SetAppKey = function (app, key, val, callback) {
  var transaction = this.db.transaction(["LokiAKV"],"readwrite");
  var store = transaction.objectStore("LokiAKV");
  var index = store.index("appkey");
  var appkey = app + "," + key;
  var request = index.get(appkey);

  // first try to retrieve an existing object by that key
  // need to do this because to update an object you need to have id in object, otherwise it will append id with new autocounter and clash the unique index appkey
  request.onsuccess = function(e) {
    var res = e.target.result;

    if (res == null) {
      res = {
        app:app,
        key:key,
        appkey: app + ',' + key,
        val:val
      }
    }
    else {
      res.val = val;
    }
		
    var requestPut = store.put(res);

    requestPut.onerror = (function(usercallback) {
      return function(e) {
        if (typeof(usercallback) == "function") usercallback({ success: false });
      }
    })(callback);

    requestPut.onsuccess = (function(usercallback) {
      return function(e) {
        if (typeof(usercallback) == "function") usercallback({ success: true });
      }
    })(callback);
  };

  request.onerror = (function(usercallback) {
    return function(e) {
      if (typeof(usercallback) == "function") usercallback({ success: false });
    }
  })(callback);
}

LokiCatalog.prototype.DeleteAppKey = function (id, callback) {	
  var transaction = this.db.transaction(["LokiAKV"],"readwrite");
  var store = transaction.objectStore("LokiAKV");
  var request = store.delete(id);

  request.onsuccess = (function(usercallback) {
    return function(evt) {
      if (typeof(usercallback) == "function") usercallback({ success: true });
    };
  })(callback);

  request.onerror = (function(usercallback) {
    return function(evt) {
      if (typeof(usercallback) == "function") usercallback(false);
    }
  })(callback);
}

LokiCatalog.prototype.GetAppKeys = function(app, callback) {
  var transaction = this.db.transaction(["LokiAKV"], "readonly");
  var store = transaction.objectStore("LokiAKV");
  var index = store.index("app");

  // We want cursor to all values matching our (single) app param
  var singleKeyRange = IDBKeyRange.only(app);

  // To use one of the key ranges, pass it in as the first argument of openCursor()/openKeyCursor()
  var cursor = index.openCursor(singleKeyRange);

  // cursor internally, pushing results into this.data[] and return 
  // this.data[] when done (similar to service)
  var localdata = [];

  cursor.onsuccess = (function(data, callback) {
    return function(e) {
      var cursor = e.target.result;
      if (cursor) {
        var currObject = cursor.value;

        data.push(currObject);

        cursor.continue();
      }
      else {
        if (typeof(callback) == "function") callback(data);
      }
    }
  })(localdata, callback);

  cursor.onerror = (function(usercallback) {
    return function(e) {
      if (typeof(usercallback) == "function") usercallback(null);
    }
  })(callback);
  
}

// Hide 'cursoring' and return array of { id: id, key: key }
LokiCatalog.prototype.GetAllKeys = function (callback) {
  var transaction = this.db.transaction(["LokiAKV"], "readonly");
  var store = transaction.objectStore("LokiAKV");
  var cursor = store.openCursor();

  var localdata = [];

  cursor.onsuccess = (function(data, callback) {
    return function(e) {
      var cursor = e.target.result;
      if (cursor) {
        var currObject = cursor.value;

        data.push(currObject);

        cursor.continue();
      }
      else {
        if (typeof(callback) == "function") callback(data);
      }
    }
  })(localdata, callback);

  cursor.onerror = (function(usercallback) {
    return function(e) {
      if (typeof(usercallback) == "function") usercallback(null);
    }
  })(callback);

}

