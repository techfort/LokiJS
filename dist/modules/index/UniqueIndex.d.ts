export declare class UniqueIndex {
    field: any;
    keyMap: any;
    lokiMap: any;
    constructor(uniqueField: any);
    set(obj: any): void;
    get(key: any): any;
    byId(id: any): any;
    /**
     * Updates a document's unique index given an updated object.
     * @param  {Object} obj Original document object
     * @param  {Object} doc New document object (likely the same as obj)
     */
    update(obj: any, doc: any): void;
    remove(key: any): void;
    clear(): void;
}
