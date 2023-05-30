/* eslint-disable no-prototype-builtins */
/* eslint-disable no-var */

"use strict";
import { cloneObjectArray } from "./cloneObjectArray";

export function clone(data, method) {
  if (data === null || data === undefined) {
    return null;
  }

  var cloneMethod = method || "parse-stringify",
    cloned;

  switch (cloneMethod) {
    case "parse-stringify":
      cloned = JSON.parse(JSON.stringify(data));
      break;
    case "jquery-extend-deep":
      // @ts-ignore
      cloned = jQuery.extend(true, {}, data);
      break;
    case "shallow":
      // more compatible method for older browsers
      cloned = Object.create(data.constructor.prototype);
      Object.keys(data).map(function (i) {
        cloned[i] = data[i];
      });
      break;
    case "shallow-assign":
      // should be supported by newer environments/browsers
      cloned = Object.create(data.constructor.prototype);
      Object.assign(cloned, data);
      break;
    case "shallow-recurse-objects":
      // shallow clone top level properties
      cloned = clone(data, "shallow");
      var keys = Object.keys(data);
      // for each of the top level properties which are object literals, recursively shallow copy
      keys.forEach(function (key) {
        if (
          typeof data[key] === "object" &&
          data[key].constructor.name === "Object"
        ) {
          cloned[key] = clone(data[key], "shallow-recurse-objects");
        } else if (Array.isArray(data[key])) {
          cloned[key] = cloneObjectArray(data[key], "shallow-recurse-objects");
        }
      });
      break;
    default:
      break;
  }

  return cloned;
}
