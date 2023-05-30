/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-var */
/*------------------+
  | PERSISTENCE       |
  -------------------*/
/** there are two build in persistence adapters for internal use
 * fs             for use in Nodejs type environments
 * localStorage   for use in browser environment
 * defined as helper classes here so its easy and clean to use
 */
/**
 * In in-memory persistence adapter for an in-memory database.
 * This simple 'key/value' adapter is intended for unit testing and diagnostics.
 *
 * @param {object=} options - memory adapter options
 * @param {boolean} [options.asyncResponses=false] - whether callbacks are invoked asynchronously
 * @param {int} [options.asyncTimeout=50] - timeout in ms to queue callbacks
 * @constructor LokiMemoryAdapter
 */

import Loki from "../Loki";
import { LokiPersistenceAdapter } from "./LokiPersistenceAdapter";

interface LokiMemoryAdapterOptions {
  asyncResponses: boolean;
  asyncTimeout: number;
}
export class LokiMemoryAdapter implements LokiPersistenceAdapter {
  hashStore: Record<string, any>;
  options: Partial<LokiMemoryAdapterOptions>;
  constructor(options: LokiMemoryAdapterOptions) {
    this.hashStore = {};
    this.options = options || {};

    if (!this.options.hasOwnProperty("asyncResponses")) {
      this.options.asyncResponses = false;
    }

    if (!this.options.hasOwnProperty("asyncTimeout")) {
      this.options.asyncTimeout = 50; // 50 ms default
    }
  }
  mode: string;
  exportDatabase(
    dbname: string,
    dbref: typeof Loki,
    callback: (err: Error) => void
  ): void {
    throw new Error("Method not implemented.");
  }

  /**
   * Loads a serialized database from its in-memory store.
   * (Loki persistence adapter interface function)
   *
   * @param {string} dbname - name of the database (filename/keyname)
   * @param {function} callback - adapter callback to return load result to caller
   * @memberof LokiMemoryAdapter
   */
  loadDatabase(dbname, callback) {
    const self = this;

    if (this.options.asyncResponses) {
      setTimeout(() => {
        if (self.hashStore.hasOwnProperty(dbname)) {
          callback(self.hashStore[dbname].value);
        } else {
          // database doesn't exist, return falsy
          callback(null);
        }
      }, this.options.asyncTimeout);
    } else {
      if (this.hashStore.hasOwnProperty(dbname)) {
        // database doesn't exist, return falsy
        callback(this.hashStore[dbname].value);
      } else {
        callback(null);
      }
    }
  }

  /**
   * Saves a serialized database to its in-memory store.
   * (Loki persistence adapter interface function)
   *
   * @param {string} dbname - name of the database (filename/keyname)
   * @param {function} callback - adapter callback to return load result to caller
   * @memberof LokiMemoryAdapter
   */
  saveDatabase(dbname, dbstring, callback) {
    const self = this;
    let saveCount;

    if (this.options.asyncResponses) {
      setTimeout(() => {
        saveCount = self.hashStore.hasOwnProperty(dbname)
          ? self.hashStore[dbname].savecount
          : 0;

        self.hashStore[dbname] = {
          savecount: saveCount + 1,
          lastsave: new Date(),
          value: dbstring,
        };

        callback();
      }, this.options.asyncTimeout);
    } else {
      saveCount = this.hashStore.hasOwnProperty(dbname)
        ? this.hashStore[dbname].savecount
        : 0;

      this.hashStore[dbname] = {
        savecount: saveCount + 1,
        lastsave: new Date(),
        value: dbstring,
      };

      callback();
    }
  }

  /**
   * Deletes a database from its in-memory store.
   *
   * @param {string} dbname - name of the database (filename/keyname)
   * @param {function} callback - function to call when done
   * @memberof LokiMemoryAdapter
   */
  deleteDatabase(dbname, callback) {
    if (this.hashStore.hasOwnProperty(dbname)) {
      delete this.hashStore[dbname];
    }

    if (typeof callback === "function") {
      callback();
    }
  }
}
