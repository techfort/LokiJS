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

  it('findAndUpdate works', function() {
    var db = new loki('test.db');
    var coll = db.addCollection('testcoll');
    coll.insert([{ a:3, b:3 }, { a:6, b:7 }, { a:1, b:2 }, { a:7, b:8 }, { a:6, b: 4}]);

    coll.findAndUpdate({a:6}, function(obj) {
      obj.b += 1;
    });

    var result = coll.chain().find({a:6}).simplesort("b").data();
    expect(result.length).toEqual(2);
    expect(result[0].b).toEqual(5);
    expect(result[1].b).toEqual(8);
  });

  it('findAndRemove works', function() {
    var db = new loki('test.db');
    var coll = db.addCollection('testcoll');
    coll.insert([{ a:3, b:3 }, { a:6, b:7 }, { a:1, b:2 }, { a:7, b:8 }, { a:6, b: 4}]);

    coll.findAndRemove({a:6});

    expect(coll.data.length).toEqual(3);

    var result = coll.chain().find().simplesort("b").data();
    expect(result.length).toEqual(3);
    expect(result[0].b).toEqual(2);
    expect(result[1].b).toEqual(3);
    expect(result[2].b).toEqual(8);
  });

  it('removeWhere works', function() {
    var db = new loki('test.db');
    var coll = db.addCollection('testcoll');
    coll.insert([{ a:3, b:3 }, { a:6, b:7 }, { a:1, b:2 }, { a:7, b:8 }, { a:6, b: 4}]);

    coll.removeWhere(function(obj) {
      return obj.a === 6;
    });

    expect(coll.data.length).toEqual(3);

    var result = coll.chain().find().simplesort("b").data();
    expect(result.length).toEqual(3);
    expect(result[0].b).toEqual(2);
    expect(result[1].b).toEqual(3);
    expect(result[2].b).toEqual(8);
  });

  it('updateWhere works', function() {
    var db = new loki('test.db');
    var coll = db.addCollection('testcoll');
    coll.insert([{ a:3, b:3 }, { a:6, b:7 }, { a:1, b:2 }, { a:7, b:8 }, { a:6, b: 4}]);

    // guess we need to return object for this to work
    coll.updateWhere(function(fobj) {return fobj.a===6}, function(obj) {
      obj.b += 1;
      return obj;
    });

    var result = coll.chain().find({a:6}).simplesort("b").data();
    expect(result.length).toEqual(2);
    expect(result[0].b).toEqual(5);
    expect(result[1].b).toEqual(8);
  });
});
