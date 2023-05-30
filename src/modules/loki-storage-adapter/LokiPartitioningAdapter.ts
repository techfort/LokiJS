/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-var */
"use strict";

import Loki from "../Loki";

/**
 * An adapter for adapters.  Converts a non reference mode adapter into a reference mode adapter
 * which can perform destructuring and partioning.  Each collection will be stored in its own key/save and
 * only dirty collections will be saved.  If you  turn on paging with default page size of 25megs and save
 * a 75 meg collection it should use up roughly 3 save slots (key/value pairs sent to inner adapter).
 * A dirty collection that spans three pages will save all three pages again
 * Paging mode was added mainly because Chrome has issues saving 'too large' of a string within a
 * single indexeddb row.  If a single document update causes the collection to be flagged as dirty, all
 * of that collection's pages will be written on next save.
 *
 * @param {object} adapter - reference to a 'non-reference' mode loki adapter instance.
 * @param {object=} options - configuration options for partitioning and paging
 * @param {bool} options.paging - (default: false) set to true to enable paging collection data.
 * @param {int} options.pageSize - (default : 25MB) you can use this to limit size of strings passed to inner adapter.
 * @param {string} options.delimiter - allows you to override the default delimeter
 * @constructor LokiPartitioningAdapter
 */
export function LokiPartitioningAdapter(adapter, options) {
  this.mode = "reference";
  this.adapter = null;
  this.options = options || {};
  this.dbref = null;
  this.dbname = "";
  this.pageIterator = {};

  // verify user passed an appropriate adapter
  if (adapter) {
    if (adapter.mode === "reference") {
      throw new Error(
        "LokiPartitioningAdapter cannot be instantiated with a reference mode adapter"
      );
    } else {
      this.adapter = adapter;
    }
  } else {
    throw new Error(
      "LokiPartitioningAdapter requires a (non-reference mode) adapter on construction"
    );
  }

  // set collection paging defaults
  if (!this.options.hasOwnProperty("paging")) {
    this.options.paging = false;
  }

  // default to page size of 25 megs (can be up to your largest serialized object size larger than this)
  if (!this.options.hasOwnProperty("pageSize")) {
    this.options.pageSize = 25 * 1024 * 1024;
  }

  if (!this.options.hasOwnProperty("delimiter")) {
    this.options.delimiter = "$<\n";
  }
}

/**
 * Loads a database which was partitioned into several key/value saves.
 * (Loki persistence adapter interface function)
 *
 * @param {string} dbname - name of the database (filename/keyname)
 * @param {function} callback - adapter callback to return load result to caller
 * @memberof LokiPartitioningAdapter
 */
LokiPartitioningAdapter.prototype.loadDatabase = function (dbname, callback) {
  var self = this;
  this.dbname = dbname;
  this.dbref = new Loki(dbname);

  // load the db container (without data)
  this.adapter.loadDatabase(dbname, function (result) {
    // empty database condition is for inner adapter return null/undefined/falsy
    if (!result) {
      // partition 0 not found so new database, no need to try to load other partitions.
      // return same falsy result to loadDatabase to signify no database exists (yet)
      callback(result);
      return;
    }

    if (typeof result !== "string") {
      callback(
        new Error(
          "LokiPartitioningAdapter received an unexpected response from inner adapter loadDatabase()"
        )
      );
    }

    // I will want to use loki destructuring helper methods so i will inflate into typed instance
    var db = JSON.parse(result);
    self.dbref.loadJSONObject(db);
    db = null;

    if (self.dbref.collections.length === 0) {
      callback(self.dbref);
      return;
    }

    self.pageIterator = {
      collection: 0,
      pageIndex: 0,
    };

    self.loadNextPartition(0, function () {
      callback(self.dbref);
    });
  });
};

/**
 * Used to sequentially load each collection partition, one at a time.
 *
 * @param {int} partition - ordinal collection position to load next
 * @param {function} callback - adapter callback to return load result to caller
 */
LokiPartitioningAdapter.prototype.loadNextPartition = function (
  partition,
  callback
) {
  var keyname = this.dbname + "." + partition;
  var self = this;

  if (this.options.paging === true) {
    this.pageIterator.pageIndex = 0;
    this.loadNextPage(callback);
    return;
  }

  this.adapter.loadDatabase(keyname, function (result) {
    var data = self.dbref.deserializeCollection(result, {
      delimited: true,
      collectionIndex: partition,
    });
    self.dbref.collections[partition].data = data;

    if (++partition < self.dbref.collections.length) {
      self.loadNextPartition(partition, callback);
    } else {
      callback();
    }
  });
};

/**
 * Used to sequentially load the next page of collection partition, one at a time.
 *
 * @param {function} callback - adapter callback to return load result to caller
 */
