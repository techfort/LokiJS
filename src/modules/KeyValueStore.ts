/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-var */
import { BSonSort, binarySearch } from "../utils/binarySearch";

export function KeyValueStore() {}

KeyValueStore.prototype = {
  keys: [],
  values: [],
  sort(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  },
  setSort(fun) {
    this.bs = BSonSort(fun);
  },
  bs() {
    return BSonSort(this.sort);
  },
  set(key, value) {
    const pos = this.bs(this.keys, key);
    if (pos.found) {
      this.values[pos.index] = value;
    } else {
      this.keys.splice(pos.index, 0, key);
      this.values.splice(pos.index, 0, value);
    }
  },
  get(key) {
    return this.values[binarySearch(this.keys, key, this.sort).index];
  },
};
