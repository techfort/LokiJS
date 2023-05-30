/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-var */
"use strict";

export class UniqueIndex {
  field: any;
  keyMap: any;
  lokiMap: any;
  constructor(uniqueField) {
    this.field = uniqueField;
    this.keyMap = Object.create(null);
    this.lokiMap = Object.create(null);
  }

  set(obj) {
    const fieldValue = obj[this.field];
    if (fieldValue !== null && typeof fieldValue !== "undefined") {
      if (this.keyMap[fieldValue]) {
        throw new Error(
          `Duplicate key for property ${this.field}: ${fieldValue}`
        );
      } else {
        this.keyMap[fieldValue] = obj;
        this.lokiMap[obj.$loki] = fieldValue;
      }
    }
  }

  get(key) {
    return this.keyMap[key];
  }

  byId(id) {
    return this.keyMap[this.lokiMap[id]];
  }

  /**
   * Updates a document's unique index given an updated object.
   * @param  {Object} obj Original document object
   * @param  {Object} doc New document object (likely the same as obj)
   */
  update(obj, doc) {
    if (this.lokiMap[obj.$loki] !== doc[this.field]) {
      const old = this.lokiMap[obj.$loki];
      this.set(doc);
      // make the old key fail bool test, while avoiding the use of delete (mem-leak prone)
      this.keyMap[old] = undefined;
    } else {
      this.keyMap[obj[this.field]] = doc;
    }
  }

  remove(key) {
    const obj = this.keyMap[key];
    if (obj !== null && typeof obj !== "undefined") {
      // avoid using `delete`
      this.keyMap[key] = undefined;
      this.lokiMap[obj.$loki] = undefined;
    } else {
      throw new Error(`Key is not in unique index: ${this.field}`);
    }
  }

  clear() {
    this.keyMap = Object.create(null);
    this.lokiMap = Object.create(null);
  }
}

UniqueIndex.prototype.keyMap = {};
UniqueIndex.prototype.lokiMap = {};
