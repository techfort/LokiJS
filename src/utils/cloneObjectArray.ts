/* eslint-disable no-prototype-builtins */
/* eslint-disable no-var */
"use strict";
import { clone } from "./clone";

export function cloneObjectArray(objarray, method) {
  if (method == "parse-stringify") {
    return clone(objarray, method);
  }
  var result = [];
  for (var i = 0, len = objarray.length; i < len; i++) {
    result[i] = clone(objarray[i], method);
  }
  return result;
}
