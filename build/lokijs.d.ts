import Loki from "./modules/Loki";
export declare var hasOwnProperty: (v: PropertyKey) => boolean;
export declare function precompileQuery(operator: any, value: any): any;
/**
 * General utils, including statistical functions
 */
export declare function isDeepProperty(field: any): boolean;
export declare function parseBase10(num: any): number;
export declare function add(a: any, b: any): any;
export declare function sub(a: any, b: any): number;
export declare function average(array: any): number;
export declare function standardDeviation(values: any): number;
export declare function deepProperty(obj: any, property: any, isDeep: any): any;
export declare function binarySearch(array: any, item: any, fun: any): {
    found: boolean;
    index: any;
};
export declare function BSonSort(fun: any): (array: any, item: any) => {
    found: boolean;
    index: any;
};
export default Loki;
