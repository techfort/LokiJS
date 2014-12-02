/*
 * LokiJS Key-Value Store
 * @author joe minichino <joe.minichino@gmail.com>
 */

(function () {

	// template to be bound
	function insertAt(element, index) {
		this.splice(index, 0, element);
	}


	function binarySearch(item, fun) {
		var lo = 0,
			hi = this.length,
			compared,
			mid;
		if (!fun) {
			fun = function (a, b) {
				return (a < b) ? -1 : ((a > b) ? 1 : 0);
			}
		}
		while (lo < hi) {
			mid = ((lo + hi) / 2) | 0;
			compared = fun(item, this[mid]);
			if (compared == 0) {
				return {
					found: true,
					index: mid
				};
			} else if (compared < 0) {
				hi = mid;
			} else {
				lo = mid + 1;
			}
		}
		return {
			found: false,
			index: hi
		};
	}

	// Base Array
	function BaseArray() {}
	BaseArray.prototype = new Array;

	BaseArray.prototype.insertAt = function () {
		insertAt.apply(this, Array.prototype.slice.call(arguments));
	};

	/**
	 * Keys Array
	 *
	 */
	function Keys() {}

	/**
	 * inherits BaseArray
	 */
	Keys.prototype = new BaseArray;

	/**
	 *
	 */
	Keys.prototype.binarySearch = function (searchElement, fun) {
		return binarySearch.call(this, searchElement, fun || false);
	};

	Keys.prototype.get = function (key, fun) {
		return this.binarySearch(key, fun || undefined);
	};

	/**
	 * Values: Values is an array with a method insertAt which enables insertion of new elements at their correct position
	 * @constructor
	 */
	function Values() {}
	Values.prototype = new BaseArray;

	/**
	 * Loki Key Value Store: a key value store that utilizes binary search instead of a plain js object utilized as a hashmap
	 * @constructor
	 */
	function LokiKVStore(options) {
		this.sorter = options ? (options.sorter || undefined) : undefined;
		this.keys = new Keys();
		this.values = new Values();
	}

	LokiKVStore.prototype.sortingFunction = function (func) {
		this.sorter = func.bind(this);
	};

	LokiKVStore.prototype.get = function (searchElement) {
		var res = this.keys.get(searchElement, this.sorter);
		if (res.found) {
			return this.values[res.index];
		} else {
			return null;
		}
	};

	LokiKVStore.prototype.set = function (key, value) {
		var pos = this.keys.get(key, this.sorter);
		if (pos.found === false) {
			this.keys.insertAt(key, pos.index);
			this.values.insertAt(value, pos.index);
		} else {
			this.values[pos.index] = value;
		}
	};
}).call(this);