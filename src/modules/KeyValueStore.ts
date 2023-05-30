/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-var */
"use strict";

import { BSonSort, binarySearch } from "../lokijs";

export function KeyValueStore() {}

KeyValueStore.prototype = {
  keys: [],
  values: [],
  sort: function (a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  },
  setSort: function (fun) {
    this.bs = BSonSort(fun);
  },
  bs: function () {
    return BSonSort(this.sort);
  },
  set: function (key, value) {
    var pos = this.bs(this.keys, key);
    if (pos.found) {
      this.values[pos.index] = value;
    } else {
      this.keys.splice(pos.index, 0, key);
      this.values.splice(pos.index, 0, value);
    }
  },
  get: function (key) {
    return this.values[binarySearch(this.keys, key, this.sort).index];
  },
};
