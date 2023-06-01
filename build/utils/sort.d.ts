export declare var Comparators: {
    aeq: typeof aeqHelper;
    lt: typeof ltHelper;
    gt: typeof gtHelper;
};
/** Helper function for determining 'loki' abstract equality which is a little more abstract than ==
 *     aeqHelper(5, '5') === true
 *     aeqHelper(5.0, '5') === true
 *     aeqHelper(new Date("1/1/2011"), new Date("1/1/2011")) === true
 *     aeqHelper({a:1}, {z:4}) === true (all objects sorted equally)
 *     aeqHelper([1, 2, 3], [1, 3]) === false
 *     aeqHelper([1, 2, 3], [1, 2, 3]) === true
 *     aeqHelper(undefined, null) === true
 */
export declare function aeqHelper(prop1: any, prop2: any): boolean;
/** Helper function for determining 'less-than' conditions for ops, sorting, and binary indices.
 *     In the future we might want $lt and $gt ops to use their own functionality/helper.
 *     Since binary indices on a property might need to index [12, NaN, new Date(), Infinity], we
 *     need this function (as well as gtHelper) to always ensure one value is LT, GT, or EQ to another.
 */
export declare function ltHelper(prop1: any, prop2: any, equal: any): any;
export declare function gtHelper(prop1: any, prop2: any, equal: any): any;
export declare function sortHelper(prop1: any, prop2: any, desc: any): 1 | -1 | 0;
/**
 * compoundeval() - helper function for compoundsort(), performing individual object comparisons
 *
 * @param {array} properties - array of property names, in order, by which to evaluate sort order
 * @param {object} obj1 - first object to compare
 * @param {object} obj2 - second object to compare
 * @returns {integer} 0, -1, or 1 to designate if identical (sortwise) or which should be first
 */
export declare function compoundeval(properties: any, obj1: any, obj2: any): number;
