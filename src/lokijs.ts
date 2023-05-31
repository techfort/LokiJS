/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-var */

"use strict";

import { binarySearch } from "./utils/binarySearch";
import Loki from "./modules/Loki";

export var hasOwnProperty = Object.prototype.hasOwnProperty;

// precompile recursively
export function precompileQuery(operator, value) {
  // for regex ops, precompile
  if (operator === "$regex") {
    if (Array.isArray(value)) {
      value = new RegExp(value[0], value[1]);
    } else if (!(value instanceof RegExp)) {
      value = new RegExp(value);
    }
  } else if (typeof value === "object") {
    for (var key in value) {
      if (key === "$regex" || typeof value[key] === "object") {
        value[key] = precompileQuery(key, value[key]);
      }
    }
  }

  return value;
}

/**
 * General utils, including statistical functions
 */

export function parseBase10(num) {
  return parseInt(num, 10);
}

export function deepProperty(obj, property, isDeep) {
  if (isDeep === false) {
    // pass without processing
    return obj[property];
  }
  var pieces = property.split("."),
    root = obj;
  while (pieces.length > 0) {
    root = root[pieces.shift()];
  }
  return root;
}

if (typeof window !== "undefined") {
  // @ts-ignore
  window.loki = Loki;
}

export default Loki;
