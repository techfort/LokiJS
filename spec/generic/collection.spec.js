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

  // coll.mode(property) should return single value of property which occurs most in collection
  // if more than one value 'ties' it will just pick one
  it('mode works', function() {
    var db = new loki('test.db');
    var coll = db.addCollection('testcoll');
    coll.insert([{ a:3, b:3 }, { a:6, b:7 }, { a:1, b:2 }, { a:7, b:8 }, { a:6, b: 4}]);

    // seems mode returns string so loose equality
    var result = coll.mode('a') == 6;

    expect(result).toEqual(true);
  });

  it('single inserts emit with meta when async listeners false', function() {
    var db = new loki('test.db');
    var coll = db.addCollection('testcoll');
    
    // listen for insert events to validate objects
    coll.on("insert", function(obj) {
      expect(obj.hasOwnProperty('a')).toEqual(true);
      expect([3,6,1,7,5].indexOf(obj.a)).toBeGreaterThan(-1);

      switch(obj.a) {
        case 3: expect(obj.b).toEqual(3); break;
        case 6: expect(obj.b).toEqual(7); break;
        case 1: expect(obj.b).toEqual(2); break;
        case 7: expect(obj.b).toEqual(8); break;
        case 5: expect(obj.b).toEqual(4); break;
      };
      
      expect(obj.hasOwnProperty('$loki')).toEqual(true);
      expect(obj.hasOwnProperty('$loki_meta')).toEqual(true);
      expect(obj.$loki_meta.hasOwnProperty('revision')).toEqual(true);
      expect(obj.$loki_meta.hasOwnProperty('created')).toEqual(true);
      expect(obj.$loki_meta.hasOwnProperty('version')).toEqual(true);
      expect(obj.$loki_meta.revision).toEqual(0);
      expect(obj.$loki_meta.version).toEqual(0);
      expect(obj.$loki_meta.created).toBeGreaterThan(0);
    });

    coll.insert({ a:3, b:3 });
    coll.insert({ a:6, b:7 });
    coll.insert({ a:1, b:2 });
    coll.insert({ a:7, b:8 });
    coll.insert({ a:5, b:4 });
  });
  
  it('single inserts (with clone) emit meta and return instances correctly', function() {
    var db = new loki('test.db');
    var coll = db.addCollection('testcoll', { clone:true });
    
    // listen for insert events to validate objects
    coll.on("insert", function(obj) {
      expect(obj.hasOwnProperty('a')).toEqual(true);
      expect([3,6,1,7,5].indexOf(obj.a)).toBeGreaterThan(-1);

      switch(obj.a) {
        case 3: expect(obj.b).toEqual(3); break;
        case 6: expect(obj.b).toEqual(7); break;
        case 1: expect(obj.b).toEqual(2); break;
        case 7: expect(obj.b).toEqual(8); break;
        case 5: expect(obj.b).toEqual(4); break;
      };
      
      expect(obj.hasOwnProperty('$loki')).toEqual(true);
      expect(obj.hasOwnProperty('$loki_meta')).toEqual(true);
      expect(obj.$loki_meta.hasOwnProperty('revision')).toEqual(true);
      expect(obj.$loki_meta.hasOwnProperty('created')).toEqual(true);
      expect(obj.$loki_meta.hasOwnProperty('version')).toEqual(true);
      expect(obj.$loki_meta.revision).toEqual(0);
      expect(obj.$loki_meta.version).toEqual(0);
      expect(obj.$loki_meta.created).toBeGreaterThan(0);
    });

    var i1 = coll.insert({ a:3, b:3 });
    coll.insert({ a:6, b:7 });
    coll.insert({ a:1, b:2 });
    coll.insert({ a:7, b:8 });
    coll.insert({ a:5, b:4 });

    // verify that the objects returned from an insert are clones by tampering with values
    i1.b = 9;
    var result = coll.findOne({a:3});
    expect(result.b).toEqual(3);
  });

  it('batch inserts emit with meta', function() {
    var db = new loki('test.db');
    var coll = db.addCollection('testcoll');

    // listen for insert events to validate objects
    coll.on("insert", function(objs) {
      expect(Array.isArray(objs)).toEqual(true);
      expect(objs.length).toEqual(5);

      expect(objs[0].b).toEqual(3);
      expect(objs[1].b).toEqual(7);
      expect(objs[2].b).toEqual(2);
      expect(objs[3].b).toEqual(8);
      expect(objs[4].b).toEqual(4);

      expect(objs[0].hasOwnProperty('$loki')).toEqual(true);
      expect(objs[1].hasOwnProperty('$loki')).toEqual(true);
      expect(objs[2].hasOwnProperty('$loki')).toEqual(true);
      expect(objs[3].hasOwnProperty('$loki')).toEqual(true);
      expect(objs[4].hasOwnProperty('$loki')).toEqual(true);

      expect(objs[0].hasOwnProperty('$loki_meta')).toEqual(true);
      expect(objs[1].hasOwnProperty('$loki_meta')).toEqual(true);
      expect(objs[2].hasOwnProperty('$loki_meta')).toEqual(true);
      expect(objs[3].hasOwnProperty('$loki_meta')).toEqual(true);
      expect(objs[4].hasOwnProperty('$loki_meta')).toEqual(true);

      expect(objs[0].$loki_meta.hasOwnProperty('revision')).toEqual(true);
      expect(objs[0].$loki_meta.hasOwnProperty('created')).toEqual(true);
      expect(objs[0].$loki_meta.hasOwnProperty('version')).toEqual(true);
      expect(objs[0].$loki_meta.revision).toEqual(0);
      expect(objs[0].$loki_meta.version).toEqual(0);
      expect(objs[0].$loki_meta.created).toBeGreaterThan(0);
    });

    coll.insert([{ a:3, b:3 },{ a:6, b:7 },{ a:1, b:2 },{ a:7, b:8 },{ a:5, b:4 }]);
  });

  it('batch inserts emit with meta and return clones', function() {
    var db = new loki('test.db');
    var coll = db.addCollection('testcoll', { clone:true });

    // listen for insert events to validate objects
    coll.on("insert", function(objs) {
      expect(Array.isArray(objs)).toEqual(true);
      expect(objs.length).toEqual(5);

      expect(objs[0].b).toEqual(3);
      expect(objs[1].b).toEqual(7);
      expect(objs[2].b).toEqual(2);
      expect(objs[3].b).toEqual(8);
      expect(objs[4].b).toEqual(4);

      expect(objs[0].hasOwnProperty('$loki')).toEqual(true);
      expect(objs[1].hasOwnProperty('$loki')).toEqual(true);
      expect(objs[2].hasOwnProperty('$loki')).toEqual(true);
      expect(objs[3].hasOwnProperty('$loki')).toEqual(true);
      expect(objs[4].hasOwnProperty('$loki')).toEqual(true);

      expect(objs[0].hasOwnProperty('$loki_meta')).toEqual(true);
      expect(objs[1].hasOwnProperty('$loki_meta')).toEqual(true);
      expect(objs[2].hasOwnProperty('$loki_meta')).toEqual(true);
      expect(objs[3].hasOwnProperty('$loki_meta')).toEqual(true);
      expect(objs[4].hasOwnProperty('$loki_meta')).toEqual(true);

      expect(objs[0].$loki_meta.hasOwnProperty('revision')).toEqual(true);
      expect(objs[0].$loki_meta.hasOwnProperty('created')).toEqual(true);
      expect(objs[0].$loki_meta.hasOwnProperty('version')).toEqual(true);
      expect(objs[0].$loki_meta.revision).toEqual(0);
      expect(objs[0].$loki_meta.version).toEqual(0);
      expect(objs[0].$loki_meta.created).toBeGreaterThan(0);
    });

    var obj1 = { a:3, b: 3};
    var result = coll.insert([obj1,{ a:6, b:7 },{ a:1, b:2 },{ a:7, b:8 },{ a:5, b:4 }]);
    
    expect(Array.isArray(result)).toEqual(true);

    // tamper original (after insert)
    obj1.b = 99;
    // returned values should have been clones of original
    expect(result[0].b).toEqual(3);

    // internal data references should have benn clones of original
    var obj = coll.findOne({a:3});
    expect(obj.b).toEqual(3);
  });

});
