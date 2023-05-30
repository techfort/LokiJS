/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-var */
"use strict";

import { BSonSort, binarySearch } from "../loki";

export function SortedIndex(sortedField) {
  this.field = sortedField;
}

SortedIndex.prototype = {
  keys: [],
  values: [],
  // set the default sort
  sort: function (a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  },
  bs: function () {
    return BSonSort(this.sort);
  },
  // and allow override of the default sort
  setSort: function (fun) {
    this.bs = BSonSort(fun);
  },
  // add the value you want returned  to the key in the index
  set: function (key, value) {
    var pos = binarySearch(this.keys, key, this.sort);
    if (pos.found) {
      this.values[pos.index].push(value);
    } else {
      this.keys.splice(pos.index, 0, key);
      this.values.splice(pos.index, 0, [value]);
    }
  },
  // get all values which have a key == the given key
  get: function (key) {
    var bsr = binarySearch(this.keys, key, this.sort);
    if (bsr.found) {
      return this.values[bsr.index];
    } else {
      return [];
    }
  },
  // get all values which have a key < the given key
  getLt: function (key) {
    var bsr = binarySearch(this.keys, key, this.sort);
    var pos = bsr.index;
    if (bsr.found) pos--;
    return this.getAll(key, 0, pos);
  },
  // get all values which have a key > the given key
  getGt: function (key) {
    var bsr = binarySearch(this.keys, key, this.sort);
    var pos = bsr.index;
    if (bsr.found) pos++;
    return this.getAll(key, pos, this.keys.length);
  },

  // get all vals from start to end
  getAll: function (key, start, end) {
    var results = [];
    for (var i = start; i < end; i++) {
      results = results.concat(this.values[i]);
    }
    return results;
  },
  // just in case someone wants to do something smart with ranges
  getPos: function (key) {
    return binarySearch(this.keys, key, this.sort);
  },
  // remove the value from the index, if the value was the last one, remove the key
  remove: function (key, value) {
    var pos = binarySearch(this.keys, key, this.sort).index;
    var idxSet = this.values[pos];
    for (var i in idxSet) {
      if (idxSet[i] == value) idxSet.splice(i, 1);
    }
    if (idxSet.length < 1) {
      this.keys.splice(pos, 1);
      this.values.splice(pos, 1);
    }
  },
  // clear will zap the index
  clear: function () {
    this.keys = [];
    this.values = [];
  },
};
