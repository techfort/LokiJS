/* eslint-disable no-prototype-builtins */
/* eslint-disable no-var */

"use strict";

export function containsCheckFn(a) {
  if (typeof a === "string" || Array.isArray(a)) {
    return function (b) {
      return a.indexOf(b) !== -1;
    };
  } else if (typeof a === "object" && a !== null) {
    return function (b) {
      return Object.hasOwn(a, b);
    };
  }
  return null;
}
