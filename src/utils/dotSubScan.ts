/* eslint-disable no-prototype-builtins */
/* eslint-disable no-var */

"use strict";
/**
 * dotSubScan - helper function used for dot notation queries.
 *
 * @param {object} root - object to traverse
 * @param {array} paths - array of properties to drill into
 * @param {function} fun - evaluation function to test with
 * @param {any} value - comparative value to also pass to (compare) fun
 * @param {any} extra - extra arg to also pass to compare fun
 * @param {number} poffset - index of the item in 'paths' to start the sub-scan from
 */

export function dotSubScan(
  root: object,
  paths: string[],
  fun: (_0, _1, _2) => boolean,
  value,
  extra,
  poffset?: number
) {
  var pathOffset = poffset || 0;
  var path = paths[pathOffset];

  var valueFound = false;
  var element;
  if (root !== null && typeof root === "object" && path in root) {
    element = root[path];
  }
  if (pathOffset + 1 >= paths.length) {
    // if we have already expanded out the dot notation,
    // then just evaluate the test function and value on the element
    valueFound = fun(element, value, extra);
  } else if (Array.isArray(element)) {
    for (var index = 0, len = element.length; index < len; index += 1) {
      valueFound = dotSubScan(
        element[index],
        paths,
        fun,
        value,
        extra,
        pathOffset + 1
      );
      if (valueFound === true) {
        break;
      }
    }
  } else {
    valueFound = dotSubScan(element, paths, fun, value, extra, pathOffset + 1);
  }

  return valueFound;
}
