/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-var */
/**
 * A loki persistence adapter which persists using node fs module
 * @constructor LokiFsAdapter
 */

import Loki from "../Loki";
import { LokiPersistenceAdapter } from "./LokiPersistenceAdapter";

export class LokiFsAdapter implements LokiPersistenceAdapter {
  fs: any;
  constructor() {
    try {
      this.fs = require("fs");
    } catch (e) {
      this.fs = null;
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

  /** loadDatabase() - Load data from file, will throw an error if the file does not exist
   * @param {string} dbname - the filename of the database to load
   * @param {function} callback - the callback to handle the result
   * @memberof LokiFsAdapter
   */
  loadDatabase(dbname: string, callback: (value: any) => void): void {
    const self = this;

    this.fs.stat(dbname, (err, stats) => {
      if (!err && stats.isFile()) {
        self.fs.readFile(
          dbname,
          {
            encoding: "utf8",
          },
          function readFileCallback(err, data) {
            if (err) {
              callback(new Error(err));
            } else {
              callback(data);
            }
          }
        );
      } else {
        callback(null);
      }
    });
  }

  /**
   * saveDatabase() - save data to file, will throw an error if the file can't be saved
   * might want to expand this to avoid dataloss on partial save
   * @param {string} dbname - the filename of the database to load
   * @param {function} callback - the callback to handle the result
   * @memberof LokiFsAdapter
   */
  saveDatabase(dbname, dbstring, callback) {
    const self = this;
    const tmpdbname = `${dbname}~`;
    this.fs.writeFile(tmpdbname, dbstring, function writeFileCallback(err) {
      if (err) {
        callback(new Error(err));
      } else {
        self.fs.rename(tmpdbname, dbname, callback);
      }
    });
  }

  /**
   * deleteDatabase() - delete the database file, will throw an error if the
   * file can't be deleted
   * @param {string} dbname - the filename of the database to delete
   * @param {function} callback - the callback to handle the result
   * @memberof LokiFsAdapter
   */
  deleteDatabase(dbname, callback) {
    this.fs.unlink(dbname, function deleteDatabaseCallback(err) {
      if (err) {
        callback(new Error(err));
      } else {
        callback();
      }
    });
  }
}
