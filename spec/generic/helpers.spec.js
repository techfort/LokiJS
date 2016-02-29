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
    // *Complex: array, object, date

    expect(ops.$gt(false, false)).toEqual(false);

    expect(ops.$gte(false, false)).toEqual(true);

    expect(ops.$gt(true, false)).toEqual(true);

    expect(ops.$gt(true, true)).toEqual(false);

    expect(ops.$gte(true, true)).toEqual(true);

    expect(ops.$gt(null, null)).toEqual(false);

    //TODO: bug
    //expect(ops.$gte(null, null)).toEqual(true);

    expect(ops.$gt(undefined, undefined)).toEqual(false);

    //TODO: bug
    //expect(ops.$gte(undefined, undefined)).toEqual(true);

    expect(ops.$gt(-1, 0)).toEqual(false);

    //TODO: should be "false"? https://github.com/techfort/LokiJS/issues/363
    //expect(ops.$gt(0, 0)).toEqual(false);

    //TODO: bug
    expect(ops.$gte(0, 0)).toEqual(true);

    expect(ops.$gt(1, 0)).toEqual(true);

    expect(ops.$gt(new Date(2010), new Date(2015))).toEqual(false);

    //TODO: bug
    //expect(ops.$gt(new Date(2015), new Date(2015))).toEqual(false);

    expect(ops.$gte(new Date(2015), new Date(2015))).toEqual(true);
  });

});
