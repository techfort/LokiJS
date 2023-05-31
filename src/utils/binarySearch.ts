/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-var */
"use strict";

export function binarySearch(array, item, fun) {
  var lo = 0,
    hi = array.length,
    compared,
    mid;
  while (lo < hi) {
    mid = (lo + hi) >> 1;
    compared = fun.apply(null, [item, array[mid]]);
    if (compared === 0) {
      return {
        found: true,
        index: mid,
      };
    } else if (compared < 0) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return {
    found: false,
    index: hi,
  };
}

export function BSonSort(fun) {
  return function (array, item) {
    return binarySearch(array, item, fun);
  };
}
