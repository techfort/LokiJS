import { clone } from "./clone";
import { Utils } from "./index";

/* eslint-disable no-var */
export const copyProperties = function (src, dest) {
  var prop;
  for (prop in src) {
    dest[prop] = src[prop];
  }
};
// used to recursively scan hierarchical transform step object for param substitution
export const resolveTransformObject = function (
  subObj,
  params,
  depth?: number
) {
  var prop, pname;

  if (typeof depth !== "number") {
    depth = 0;
  }

  if (++depth >= 10) return subObj;

  for (prop in subObj) {
    if (
      typeof subObj[prop] === "string" &&
      subObj[prop].indexOf("[%lktxp]") === 0
    ) {
      pname = subObj[prop].substring(8);
      if (Object.hasOwn(params, pname)) {
        subObj[prop] = params[pname];
      }
    } else if (typeof subObj[prop] === "object") {
      subObj[prop] = Utils.resolveTransformObject(subObj[prop], params, depth);
    }
  }

  return subObj;
};
// top level utility to resolve an entire (single) transform (array of steps) for parameter substitution
export const resolveTransformParams = function (transform, params) {
  var idx,
    clonedStep,
    resolvedTransform = [];

  if (typeof params === "undefined") return transform;

  // iterate all steps in the transform array
  for (idx = 0; idx < transform.length; idx++) {
    // clone transform so our scan/replace can operate directly on cloned transform
    clonedStep = clone(transform[idx], "shallow-recurse-objects");
    resolvedTransform.push(resolveTransformObject(clonedStep, params));
  }

  return resolvedTransform;
};

// By default (if usingDotNotation is false), looks up path in
// object via `object[path]`
//
// If `usingDotNotation` is true, then the path is assumed to
// represent a nested path. It can be in the form of an array of
// field names, or a period delimited string. The function will
// look up the value of object[path[0]], and then call
// result[path[1]] on the result, etc etc.
//
// If `usingDotNotation` is true, this function still supports
// non nested fields.
//
// `usingDotNotation` is a performance optimization. The caller
// may know that a path is *not* nested. In which case, this
// function avoids a costly string.split('.')
//
// examples:
// getIn({a: 1}, "a") => 1
// getIn({a: 1}, "a", true) => 1
// getIn({a: {b: 1}}, ["a", "b"], true) => 1
// getIn({a: {b: 1}}, "a.b", true) => 1
export const getIn = function (
  object: object,
  path: string | string[],
  usingDotNotation?: boolean
) {
  if (object == null) {
    return undefined;
  }
  if (!usingDotNotation) {
    return object[path as string];
  }

  if (typeof path === "string") {
    path = path.split(".");
  }

  if (!Array.isArray(path)) {
    throw new Error("path must be a string or array. Found " + typeof path);
  }

  var index = 0,
    length = path.length;

  while (object != null && index < length) {
    object = object[path[index++]];
  }
  return index && index == length ? object : undefined;
};
