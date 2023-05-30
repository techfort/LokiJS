/* eslint-disable no-prototype-builtins */
/* eslint-disable no-var */
/**
 * LokiJS
 * @author Joe Minichino <joe.minichino@gmail.com>
 *
 * A lightweight document oriented javascript database
 */
"use strict";
import { clone } from "./clone";

export function freeze(obj) {
  if (!Object.isFrozen(obj)) {
    Object.freeze(obj);
  }
}
export function deepFreeze(obj) {
  var prop, i;
  if (Array.isArray(obj)) {
    for (i = 0; i < obj.length; i++) {
      deepFreeze(obj[i]);
    }
    freeze(obj);
  } else if (obj !== null && typeof obj === "object") {
    for (prop in obj) {
      if (Object.hasOwn(obj, prop)) {
        deepFreeze(obj[prop]);
      }
    }
    freeze(obj);
  }
}

export function unFreeze(obj) {
  if (!Object.isFrozen(obj)) {
    return obj;
  }
  return clone(obj, "shallow");
}
