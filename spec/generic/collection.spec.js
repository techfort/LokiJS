if (typeof(window) === 'undefined') var loki = require('../../src/lokijs.js');

describe('collection', function () {
  it('works', function () {
    function SubclassedCollection() {
      loki.Collection.apply(this, Array.prototype.slice.call(arguments));
    }
    SubclassedCollection.prototype = new loki.Collection;
    SubclassedCollection.prototype.extendedMethod = function () {
      return this.name.toUpperCase();
    }
    var coll = new SubclassedCollection('users', {});

    expect(coll != null).toBe(true);
    expect('users'.toUpperCase()).toEqual(coll.extendedMethod());
    coll.insert({
      name: 'joe'
    });
    expect(coll.data.length).toEqual(1);
  });
});
