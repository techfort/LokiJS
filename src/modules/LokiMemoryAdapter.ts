/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-var */
"use strict";
/*------------------+
  | PERSISTENCE       |
  -------------------*/
/** there are two build in persistence adapters for internal use
 * fs             for use in Nodejs type environments
 * localStorage   for use in browser environment
 * defined as helper classes here so its easy and clean to use
 */
/**
 * In in-memory persistence adapter for an in-memory database.
 * This simple 'key/value' adapter is intended for unit testing and diagnostics.
 *
 * @param {object=} options - memory adapter options
 * @param {boolean} [options.asyncResponses=false] - whether callbacks are invoked asynchronously
 * @param {int} [options.asyncTimeout=50] - timeout in ms to queue callbacks
 * @constructor LokiMemoryAdapter
 */

export function LokiMemoryAdapter(options) {
  this.hashStore = {};
  this.options = options || {};

  if (!this.options.hasOwnProperty("asyncResponses")) {
    this.options.asyncResponses = false;
  }

  if (!this.options.hasOwnProperty("asyncTimeout")) {
    this.options.asyncTimeout = 50; // 50 ms default
  }
}

/**
 * Loads a serialized database from its in-memory store.
 * (Loki persistence adapter interface function)
 *
 * @param {string} dbname - name of the database (filename/keyname)
 * @param {function} callback - adapter callback to return load result to caller
 * @memberof LokiMemoryAdapter
 */
LokiMemoryAdapter.prototype.loadDatabase = function (dbname, callback) {
  var self = this;

  if (this.options.asyncResponses) {
    setTimeout(function () {
      if (self.hashStore.hasOwnProperty(dbname)) {
        callback(self.hashStore[dbname].value);
      } else {
        // database doesn't exist, return falsy
        callback(null);
      }
    }, this.options.asyncTimeout);
  } else {
    if (this.hashStore.hasOwnProperty(dbname)) {
      // database doesn't exist, return falsy
      callback(this.hashStore[dbname].value);
    } else {
      callback(null);
    }
  }
};

/**
 * Saves a serialized database to its in-memory store.
 * (Loki persistence adapter interface function)
 *
 * @param {string} dbname - name of the database (filename/keyname)
 * @param {function} callback - adapter callback to return load result to caller
 * @memberof LokiMemoryAdapter
 */
LokiMemoryAdapter.prototype.saveDatabase = function (
  dbname,
  dbstring,
  callback
) {
  var self = this;
  var saveCount;

  if (this.options.asyncResponses) {
    setTimeout(function () {
      saveCount = self.hashStore.hasOwnProperty(dbname)
        ? self.hashStore[dbname].savecount
        : 0;

      self.hashStore[dbname] = {
        savecount: saveCount + 1,
        lastsave: new Date(),
        value: dbstring,
      };

      callback();
    }, this.options.asyncTimeout);
  } else {
    saveCount = this.hashStore.hasOwnProperty(dbname)
      ? this.hashStore[dbname].savecount
      : 0;

    this.hashStore[dbname] = {
      savecount: saveCount + 1,
      lastsave: new Date(),
      value: dbstring,
    };

    callback();
  }
};

/**
 * Deletes a database from its in-memory store.
 *
 * @param {string} dbname - name of the database (filename/keyname)
 * @param {function} callback - function to call when done
 * @memberof LokiMemoryAdapter
 */
LokiMemoryAdapter.prototype.deleteDatabase = function (dbname, callback) {
  if (this.hashStore.hasOwnProperty(dbname)) {
    delete this.hashStore[dbname];
  }

  if (typeof callback === "function") {
    callback();
  }
};
