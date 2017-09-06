if (typeof (window) === 'undefined') {
  var loki = require('../../src/lokijs.js');
  var suite = require('../helpers/assert-helpers.js').suite;
}

describe('loki', function () {
  var db,
    users,
    jonas;

  function docCompare(a, b) {
    if (a.$loki < b.$loki) return -1;
    if (a.$loki > b.$loki) return 1;

    return 0;
  }

  beforeEach(function () {
    db = new loki('test.json');
    users = db.addCollection('user');

    users.insert({
      name: 'dave',
      age: 25,
      lang: 'English'
    });

    users.insert({
      name: 'joe',
      age: 39,
      lang: 'Italian'
    });

    jonas = users.insert({
      name: 'jonas',
      age: 30,
      lang: 'Swedish'
    });
  })


  describe('core methods', function () {
    it('works', function () {
      var tdb = new loki('regextests');
      var tcu = tdb.addCollection('user');
      tcu.insert({
        name: 'abcd',
        age: 25,
        lang: 'English'
      });

      tcu.insert({
        name: 'AbCd',
        age: 39,
        lang: 'Italian'
      });

      tcu.insert({
        name: 'acdb',
        age: 30,
        lang: 'Swedish'
      });

      tcu.insert({
        name: 'aBcD',
        age: 30,
        lang: 'Swedish'
      });


      // findOne()
      var j = users.findOne({
        'name': 'jonas'
      });
      expect(j.name).toEqual('jonas');

      // find()
      var result = users.find({
        'age': {
          '$gt': 29
        }
      });
      expect(result.length).toEqual(2);

      // $regex test with raw regex
      expect(users.find({
        'name': {
          '$regex': /o/
        }
      }).length).toEqual(2);

      // case insensitive regex with array of ["pattern", "options"]
      expect(tcu.find({
        'name': {
          '$regex': ["abcd", "i"]
        }
      }).length).toEqual(3);

      // regex with single encoded string pattern (no options)
      expect(tcu.find({
        'name': {
          '$regex': "cd"
        }
      }).length).toEqual(2);

      // $contains
      expect(users.find({
        'name': {
          '$contains': "jo"
        }
      }).length).toEqual(2);

      // $contains using array element
      expect(users.find({
        'name': {
          '$contains': ["jo"]
        }
      }).length).toEqual(2);



      // $contains any with one value
      expect(users.find({
        'name': {
          '$containsAny': 'nas'
        }
      }).length).toEqual(1);

      // $contains any with multiple values
      expect(users.find({
        'name': {
          '$containsAny': ['nas', 'dave']
        }
      }).length).toEqual(2);


      // insert() : try inserting existing document (should fail), try adding doc with legacy id column
      var collectionLength = users.data.length;
      var objDave = users.findOne({
        'name': 'dave'
      });
      var wasAdded = true;
      try {
        users.insert(objDave);
      } catch (err) {
        wasAdded = false;
      }
      expect(wasAdded).toEqual(false);

      // our collections are not strongly typed so lets invent some object that has its 'own' id column
      var legacyObject = {
        id: 999,
        first: 'aaa',
        last: 'bbb',
        city: 'pasadena',
        state: 'ca'
      }

      wasAdded = true;

      try {
        users.insert(legacyObject);
      } catch (err) {
        wasAdded = false;
      }

      expect(wasAdded).toEqual(true);

      // remove object so later queries access valid properties on all objects
      if (wasAdded) {
        users.remove(legacyObject); // the object itself should have been modified
      }

      // update()
      legacyObject = {
        id: 998,
        first: 'aaa',
        last: 'bbb',
        city: 'pasadena',
        state: 'ca'
      }
      var wasUpdated = true;

      try {
        users.update(legacyObject);
      } catch (err) {
        wasUpdated = false;
      }
      expect(wasUpdated).toEqual(false);

      // remove() - add some bogus object to remove
      var userCount1 = users.data.length;

      testObject = {
        first: 'aaa',
        last: 'bbb',
        city: 'pasadena',
        state: 'ca'
      }

      users.insert(testObject);

      expect(userCount1 + 1).toEqual(users.data.length);
      users.remove(testObject);
      expect(userCount1).toEqual(users.data.length);
    })
  });

  describe('meta validation', function() {
    it('meta set on returned objects', function() {
      var tdb = new loki('test.db');
      var coll = tdb.addCollection('tc');
      var now = (new Date()).getTime();

      // verify single insert return objs have meta set properly
      var obj = coll.insert({a:1, b:2});
      expect(obj.hasOwnProperty('$loki_meta')).toEqual(true);
      expect(obj.hasOwnProperty('$loki')).toEqual(true);
      expect(obj.$loki_meta.hasOwnProperty('revision')).toEqual(true);
      expect(obj.$loki_meta.hasOwnProperty('version')).toEqual(true);
      expect(obj.$loki_meta.hasOwnProperty('created')).toEqual(true);
      expect(obj.$loki_meta.created).not.toBeLessThan(now);

      // verify batch insert return objs have meta set properly
      var objs = coll.insert([ { a:2, b:3}, { a:3, b:4}]);
      expect(Array.isArray(objs));
      objs.forEach(function(o) {
        expect(o.hasOwnProperty('$loki_meta')).toEqual(true);
        expect(o.hasOwnProperty('$loki')).toEqual(true);
        expect(o.$loki_meta.hasOwnProperty('revision')).toEqual(true);
        expect(o.$loki_meta.hasOwnProperty('version')).toEqual(true);
        expect(o.$loki_meta.hasOwnProperty('created')).toEqual(true);
        expect(o.$loki_meta.created).not.toBeLessThan(now);
      });
    });

    it('meta set on events', function(done) {
      var tdb = new loki('test.db');
      var coll = tdb.addCollection('tc');
      var now = (new Date()).getTime();

      coll.on('insert', function(o) {
        if (Array.isArray(o)) {
          o.forEach(function(obj) {
            expect(obj.hasOwnProperty('$loki_meta')).toEqual(true);
            expect(obj.hasOwnProperty('$loki')).toEqual(true);
            expect(obj.$loki_meta.hasOwnProperty('revision')).toEqual(true);
            expect(obj.$loki_meta.hasOwnProperty('version')).toEqual(true);
            expect(obj.$loki_meta.hasOwnProperty('created')).toEqual(true);
            expect(obj.$loki_meta.created).not.toBeLessThan(now);
          });
          done();
        }
        else {
          expect(o.hasOwnProperty('$loki_meta')).toEqual(true);
          expect(o.hasOwnProperty('$loki')).toEqual(true);
          expect(o.$loki_meta.hasOwnProperty('revision')).toEqual(true);
          expect(o.$loki_meta.hasOwnProperty('version')).toEqual(true);
          expect(o.$loki_meta.hasOwnProperty('created')).toEqual(true);
          expect(o.$loki_meta.created).not.toBeLessThan(now);
        }
      });

      // verify single inserts emit with obj which has meta set properly
      coll.insert({a:1, b:2});

      // verify batch inserts emit with objs which have meta set properly
      coll.insert([ { a:2, b:3}, { a:3, b:4}]);
    });
  });

  describe('dot notation', function () {
    it('works', function () {
      var dnc = db.addCollection('dncoll');

      dnc.insert({
        first: 'aaa',
        last: 'bbb',
        addr: {
          street: '111 anystreet',
          state: 'AS',
          zip: 12345
        }
      });

      dnc.insert({
        first: 'ddd',
        last: 'eee',
        addr: {
          street: '222 anystreet',
          state: 'FF',
          zip: 32345
        }
      });

      // make sure it can handle case where top level property doesn't exist
      dnc.insert({
        first: 'mmm',
        last: 'nnn'
      });

      // make sure it can handle case where subscan property doesn't exist
      dnc.insert({
        first: 'ooo',
        last: 'ppp',
        addr: {
          state: 'YY'
        }
      });

      dnc.insert({
        first: 'jjj',
        last: 'kkk',
        addr: {
          street: '777 anystreet',
          state: 'WW',
          zip: 12345
        }
      });

      // test dot notation using regular find (with multiple results)
      var firstResult = dnc.find({
        "addr.zip": 12345
      });
      expect(firstResult.length).toEqual(2);
      expect(firstResult[0].addr.zip).toEqual(12345);
      expect(firstResult[1].addr.zip).toEqual(12345);

      // test not notation using findOne
      var secObj = dnc.findOne({
        "addr.state": 'FF'
      });

      expect(secObj !== null).toBeTruthy();
      expect(secObj.addr.zip).toEqual(32345);

    });

  });

  // We only support dot notation involving array when
  // the leaf property is the array.  This verifies that functionality
  describe('dot notation across leaf object array', function() {
    it('works', function () {
      var dna = db.addCollection('dnacoll');

      dna.insert({
        id: 1,
        children: [{
          someProperty: 11
        }]
      });

      dna.insert({
        id: 2,
        children: [{
          someProperty: 22
        }]
      });

      dna.insert({
        id: 3,
        children: [{
          someProperty: 33
        }, {
          someProperty: 22
        }]
      });

      dna.insert({
        id: 4,
        children: [{
          someProperty: 11
        }]
      });

      dna.insert({
        id: 5,
        children: [{
          missing: null
        }]
      });

      dna.insert({
        id: 6,
        children: [{
          someProperty: null
        }]
      });

      var results = dna.find({'children.someProperty': 33 });
      expect(results.length).toEqual(1);

      results = dna.find({'children.someProperty': 11 });
      expect(results.length).toEqual(2);

      results = dna.find({'children.someProperty': 22});
      expect(results.length).toEqual(2);
    });
  });


  describe('dot notation terminating at leaf array', function() {
    it('works', function() {
      var dna = db.addCollection('dnacoll');

      dna.insert({
        "relations" : {
          "ids": [379]
        }
      });

      dna.insert({
        "relations" : {
          "ids": [12, 379]
        }
      });
      
      dna.insert({
        "relations" : {
          "ids": [111]
        }
      });
      
      var results = dna.find({
        'relations.ids' : { $contains: 379 }
      });

      expect(results.length).toEqual(2);
    });
  });

  describe('dot notation across child array', function() {
    it('works', function () {
      var dna = db.addCollection('dnacoll');

      dna.insert({
        id: 1,
        children: [{
          id: 11,
          someArray: [{
            someProperty: 111
          }]
        }]
      });

      dna.insert({
        id: 2,
        children: [{
          id: 22,
          someArray: [{
            someProperty: 222
          }]
        }]
      });

      dna.insert({
        id: 3,
        children: [{
          id: 33,
          someArray: [{
            someProperty: 333
          }, {
            someProperty: 222
          }]
        }]
      });

      dna.insert({
        id: 4,
        children: [{
          id: 44,
          someArray: [{
            someProperty: 111
          }]
        }]
      });

      dna.insert({
        id: 5,
        children: [{
          id: 55,
          someArray: [{
            missing: null
          }]
        }]
      });

      dna.insert({
        id: 6,
        children: [{
          id: 66,
          someArray: [{
            someProperty: null
          }]
        }]
      });

      var results = dna.find({'children.someArray.someProperty': 333});
      expect(results.length).toEqual(1);

      results = dna.find({'children.someArray.someProperty': 111});
      expect(results.length).toEqual(2);

      results = dna.find({'children.someArray.someProperty': 222});
      expect(results.length).toEqual(2);

      results = dna.find({'$and': [{'id': 3}, {'children.someArray.someProperty': 222}]});
      expect(results.length).toEqual(1);

      results = dna.find({'$and': [{'id': 1}, {'children.someArray.someProperty': 222}]});
      expect(results.length).toEqual(0);

      results = dna.find({'$or': [{'id': 1}, {'children.someArray.someProperty': 222}]});
      expect(results.length).toEqual(3);
    });
  });

  describe('calculateRange', function () {
    it('works', function () {
      var eic = db.addCollection('eic');
      eic.ensureIndex('testid');

      eic.insert({
        'testid': 1,
        'testString': 'hhh',
        'testFloat': 5.2
      }); //0
      eic.insert({
        'testid': 1,
        'testString': 'aaa',
        'testFloat': 6.2
      }); //1
      eic.insert({
        'testid': 5,
        'testString': 'zzz',
        'testFloat': 7.2
      }); //2
      eic.insert({
        'testid': 6,
        'testString': 'ggg',
        'testFloat': 1.2
      }); //3
      eic.insert({
        'testid': 9,
        'testString': 'www',
        'testFloat': 8.2
      }); //4
      eic.insert({
        'testid': 11,
        'testString': 'yyy',
        'testFloat': 4.2
      }); //5
      eic.insert({
        'testid': 22,
        'testString': 'yyz',
        'testFloat': 9.2
      }); //6
      eic.insert({
        'testid': 23,
        'testString': 'm',
        'testFloat': 2.2
      }); //7

      var rset = eic.chain();
      rset.find({
        'testid': 1
      }); // force index to be built

      // ranges are order of sequence in index not data array positions

      var range = eic.calculateRange('$eq', 'testid', 22);
      expect(range).toEqual([6, 6]);

      range = eic.calculateRange('$eq', 'testid', 1);
      expect(range).toEqual([0, 1]);

      range = eic.calculateRange('$eq', 'testid', 7);
      expect(range).toEqual([0, -1]);

      range = eic.calculateRange('$gte', 'testid', 23);
      expect(range).toEqual([7, 7]);

      // reference this new record for future evaluations
      eic.insert({
        'testid': 23,
        'testString': 'bbb',
        'testFloat': 1.9
      });

      // test when all records are in range
      range = eic.calculateRange('$lt', 'testid', 25);
      expect(range).toEqual([0, 8]);
      range = eic.calculateRange('$lte', 'testid', 25);
      expect(range).toEqual([0, 8]);
      range = eic.calculateRange('$gt', 'testid', 0);
      expect(range).toEqual([0, 8]);
      range = eic.calculateRange('$gte', 'testid', 0);
      expect(range).toEqual([0, 8]);

      range = eic.calculateRange('$gte', 'testid', 23);
      expect(range).toEqual([7, 8]);

      range = eic.calculateRange('$gte', 'testid', 24);
      expect(range).toEqual([0, -1]);

      range = eic.calculateRange('$lte', 'testid', 5);
      expect(range).toEqual([0, 2]);

      range = eic.calculateRange('$lte', 'testid', 1);
      expect(range).toEqual([0, 1]);

      range = eic.calculateRange('$lte', 'testid', -1);
      expect(range).toEqual([0, -1]);

      // add another index on string property
      eic.ensureIndex('testString');
      rset.find({
        'testString': 'asdf'
      }); // force index to be built

      range = eic.calculateRange('$lte', 'testString', 'ggg');
      expect(range).toEqual([0, 2]); // includes record added in middle

      range = eic.calculateRange('$gte', 'testString', 'm');
      expect(range).toEqual([4, 8]); // offset by 1 because of record in middle

      // add some float range evaluations
      eic.ensureIndex('testFloat');
      rset.find({
        'testFloat': '1.1'
      }); // force index to be built

      range = eic.calculateRange('$lte', 'testFloat', 1.2);
      expect(range).toEqual([0, 0]);

      range = eic.calculateRange('$eq', 'testFloat', 1.111);
      expect(range).toEqual([0, -1]);

      range = eic.calculateRange('$eq', 'testFloat', 8.2);
      expect(range).toEqual([7, 7]); // 8th pos

      range = eic.calculateRange('$gte', 'testFloat', 1.0);
      expect(range).toEqual([0, 8]); // 8th pos
    })
  });

  describe('lazy indexLifecycle', function () {
    it('works', function () {
      var ilc = db.addCollection('ilc', {
        adaptiveBinaryIndices: false
      });

      var hasIdx = ilc.binaryIndices.hasOwnProperty('testid');
      expect(hasIdx).toEqual(false);

      ilc.ensureIndex('testid');
      hasIdx = ilc.binaryIndices.hasOwnProperty('testid');
      expect(hasIdx).toEqual(true);
      expect(ilc.binaryIndices.testid.dirty).toEqual(false);
      expect(ilc.binaryIndices.testid.values).toEqual([]);

      ilc.insert({
        'testid': 5
      });
      expect(ilc.binaryIndices.testid.dirty).toEqual(true);
      ilc.insert({
        'testid': 8
      });
      expect(ilc.binaryIndices.testid.values).toEqual([]);
      expect(ilc.binaryIndices.testid.dirty).toEqual(true);

      ilc.find({
        'testid': 8
      }); // should force index build
      expect(ilc.binaryIndices.testid.dirty).toEqual(false);
      expect(ilc.binaryIndices.testid.values.length).toEqual(2);
    })
  })

  describe('indexes', function () {
    it('works', function () {
      var itc = db.addCollection('test', {
        indices: ['testid']
      });

      itc.insert({
        'testid': 1
      });
      itc.insert({
        'testid': 2
      });
      itc.insert({
        'testid': 5
      });
      itc.insert({
        'testid': 5
      });
      itc.insert({
        'testid': 9
      });
      itc.insert({
        'testid': 11
      });
      itc.insert({
        'testid': 22
      });
      itc.insert({
        'testid': 22
      });

      // lte
      var results = itc.find({
        'testid': {
          '$lte': 1
        }
      });
      expect(results.length).toEqual(1);

      results = itc.find({
        'testid': {
          '$lte': 22
        }
      });
      expect(results.length).toEqual(8);

      // lt
      results = itc.find({
        'testid': {
          '$lt': 1
        }
      });
      expect(results.length).toEqual(0);

      results = itc.find({
        'testid': {
          '$lt': 22
        }
      });
      expect(results.length).toEqual(6);

      // eq
      results = itc.find({
        'testid': {
          '$eq': 22
        }
      });
      expect(results.length).toEqual(2);

      // gt
      results = itc.find({
        'testid': {
          '$gt': 22
        }
      });
      expect(results.length).toEqual(0);

      results = itc.find({
        'testid': {
          '$gt': 5
        }
      });
      expect(results.length).toEqual(4);

      // gte
      results = itc.find({
        'testid': {
          '$gte': 5
        }
      });
      expect(results.length).toEqual(6);

      results = itc.find({
        'testid': {
          '$gte': 10
        }
      });
      expect(results.length).toEqual(3);
    });
  });

  describe('resultSet', function () {
    it('works', function () {
      // Resultset find
      expect(users.chain().find({
        'age': {
          '$gte': 30
        }
      }).where(function (obj) {
        return obj.lang === 'Swedish';
      }).data().length).toEqual(1);

      // Resultset offset
      expect(users.chain().offset(1).data().length).toEqual(users.data.length - 1);

      // Resultset limit
      expect(users.chain().limit(2).data().length).toEqual(2);
    });
  });

  describe('andOrOps', function () {
    it('works', function () {
      var eic = db.addCollection('eic');

      eic.insert({
        'testid': 1,
        'testString': 'hhh',
        'testFloat': 5.2
      }); //0
      eic.insert({
        'testid': 1,
        'testString': 'bbb',
        'testFloat': 6.2
      }); //1
      eic.insert({
        'testid': 5,
        'testString': 'zzz',
        'testFloat': 7.2
      }); //2
      eic.insert({
        'testid': 6,
        'testString': 'ggg',
        'testFloat': 1.2
      }); //3
      eic.insert({
        'testid': 9,
        'testString': 'www',
        'testFloat': 8.2
      }); //4
      eic.insert({
        'testid': 11,
        'testString': 'yyy',
        'testFloat': 4.2
      }); //5
      eic.insert({
        'testid': 22,
        'testString': 'bbb',
        'testFloat': 9.2
      }); //6
      eic.insert({
        'testid': 23,
        'testString': 'm',
        'testFloat': 2.2
      }); //7

      // coll.find explicit $and
      expect(eic.find({
        '$and': [{
          'testid': 1
        }, {
          'testString': 'bbb'
        }]
      }).length).toEqual(1);

      // coll.find implicit '$and'
      expect(eic.find({
        'testid': 1,
        'testString': 'bbb'
      }).length).toEqual(1);

      // resultset.find explicit $and
      expect(eic.chain().find({
        '$and': [{
          'testid': 1
        }, {
          'testString': 'bbb'
        }]
      }).data().length).toEqual(1);

      // resultset.find implicit $and
      expect(eic.chain().find({
        'testid': 1,
        'testString': 'bbb'
      }).data().length).toEqual(1);

      // resultset.find explicit operators
      expect(eic.chain().find({
        '$and': [{
          'testid': {
            '$eq': 1
          }
        }, {
          'testFloat': {
            '$gt': 6.0
          }
        }]
      }).data().length).toEqual(1);

      // coll.find $or
      expect(eic.find({
        '$or': [{
          'testid': 1
        }, {
          'testString': 'bbb'
        }]
      }).length).toEqual(3);

      // resultset.find $or
      expect(eic.chain().find({
        '$or': [{
          'testid': 1
        }, {
          'testString': 'bbb'
        }]
      }).data().length).toEqual(3);

      // resultset.find explicit operators
      expect(eic.chain().find({
        '$or': [{
          'testid': 1
        }, {
          'testFloat': {
            '$gt': 7.0
          }
        }]
      }).data().length).toEqual(5);

      // add index and repeat final test
      eic.ensureIndex('testid');

      expect(eic.chain().find({
        '$and': [{
          'testid': {
            '$eq': 1
          }
        }, {
          'testFloat': {
            '$gt': 6.0
          }
        }]
      }).data().length).toEqual(1);

      expect(eic.chain().find({
        '$or': [{
          'testid': 1
        }, {
          'testFloat': {
            '$gt': 7.0
          }
        }]
      }).data().length).toEqual(5);

      db.removeCollection('eic');
    });
  });

  describe('findOne', function () {
    it('works', function () {
      var eic = db.addCollection('eic');

      eic.insert({
        'testid': 1,
        'testString': 'hhh',
        'testFloat': 5.2
      }); //0
      eic.insert({
        'testid': 1,
        'testString': 'bbb',
        'testFloat': 6.2
      }); //1
      eic.insert({
        'testid': 5,
        'testString': 'zzz',
        'testFloat': 7.2
      }); //2

      // coll.findOne return type
      it('return type', function () {
        expect(typeof eic.findOne({
          'testid': 1
        })).toEqual('object');
      });

      // coll.findOne return match
      it('should match 7.2', function () {
        expect(eic.findOne({
          'testid': 5
        }).testFloat).toEqual(7.2);

      });

      // findOne with $and op
      it('findOne with $and op', function () {
        expect(eic.findOne({
          '$and': [{
            'testid': 1
          }, {
            'testString': 'bbb'
          }]
        }).testFloat, 6.2);
      });

      it('findOne with $or op', function () {
        expect(eic.findOne({
          '$or': [{
            'testid': 2
          }, {
            'testString': 'zzz'
          }]
        }).testFloat).toEqual(7.2);

      });
      // findOne with $and op

      db.removeCollection('eic');
    })
  });

  describe('resultset unfiltered simplesort works', function() {
    it('works', function() {
      var ssdb = new loki('sandbox.db');

      // Add a collection to the database
      var items = ssdb.addCollection('items', { indices: ['name'] });

      // Add some documents to the collection
      items.insert({ name : 'mjolnir', owner: 'thor', maker: 'dwarves' });
      items.insert({ name : 'gungnir', owner: 'odin', maker: 'elves' });
      items.insert({ name : 'tyrfing', owner: 'svafrlami', maker: 'dwarves' });
      items.insert({ name : 'draupnir', owner: 'odin', maker: 'elves' });
      
      // simplesort without filters on prop with index should work
      var results = items.chain().simplesort('name').data();
      expect(results.length).toEqual(4);
      expect(results[0].name).toEqual('draupnir');
      expect(results[1].name).toEqual('gungnir');
      expect(results[2].name).toEqual('mjolnir');
      expect(results[3].name).toEqual('tyrfing');
      
      // simplesort without filters on prop without index should work
      results = items.chain().simplesort('owner').data();
      expect(results.length).toEqual(4);
      expect(results[0].owner).toEqual('odin');
      expect(results[1].owner).toEqual('odin');
      expect(results[2].owner).toEqual('svafrlami');
      expect(results[3].owner).toEqual('thor');
    });
  });

  describe('resultset data removeMeta works', function() {
    it('works', function() {
      var idb = new loki('sandbox.db');

      // Add a collection to the database
      var items = idb.addCollection('items', { indices: ['owner'] });

      // Add some documents to the collection
      items.insert({ name : 'mjolnir', owner: 'thor', maker: 'dwarves' });
      items.insert({ name : 'gungnir', owner: 'odin', maker: 'elves' });
      items.insert({ name : 'tyrfing', owner: 'svafrlami', maker: 'dwarves' });
      items.insert({ name : 'draupnir', owner: 'odin', maker: 'elves' });

      // unfiltered with strip meta
      var result = items.chain().data({removeMeta:true});
      expect(result.length).toEqual(4);
      expect(result[0].hasOwnProperty('$loki')).toEqual(false);
      expect(result[0].hasOwnProperty('$loki_meta')).toEqual(false);
      expect(result[1].hasOwnProperty('$loki')).toEqual(false);
      expect(result[1].hasOwnProperty('$loki_meta')).toEqual(false);
      expect(result[2].hasOwnProperty('$loki')).toEqual(false);
      expect(result[2].hasOwnProperty('$loki_meta')).toEqual(false);
      expect(result[3].hasOwnProperty('$loki')).toEqual(false);
      expect(result[3].hasOwnProperty('$loki_meta')).toEqual(false);

      // indexed sort with strip meta
      result = items.chain().simplesort('owner').limit(2).data({removeMeta:true});
      expect(result.length).toEqual(2);
      expect(result[0].owner).toEqual('odin');
      expect(result[0].hasOwnProperty('$loki')).toEqual(false);
      expect(result[0].hasOwnProperty('$loki_meta')).toEqual(false);
      expect(result[1].owner).toEqual('odin');
      expect(result[1].hasOwnProperty('$loki')).toEqual(false);
      expect(result[1].hasOwnProperty('$loki_meta')).toEqual(false);

      // unindexed find strip meta
      result = items.chain().find({maker: 'elves'}).data({removeMeta: true});
      expect(result.length).toEqual(2);
      expect(result[0].maker).toEqual('elves');
      expect(result[0].hasOwnProperty('$loki')).toEqual(false);
      expect(result[0].hasOwnProperty('$loki_meta')).toEqual(false);
      expect(result[1].maker).toEqual('elves');      
      expect(result[1].hasOwnProperty('$loki')).toEqual(false);
      expect(result[1].hasOwnProperty('$loki_meta')).toEqual(false);

      // now try unfiltered without strip meta and ensure loki and meta are present
      result = items.chain().data();
      expect(result.length).toEqual(4);
      expect(result[0].hasOwnProperty('$loki')).toEqual(true);
      expect(result[0].hasOwnProperty('$loki_meta')).toEqual(true);
      expect(result[1].hasOwnProperty('$loki')).toEqual(true);
      expect(result[1].hasOwnProperty('$loki_meta')).toEqual(true);
      expect(result[2].hasOwnProperty('$loki')).toEqual(true);
      expect(result[2].hasOwnProperty('$loki_meta')).toEqual(true);
      expect(result[3].hasOwnProperty('$loki')).toEqual(true);
      expect(result[3].hasOwnProperty('$loki_meta')).toEqual(true);

      // now try without strip meta and ensure loki and meta are present
      result = items.chain().simplesort('owner').limit(2).data();
      expect(result.length).toEqual(2);
      expect(result[0].owner).toEqual('odin');
      expect(result[0].hasOwnProperty('$loki')).toEqual(true);
      expect(result[0].hasOwnProperty('$loki_meta')).toEqual(true);
      expect(result[1].owner).toEqual('odin');
      expect(result[1].hasOwnProperty('$loki')).toEqual(true);
      expect(result[1].hasOwnProperty('$loki_meta')).toEqual(true);

      // unindexed find strip meta
      result = items.chain().find({maker: 'elves'}).data();
      expect(result.length).toEqual(2);
      expect(result[0].maker).toEqual('elves');
      expect(result[0].hasOwnProperty('$loki')).toEqual(true);
      expect(result[0].hasOwnProperty('$loki_meta')).toEqual(true);
      expect(result[1].maker).toEqual('elves');      
      expect(result[1].hasOwnProperty('$loki')).toEqual(true);
      expect(result[1].hasOwnProperty('$loki_meta')).toEqual(true);
    });
  });

  describe('chained removes', function() {
    it('works', function() {
      var rsc = db.addCollection('rsc');

      rsc.insert({
        'testid': 1,
        'testString': 'hhh',
        'testFloat': 5.2
      });
      rsc.insert({
        'testid': 1,
        'testString': 'bbb',
        'testFloat': 6.2
      });
      rsc.insert({
        'testid': 2,
        'testString': 'ccc',
        'testFloat': 6.2
      });
      rsc.insert({
        'testid': 5,
        'testString': 'zzz',
        'testFloat': 7.2
      });

      var docCount = rsc.find().length;

      // verify initial doc count
      expect(docCount).toEqual(4);

      // remove middle documents
      rsc.chain().find({testFloat: 6.2}).remove();


      // verify new doc count
      expect(rsc.find().length).toEqual(2);
      expect(rsc.chain().data().length).toEqual(2);

      // now fetch and retain all remaining documents
      var results = rsc.chain().simplesort('testString').data();

      // make sure its the documents we expect
      expect(results[0].testString).toEqual('hhh');
      expect(results[1].testString).toEqual('zzz');
    })
  });

  /* Dynamic View Tests */
  describe('stepEvaluateDocument', function () {
    it('works', function () {
      var view = users.addDynamicView('test');
      var query = {
        'age': {
          '$gt': 24
        }
      };

      view.applyFind(query);

      // churn evaluateDocuments() to make sure it works right
      jonas.age = 23;
      users.update(jonas);
      it('evaluate documents', function () {
        expect(view.data().length).toEqual(users.data.length - 1);
        jonas.age = 30;
        users.update(jonas);
        expect(view.data().length).toEqual(users.data.length);
        jonas.age = 23;
        users.update(jonas);
        expect(view.data().length).toEqual(users.data.length - 1);
        jonas.age = 30;
        users.update(jonas);
        expect(view.data().length).toEqual(users.data.length);
      });

      // assert set equality of docArrays irrelevant of sort/sequence
      var result1 = users.find(query).sort(docCompare);
      var result2 = view.data().sort(docCompare);
      result1.forEach(function (obj) {
        delete obj.$loki_meta
      });
      result2.forEach(function (obj) {
        delete obj.$loki_meta
      });

      it('Result data Equality', function () {
        expect(result1).toEqual(result2);
      });

      it('Strict Equality', function () {
        expect(users.find(query) === view.data()).toBeTruthy();
      });

      it('View data equality', function () {
        expect(view.resultset).toEqual(view.resultset.copy());
      });

      it('View data copy strict equality', function () {
        expect(view.resultset === view.resultset.copy()).toBeFalsy();
      });


      return view;
    });
  });

  describe('stepDynamicViewPersistence', function () {
    it('works', function stepDynamicViewPersistence() {
      var query = {
        'age': {
          '$gt': 24
        }
      };

      // set up a persistent dynamic view with sort
      var pview = users.addDynamicView('test2', {
        persistent: true
      });
      pview.applyFind(query);
      pview.applySimpleSort('age');

      // the dynamic view depends on an internal resultset
      // the persistent dynamic view also depends on an internal resultdata data array
      // filteredrows should be applied immediately to resultset will be lazily built into resultdata later when data() is called
      it('dynamic view initialization 1', function () {
        expect(pview.resultset.filteredrows.length).toEqual(3);
      })
      it('dynamic view initialization 2', function () {
        expect(pview.resultdata.length).toEqual(0);
      });


      // compare how many documents are in results before adding new ones
      var pviewResultsetLenBefore = pview.resultset.filteredrows.length;

      users.insert({
        name: 'abc',
        age: 21,
        lang: 'English'
      });

      users.insert({
        name: 'def',
        age: 25,
        lang: 'English'
      });

      // now see how many are in resultset (without rebuilding persistent view)
      var pviewResultsetLenAfter = pview.resultset.filteredrows.length;

      // only one document should have been added to resultset (1 was filtered out)
      it('dv resultset is valid',
        function () {
          expect(pviewResultsetLenBefore + 1).toEqual(pviewResultsetLenAfter);
        });


      // Test sorting and lazy build of resultdata

      // retain copy of internal resultset's filteredrows before lazy sort
      var frcopy = pview.resultset.filteredrows.slice();
      pview.data();
      // now make a copy of internal result's filteredrows after lazy sort
      var frcopy2 = pview.resultset.filteredrows.slice();

      // verify filteredrows logically matches resultdata (irrelevant of sort)
      for (var idxFR = 0; idxFR < frcopy2.length; idxFR++) {
        it('dynamic view resultset/resultdata consistency', function () {
          expect(pview.resultdata[idxFR]).toEqual(pview.collection.data[frcopy2[idxFR]]);
        });
      }
      // now verify they are not exactly equal (verify sort moved stuff)
      it('dynamic view sort', function () {
        expect(frcopy).toEqual(frcopy2)
      });
    });
  });

  describe('stepDynamicViewPersistence', function () {
    it('works', function duplicateItemFoundOnIndex() {
      var test = db.addCollection('nodupes', ['index']);

      var item = test.insert({
        index: 'key',
        a: 1
      });

      var results = test.find({
        index: 'key'
      });
      it('one result exists', function () {
        expect(results.length).toEqual(1);
      });
      it('the correct result is returned', function () {
        expect(results[0].a).toEqual(1);
      });


      item.a = 2;
      test.update(item);

      results = test.find({
        index: 'key'
      });

      it('one result exists', function () {
        expect(results.length).toEqual(1);
      });
      it('the correct result is returned', function () {
        expect(results[0].a).toEqual(2);
      });
    });
  });

  describe('stepDynamicViewPersistence', function () {
    it('works', function testEmptyTableWithIndex() {
      var itc = db.addCollection('test', ['testindex']);

      var resultsNoIndex = itc.find({
        'testid': 2
      });
      expect(resultsNoIndex.length).toEqual(0);

      var resultsWithIndex = itc.find({
        'testindex': 4
      });
      it('no results found', function () {
        expect(resultsWithIndex.length).toEqual(0);
      });
    });
  });

  describe('stepDynamicViewPersistence', function () {
    it('works', function testCollections() {
      // mock persistence by using memory adapter
      var mem = new loki.LokiMemoryAdapter();
      var db = new loki('testCollections', {adapter:mem});
      db.name = 'testCollections';
      it('DB name', function () {
        expect(db.getName()).toEqual('testCollections');
      });
      var t = db.addCollection('test1', {
        transactional: true
      });
      db.addCollection('test2');
      suite.assertThrows('Throw error on wrong remove', function () {
        t.remove('foo');
      }, Error);
      suite.assertThrows('Throw error on non-synced doc', function () {
        t.remove({
          name: 'joe'
        });
      }, Error);
      it('List collections', function () {
        expect(db.listCollections().length).toEqual(2);
      });
      t.clear();
      var users = [{
        name: 'joe'
      }, {
        name: 'dave'
      }];
      t.insert(users);

      it('2 docs after array insert', function () {
        expect(2).toEqual(t.data.length)
      });
      t.remove(users);
      it('0 docs after array remove', function () {
        expect(0).toEqual(t.data.length)
      });

      function TestError() {}
      TestError.prototype = new Error;
      db.autosaveEnable();
      db.on('close', function () {
        throw new TestError;
      });
      suite.assertThrows('Throw error on purpose on close', function () {
        db.close(function () {
          return;
        });
      }, TestError);
    });
  });
});
