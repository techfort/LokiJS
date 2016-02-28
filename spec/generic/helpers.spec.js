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

});
