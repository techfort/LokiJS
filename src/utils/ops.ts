/* eslint-disable no-prototype-builtins */
/* eslint-disable no-var */

import { containsCheckFn } from "./containsCheckFn";
import { dotSubScan } from "./dotSubScan";
import { Comparators } from "./sort";

export function doQueryOp(val, op, record) {
  for (var p in op) {
    if (Object.hasOwn(op, p)) {
      return LokiOps[p](val, op[p], record);
    }
  }
  return false;
}

export var LokiOps = {
  // comparison operators
  // a is the value in the collection
  // b is the query value
  $eq: function (a, b) {
    return a === b;
  },

  // abstract/loose equality
  $aeq: function (a, b) {
    return a == b;
  },

  $ne: function (a, b) {
    // ecma 5 safe test for NaN
    if (b !== b) {
      // ecma 5 test value is not NaN
      return a === a;
    }

    return a !== b;
  },
  // date equality / loki abstract equality test
  $dteq: function (a, b) {
    return Comparators.aeq(a, b);
  },

  // loki comparisons: return identical unindexed results as indexed comparisons
  $gt: function (a, b) {
    return Comparators.gt(a, b, false);
  },

  $gte: function (a, b) {
    return Comparators.gt(a, b, true);
  },

  $lt: function (a, b) {
    return Comparators.lt(a, b, false);
  },

  $lte: function (a, b) {
    return Comparators.lt(a, b, true);
  },

  // lightweight javascript comparisons
  $jgt: function (a, b) {
    return a > b;
  },

  $jgte: function (a, b) {
    return a >= b;
  },

  $jlt: function (a, b) {
    return a < b;
  },

  $jlte: function (a, b) {
    return a <= b;
  },

  // ex : coll.find({'orderCount': {$between: [10, 50]}});
  $between: function (a, vals) {
    if (a === undefined || a === null) return false;
    return Comparators.gt(a, vals[0], true) && Comparators.lt(a, vals[1], true);
  },

  $jbetween: function (a, vals) {
    if (a === undefined || a === null) return false;
    return a >= vals[0] && a <= vals[1];
  },

  $in: function (a, b) {
    return b.indexOf(a) !== -1;
  },

  $inSet: function (a, b) {
    return b.has(a);
  },

  $nin: function (a, b) {
    return b.indexOf(a) === -1;
  },

  $keyin: function (a, b) {
    return a in b;
  },

  $nkeyin: function (a, b) {
    return !(a in b);
  },

  $definedin: function (a, b) {
    return b[a] !== undefined;
  },

  $undefinedin: function (a, b) {
    return b[a] === undefined;
  },

  $regex: function (a, b) {
    return b.test(a);
  },

  $containsString: function (a, b) {
    return typeof a === "string" && a.indexOf(b) !== -1;
  },

  $containsNone: function (a, b) {
    return !LokiOps.$containsAny(a, b);
  },

  $containsAny: function (a, b) {
    var checkFn = containsCheckFn(a);
    if (checkFn !== null) {
      return Array.isArray(b) ? b.some(checkFn) : checkFn(b);
    }
    return false;
  },

  $contains: function (a, b) {
    var checkFn = containsCheckFn(a);
    if (checkFn !== null) {
      return Array.isArray(b) ? b.every(checkFn) : checkFn(b);
    }
    return false;
  },

  $elemMatch: function (a, b) {
    if (Array.isArray(a)) {
      return a.some(function (item) {
        return Object.keys(b).every(function (property) {
          var filter = b[property];
          if (!(typeof filter === "object" && filter)) {
            filter = { $eq: filter };
          }

          if (property.indexOf(".") !== -1) {
            return dotSubScan(
              item,
              property.split("."),
              doQueryOp,
              b[property],
              item
            );
          }
          return doQueryOp(item[property], filter, item);
        });
      });
    }
    return false;
  },

  $type: function (a, b, record) {
    var type: typeof a | "array" | "date" = typeof a;
    if (type === "object") {
      if (Array.isArray(a)) {
        type = "array";
      } else if (a instanceof Date) {
        type = "date";
      }
    }
    return typeof b !== "object" ? type === b : doQueryOp(type, b, record);
  },

  $finite: function (a, b) {
    return b === isFinite(a);
  },

  $size: function (a, b, record) {
    if (Array.isArray(a)) {
      return typeof b !== "object"
        ? a.length === b
        : doQueryOp(a.length, b, record);
    }
    return false;
  },

  $len: function (a, b, record) {
    if (typeof a === "string") {
      return typeof b !== "object"
        ? a.length === b
        : doQueryOp(a.length, b, record);
    }
    return false;
  },

  $where: function (a, b) {
    return b(a) === true;
  },

  // field-level logical operators
  // a is the value in the collection
  // b is the nested query operation (for '$not')
  //   or an array of nested query operations (for '$and' and '$or')
  $not: function (a, b, record) {
    return !doQueryOp(a, b, record);
  },

  $and: function (a, b, record) {
    for (var idx = 0, len = b.length; idx < len; idx += 1) {
      if (!doQueryOp(a, b[idx], record)) {
        return false;
      }
    }
    return true;
  },

  $or: function (a, b, record) {
    for (var idx = 0, len = b.length; idx < len; idx += 1) {
      if (doQueryOp(a, b[idx], record)) {
        return true;
      }
    }
    return false;
  },

  $exists: function (a, b) {
    if (b) {
      return a !== undefined;
    } else {
      return a === undefined;
    }
  },
};

// ops that can be used with { $$op: 'column-name' } syntax
export var valueLevelOps = [
  "$eq",
  "$aeq",
  "$ne",
  "$dteq",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$jgt",
  "$jgte",
  "$jlt",
  "$jlte",
  "$type",
];
valueLevelOps.forEach(function (op) {
  var fun = LokiOps[op];
  LokiOps["$" + op] = function (a, spec, record) {
    if (typeof spec === "string") {
      return fun(a, record[spec]);
    } else if (typeof spec === "function") {
      return fun(a, spec(record));
    } else {
      throw new Error("Invalid argument to $$ matcher");
    }
  };
});

// if an op is registered in this object, our 'calculateRange' can use it with our binary indices.
// if the op is registered to a function, we will run that function/op as a 2nd pass filter on results.
// those 2nd pass filter functions should be similar to LokiOps functions, accepting 2 vals to compare.
export var indexedOps = {
  $eq: LokiOps.$eq,
  $aeq: true,
  $dteq: true,
  $gt: true,
  $gte: true,
  $lt: true,
  $lte: true,
  $in: true,
  $between: true,
};
