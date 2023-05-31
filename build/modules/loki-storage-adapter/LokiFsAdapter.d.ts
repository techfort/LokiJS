/**
 * A loki persistence adapter which persists using node fs module
 * @constructor LokiFsAdapter
 */
import Loki from "../Loki";
import { LokiPersistenceAdapter } from "./LokiPersistenceAdapter";
export declare class LokiFsAdapter implements LokiPersistenceAdapter {
    fs: any;
    constructor();
    mode: string;
    exportDatabase(dbname: string, dbref: typeof Loki, callback: (err: Error) => void): void;
    /** loadDatabase() - Load data from file, will throw an error if the file does not exist
     * @param {string} dbname - the filename of the database to load
     * @param {function} callback - the callback to handle the result
     * @memberof LokiFsAdapter
     */
    loadDatabase(dbname: string, callback: (value: any) => void): void;
    /**
     * saveDatabase() - save data to file, will throw an error if the file can't be saved
     * might want to expand this to avoid dataloss on partial save
     * @param {string} dbname - the filename of the database to load
     * @param {function} callback - the callback to handle the result
     * @memberof LokiFsAdapter
     */
    saveDatabase(dbname: any, dbstring: any, callback: any): void;
    /**
     * deleteDatabase() - delete the database file, will throw an error if the
     * file can't be deleted
     * @param {string} dbname - the filename of the database to delete
     * @param {function} callback - the callback to handle the result
     * @memberof LokiFsAdapter
     */
    deleteDatabase(dbname: any, callback: any): void;
}
