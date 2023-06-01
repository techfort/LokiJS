import Loki from "../Loki";
import { LokiPersistenceAdapter } from "./LokiPersistenceAdapter";
/**
 * A loki persistence adapter which persists to web browser's local storage object
 * @constructor LokiLocalStorageAdapter
 */
export declare class LokiLocalStorageAdapter implements LokiPersistenceAdapter {
    mode: string;
    exportDatabase(dbname: string, dbref: typeof Loki, callback: (err: Error) => void): void;
    /**
     * loadDatabase() - Load data from localstorage
     * @param {string} dbname - the name of the database to load
     * @param {function} callback - the callback to handle the result
     * @memberof LokiLocalStorageAdapter
     */
    loadDatabase(dbname: any, callback: any): void;
    /**
     * saveDatabase() - save data to localstorage, will throw an error if the file can't be saved
     * might want to expand this to avoid dataloss on partial save
     * @param {string} dbname - the filename of the database to load
     * @param {function} callback - the callback to handle the result
     * @memberof LokiLocalStorageAdapter
     */
    saveDatabase(dbname: any, dbstring: any, callback: any): void;
    /**
     * deleteDatabase() - delete the database from localstorage, will throw an error if it
     * can't be deleted
     * @param {string} dbname - the filename of the database to delete
     * @param {function} callback - the callback to handle the result
     * @memberof LokiLocalStorageAdapter
     */
    deleteDatabase(dbname: any, callback: any): void;
}
