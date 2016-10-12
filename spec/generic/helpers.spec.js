if (typeof(window) === 'undefined') var loki = require('../../src/lokijs.js');

describe('Testing comparator helpers', function () {

  var ops;
  beforeEach(function() {
    ops = loki.LokiOps;
  });

  it('$eq works as expected', function () {
    expect(ops.$eq(true, true)).toEqual(true);

    expect(ops.$eq(true, false)).toEqual(false);
  });

  it('$aeq works as expected', function() {
    expect(ops.$aeq(4, '4')).toEqual(true);
    expect(ops.$aeq(4, 4)).toEqual(true);
    expect(ops.$aeq(3, 2)).toEqual(false);
    expect(ops.$aeq(3, 'three')).toEqual(false);
    expect(ops.$aeq('3', 3)).toEqual(true);
    expect(ops.$aeq('1.23', 1.23)).toEqual(true);
  });

  it('$ne works as expected', function () {
    expect(ops.$ne(true, true)).toEqual(false);

    expect(ops.$ne(true, false)).toEqual(true);
  });

  it('$in works as expected', function () {
    expect(ops.$in(4, [1, 3, 4])).toEqual(true);

    expect(ops.$in(8, [1, 3, 4])).toEqual(false);
  });

  it('$nin works as expected', function () {
    expect(ops.$nin(4, [1, 3, 4])).toEqual(false);

    expect(ops.$nin(8, [1, 3, 4])).toEqual(true);
  });

  it('$gt works as expected', function () {
    //Testing strategy:
    // First, only the same type data will be compared,
    // both with and without the third optional arg.
    // This includes all primitives*.
    //
    // Then complex* values will be compared.
    //
    // Finally, some tests will be ran trying to compare
    // values of different types.
    //
    // *Primitives: boolean, null, undefined, number, string
    // *Complex: date

    expect(ops.$gt(false, false)).toEqual(false);

    expect(ops.$gte(false, false)).toEqual(true);

    expect(ops.$gt(true, false)).toEqual(true);

    expect(ops.$gt(true, true)).toEqual(false);

    expect(ops.$gte(true, true)).toEqual(true);

    expect(ops.$gt(null, null)).toEqual(false);

    expect(ops.$gte(null, null)).toEqual(true);

    expect(ops.$gt(undefined, undefined)).toEqual(false);

    expect(ops.$gte(undefined, undefined)).toEqual(true);

    expect(ops.$gt(-1, 0)).toEqual(false);

    expect(ops.$gt(0, 0)).toEqual(false);

    expect(ops.$gte(0, 0)).toEqual(true);

    expect(ops.$gt(1, 0)).toEqual(true);

    expect(ops.$gt(new Date(2010), new Date(2015))).toEqual(false);

    expect(ops.$gt(new Date(2015), new Date(2015))).toEqual(false);

    expect(ops.$gte(new Date(2015), new Date(2015))).toEqual(true);

    // mixed type checking (or mixed falsy edge tests)
    expect(ops.$gt("14", 12)).toEqual(true);

    expect(ops.$gt(12, "14")).toEqual(false);

    expect(ops.$gt("10", 12)).toEqual(false);

    expect(ops.$gt(12, "10")).toEqual(true);

    expect(ops.$gt("test", 12)).toEqual(true);

    expect(ops.$gt(12, "test")).toEqual(false);

    expect(ops.$gt(12, 0)).toEqual(true);

    expect(ops.$gt(0, 12)).toEqual(false);

    expect(ops.$gt(12, "")).toEqual(true);

    expect(ops.$gt("", 12)).toEqual(false);
  });

  it('$lt works as expected', function () {
    //Testing strategy:
    // First, only the same type data will be compared,
    // both with and without the third optional arg.
    // This includes all primitives*.
    //
    // Then complex* values will be compared.
    //
    // Finally, some tests will be ran trying to compare
    // values of different types.
    //
    // *Primitives: boolean, null, undefined, number, string
    // *Complex: date

    expect(ops.$lt(false, false)).toEqual(false);

    expect(ops.$lte(false, false)).toEqual(true);

    expect(ops.$lt(true, false)).toEqual(false);

    expect(ops.$lt(true, true)).toEqual(false);

    expect(ops.$lte(true, true)).toEqual(true);

    expect(ops.$lt(null, null)).toEqual(false);

    expect(ops.$lte(null, null)).toEqual(true);

    expect(ops.$lt(undefined, undefined)).toEqual(false);

    expect(ops.$lte(undefined, undefined)).toEqual(true);

    expect(ops.$lt(-1, 0)).toEqual(true);

    expect(ops.$lt(0, 0)).toEqual(false);

    expect(ops.$lte(0, 0)).toEqual(true);

    expect(ops.$lt(1, 0)).toEqual(false);

    expect(ops.$lt(new Date(2010), new Date(2015))).toEqual(true);

    expect(ops.$lt(new Date(2015), new Date(2015))).toEqual(false);

    expect(ops.$lte(new Date(2015), new Date(2015))).toEqual(true);

    // mixed type checking (or mixed falsy edge tests)
    expect(ops.$lt("12", 14)).toEqual(true);

    expect(ops.$lt(14, "12")).toEqual(false);

    expect(ops.$lt("10", 12)).toEqual(true);

    expect(ops.$lt(12, "10")).toEqual(false);

    expect(ops.$lt("test", 12)).toEqual(false);

    expect(ops.$lt(12, "test")).toEqual(true);

    expect(ops.$lt(12, 0)).toEqual(false);

    expect(ops.$lt(0, 12)).toEqual(true);

    expect(ops.$lt(12, "")).toEqual(false);

    expect(ops.$lt("", 12)).toEqual(true);
  });

});
