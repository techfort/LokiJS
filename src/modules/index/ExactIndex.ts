/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-var */
"use strict";

export class ExactIndex {
  index: any;
  field: any;
  constructor(exactField) {
    this.index = Object.create(null);
    this.field = exactField;
  }

  // add the value you want returned to the key in the index
  set(key, val) {
    if (this.index[key]) {
      this.index[key].push(val);
    } else {
      this.index[key] = [val];
    }
  }

  // remove the value from the index, if the value was the last one, remove the key
  remove(key, val) {
    const idxSet = this.index[key];
    for (const i in idxSet) {
      if (idxSet[i] == val) {
        idxSet.splice(i, 1);
      }
    }
    if (idxSet.length < 1) {
      this.index[key] = undefined;
    }
  }

  // get the values related to the key, could be more than one
  get(key) {
    return this.index[key];
  }

  // clear will zap the index
  clear() {
    this.index = {};
  }
}
