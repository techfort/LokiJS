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
export declare class LokiMemoryAdapter implements LokiPersistenceAdapter {
    hashStore: Record<string, any>;
    options: Partial<LokiMemoryAdapterOptions>;
    constructor(options?: Partial<LokiMemoryAdapterOptions>);
    mode: string;
    exportDatabase(dbname: string, dbref: typeof Loki, callback: (err: Error) => void): void;
    /**
     * Loads a serialized database from its in-memory store.
     * (Loki persistence adapter interface function)
     *
     * @param {string} dbname - name of the database (filename/keyname)
     * @param {function} callback - adapter callback to return load result to caller
     * @memberof LokiMemoryAdapter
     */
    loadDatabase(dbname: any, callback: any): void;
    /**
     * Saves a serialized database to its in-memory store.
     * (Loki persistence adapter interface function)
     *
     * @param {string} dbname - name of the database (filename/keyname)
     * @param {function} callback - adapter callback to return load result to caller
     * @memberof LokiMemoryAdapter
     */
    saveDatabase(dbname: any, dbstring: any, callback: any): void;
    /**
     * Deletes a database from its in-memory store.
     *
     * @param {string} dbname - name of the database (filename/keyname)
     * @param {function} callback - function to call when done
     * @memberof LokiMemoryAdapter
     */
    deleteDatabase(dbname: any, callback: any): void;
}
export {};
