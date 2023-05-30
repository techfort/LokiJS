/* eslint-disable no-prototype-builtins */
/* eslint-disable no-var */
import { localStorageAvailable } from "../../utils/localStorageAvailable";
import Loki from "../Loki";
import { LokiPersistenceAdapter } from "./LokiPersistenceAdapter";

/**
 * A loki persistence adapter which persists to web browser's local storage object
 * @constructor LokiLocalStorageAdapter
 */

export class LokiLocalStorageAdapter implements LokiPersistenceAdapter {
  mode: string;
  exportDatabase(
    dbname: string,
    dbref: typeof Loki,
    callback: (err: Error) => void
  ): void {
    throw new Error("Method not implemented.");
  }
  /**
   * loadDatabase() - Load data from localstorage
   * @param {string} dbname - the name of the database to load
   * @param {function} callback - the callback to handle the result
   * @memberof LokiLocalStorageAdapter
   */
  loadDatabase(dbname, callback) {
    if (localStorageAvailable()) {
      callback(localStorage.getItem(dbname));
    } else {
      callback(new Error("localStorage is not available"));
    }
  }

  /**
   * saveDatabase() - save data to localstorage, will throw an error if the file can't be saved
   * might want to expand this to avoid dataloss on partial save
   * @param {string} dbname - the filename of the database to load
   * @param {function} callback - the callback to handle the result
   * @memberof LokiLocalStorageAdapter
   */
  saveDatabase(dbname, dbstring, callback) {
    if (localStorageAvailable()) {
      localStorage.setItem(dbname, dbstring);
      callback(null);
    } else {
      callback(new Error("localStorage is not available"));
    }
  }

  /**
   * deleteDatabase() - delete the database from localstorage, will throw an error if it
   * can't be deleted
   * @param {string} dbname - the filename of the database to delete
   * @param {function} callback - the callback to handle the result
   * @memberof LokiLocalStorageAdapter
   */
  deleteDatabase(dbname, callback) {
    if (localStorageAvailable()) {
      localStorage.removeItem(dbname);
      callback(null);
    } else {
      callback(new Error("localStorage is not available"));
    }
  }
}
