/**
 * dotSubScan - helper function used for dot notation queries.
 *
 * @param {object} root - object to traverse
 * @param {array} paths - array of properties to drill into
 * @param {function} fun - evaluation function to test with
 * @param {any} value - comparative value to also pass to (compare) fun
 * @param {any} extra - extra arg to also pass to compare fun
 * @param {number} poffset - index of the item in 'paths' to start the sub-scan from
 */
export declare function dotSubScan(root: object, paths: string[], fun: (_0: any, _1: any, _2: any) => boolean, value: any, extra: any, poffset?: number): boolean;