LokiPartitioningAdapter.prototype.loadNextPage = function (callback) {
  // calculate name for next saved page in sequence
  var keyname =
    this.dbname +
    "." +
    this.pageIterator.collection +
    "." +
    this.pageIterator.pageIndex;
  var self = this;

  // load whatever page is next in sequence
  this.adapter.loadDatabase(keyname, function (result) {
    var data = result.split(self.options.delimiter);
    result = ""; // free up memory now that we have split it into array
    var dlen = data.length;
    var idx;

    // detect if last page by presence of final empty string element and remove it if so
    var isLastPage = data[dlen - 1] === "";
    if (isLastPage) {
      data.pop();
      dlen = data.length;
      // empty collections are just a delimiter meaning two blank items
      if (data[dlen - 1] === "" && dlen === 1) {
        data.pop();
        dlen = data.length;
      }
    }

    // convert stringified array elements to object instances and push to collection data
    for (idx = 0; idx < dlen; idx++) {
      self.dbref.collections[self.pageIterator.collection].data.push(
        JSON.parse(data[idx])
      );
      data[idx] = null;
    }
    data = [];

    // if last page, we are done with this partition
    if (isLastPage) {
      // if there are more partitions, kick off next partition load
      if (++self.pageIterator.collection < self.dbref.collections.length) {
        self.loadNextPartition(self.pageIterator.collection, callback);
      } else {
        callback();
      }
    } else {
      self.pageIterator.pageIndex++;
      self.loadNextPage(callback);
    }
  });
};

/**
 * Saves a database by partioning into separate key/value saves.
 * (Loki 'reference mode' persistence adapter interface function)
 *
 * @param {string} dbname - name of the database (filename/keyname)
 * @param {object} dbref - reference to database which we will partition and save.
 * @param {function} callback - adapter callback to return load result to caller
 *
 * @memberof LokiPartitioningAdapter
 */
LokiPartitioningAdapter.prototype.exportDatabase = function (
  dbname,
  dbref,
  callback
) {
  var idx,
    clen = dbref.collections.length;

  this.dbref = dbref;
  this.dbname = dbname;

  // queue up dirty partitions to be saved
  this.dirtyPartitions = [-1];
  for (idx = 0; idx < clen; idx++) {
    if (dbref.collections[idx].dirty) {
      this.dirtyPartitions.push(idx);
    }
  }

  this.saveNextPartition(function (err) {
    callback(err);
  });
};

/**
 * Helper method used internally to save each dirty collection, one at a time.
 *
 * @param {function} callback - adapter callback to return load result to caller
 */
LokiPartitioningAdapter.prototype.saveNextPartition = function (callback) {
  var self = this;
  var partition = this.dirtyPartitions.shift();
  var keyname = this.dbname + (partition === -1 ? "" : "." + partition);

  // if we are doing paging and this is collection partition
  if (this.options.paging && partition !== -1) {
    this.pageIterator = {
      collection: partition,
      docIndex: 0,
      pageIndex: 0,
    };

    // since saveNextPage recursively calls itself until done, our callback means this whole paged partition is finished
    this.saveNextPage(function (err) {
      if (self.dirtyPartitions.length === 0) {
        callback(err);
      } else {
        self.saveNextPartition(callback);
      }
    });
    return;
  }

  // otherwise this is 'non-paged' partioning...
  var result = this.dbref.serializeDestructured({
    partitioned: true,
    delimited: true,
    partition: partition,
  });

  this.adapter.saveDatabase(keyname, result, function (err) {
    if (err) {
      callback(err);
      return;
    }

    if (self.dirtyPartitions.length === 0) {
      callback(null);
    } else {
      self.saveNextPartition(callback);
    }
  });
};

/**
 * Helper method used internally to generate and save the next page of the current (dirty) partition.
 *
 * @param {function} callback - adapter callback to return load result to caller
 */
LokiPartitioningAdapter.prototype.saveNextPage = function (callback) {
  var self = this;
  var coll = this.dbref.collections[this.pageIterator.collection];
  var keyname =
    this.dbname +
    "." +
    this.pageIterator.collection +
    "." +
    this.pageIterator.pageIndex;
  var pageLen = 0,
    cdlen = coll.data.length,
    delimlen = this.options.delimiter.length;
  var serializedObject = "",
    pageBuilder = "";
  var doneWithPartition = false,
    doneWithPage = false;

  var pageSaveCallback = function (err) {
    pageBuilder = "";

    if (err) {
      callback(err);
    }

    // update meta properties then continue process by invoking callback
    if (doneWithPartition) {
      callback(null);
    } else {
      self.pageIterator.pageIndex++;
      self.saveNextPage(callback);
    }
  };

  if (coll.data.length === 0) {
    doneWithPartition = true;
  }

  while (true) {
    if (!doneWithPartition) {
      // serialize object
      serializedObject = JSON.stringify(coll.data[this.pageIterator.docIndex]);
      pageBuilder += serializedObject;
      pageLen += serializedObject.length;

      // if no more documents in collection to add, we are done with partition
      if (++this.pageIterator.docIndex >= cdlen) doneWithPartition = true;
    }
    // if our current page is bigger than defined pageSize, we are done with page
    if (pageLen >= this.options.pageSize) doneWithPage = true;

    // if not done with current page, need delimiter before next item
    // if done with partition we also want a delmiter to indicate 'end of pages' final empty row
    if (!doneWithPage || doneWithPartition) {
      pageBuilder += this.options.delimiter;
      pageLen += delimlen;
    }

    // if we are done with page save it and pass off to next recursive call or callback
    if (doneWithPartition || doneWithPage) {
      this.adapter.saveDatabase(keyname, pageBuilder, pageSaveCallback);
      return;
    }
  }
};
