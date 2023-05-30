/* eslint-disable no-prototype-builtins */
/* eslint-disable no-var */
"use strict";

export function localStorageAvailable() {
  try {
    return (
      window &&
      window.localStorage !== undefined &&
      window.localStorage !== null
    );
  } catch (e) {
    return false;
  }
}
