export interface LokiPartitioningAdapterOptions {
    paging: boolean;
    pageSize: number;
    delimiter: string;
}
/**
 * An adapter for adapters.  Converts a non reference mode adapter into a reference mode adapter
 * which can perform destructuring and partioning.  Each collection will be stored in its own key/save and
 * only dirty collections will be saved.  If you  turn on paging with default page size of 25megs and save
 * a 75 meg collection it should use up roughly 3 save slots (key/value pairs sent to inner adapter).
 * A dirty collection that spans three pages will save all three pages again
 * Paging mode was added mainly because Chrome has issues saving 'too large' of a string within a
 * single indexeddb row.  If a single document update causes the collection to be flagged as dirty, all
 * of that collection's pages will be written on next save.
 *
 * @param {object} adapter - reference to a 'non-reference' mode loki adapter instance.
 * @param {object=} options - configuration options for partitioning and paging
 * @param {bool} options.paging - (default: false) set to true to enable paging collection data.
 * @param {int} options.pageSize - (default : 25MB) you can use this to limit size of strings passed to inner adapter.
 * @param {string} options.delimiter - allows you to override the default delimeter
 * @constructor LokiPartitioningAdapter
 */
export declare function LokiPartitioningAdapter(adapter: any, options?: Partial<LokiPartitioningAdapterOptions>): void;
