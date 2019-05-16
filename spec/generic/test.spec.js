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
      expect(obj.hasOwnProperty('meta')).toEqual(true);
      expect(obj.hasOwnProperty('$loki')).toEqual(true);
      expect(obj.meta.hasOwnProperty('revision')).toEqual(true);
      expect(obj.meta.hasOwnProperty('version')).toEqual(true);
      expect(obj.meta.hasOwnProperty('created')).toEqual(true);
      expect(obj.meta.created).not.toBeLessThan(now);

      // verify batch insert return objs have meta set properly
      var objs = coll.insert([ { a:2, b:3}, { a:3, b:4}]);
      expect(Array.isArray(objs));
      objs.forEach(function(o) {
        expect(o.hasOwnProperty('meta')).toEqual(true);
        expect(o.hasOwnProperty('$loki')).toEqual(true);
        expect(o.meta.hasOwnProperty('revision')).toEqual(true);
        expect(o.meta.hasOwnProperty('version')).toEqual(true);
        expect(o.meta.hasOwnProperty('created')).toEqual(true);
        expect(o.meta.created).not.toBeLessThan(now);
      });
    });

    it('meta set on events', function(done) {
      var tdb = new loki('test.db');
      var coll = tdb.addCollection('tc');
      var now = (new Date()).getTime();

      coll.on('insert', function(o) {
        if (Array.isArray(o)) {
          o.forEach(function(obj) {
            expect(obj.hasOwnProperty('meta')).toEqual(true);
            expect(obj.hasOwnProperty('$loki')).toEqual(true);
            expect(obj.meta.hasOwnProperty('revision')).toEqual(true);
            expect(obj.meta.hasOwnProperty('version')).toEqual(true);
            expect(obj.meta.hasOwnProperty('created')).toEqual(true);
            expect(obj.meta.created).not.toBeLessThan(now);
          });
          done();
        }
        else {
          expect(o.hasOwnProperty('meta')).toEqual(true);
          expect(o.hasOwnProperty('$loki')).toEqual(true);
          expect(o.meta.hasOwnProperty('revision')).toEqual(true);
          expect(o.meta.hasOwnProperty('version')).toEqual(true);
          expect(o.meta.hasOwnProperty('created')).toEqual(true);
          expect(o.meta.created).not.toBeLessThan(now);
        }
      });

      // verify single inserts emit with obj which has meta set properly
      coll.insert({a:1, b:2});

      // verify batch inserts emit with objs which have meta set properly
      coll.insert([ { a:2, b:3}, { a:3, b:4}]);
    });

    it('meta not set on returned objects', function() {
      var tdb = new loki('test.db');
      var coll = tdb.addCollection('tc', { disableMeta: true });

      // verify single insert return objs do not have meta set
      var obj = coll.insert({ a: 1, b: 2 });
      expect(obj.hasOwnProperty('meta')).toEqual(false);
      expect(obj.hasOwnProperty('$loki')).toEqual(true);

      // verify batch insert return objs do not have meta set
      var objs = coll.insert([{ a: 2, b: 3 }, { a: 3, b: 4 }]);
      expect(Array.isArray(objs));
      objs.forEach(function (o) {
        expect(o.hasOwnProperty('meta')).toEqual(false);
        expect(o.hasOwnProperty('$loki')).toEqual(true);
      });
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

  // test for issue #747
  describe('nestedOrExpressions', function() {
    it('works', function () {
      const queryFails = {'$or': [{'state': 'STATE_FAILED'}, {'$or': [{'state': 'STATE_DEGRADED'}, {'state': 'STATE_NORMAL'}]}]};
      const queryWorks = {'$or': [{'state': 'STATE_NORMAL'}, {'$or': [{'state': 'STATE_DEGRADED'}, {'state': 'STATE_FAILED'}]}]};
      const superSlim = [{
      "uri": "/api/v3/disks/bfe8c919c2a3df669b9e0291795e488f",
      "state": "STATE_NORMAL"
      }, {
      "uri": "/api/v3/disks/bc3f751ee02ae613ed42c667fb57de75",
      "state": "STATE_NORMAL"
      }, {
      "uri": "/api/v3/disks/710466edfdc6609ea23e17eb0719ea74",
      "state": "STATE_NORMAL"
      }];
      const db = new loki('ssmc.db');
      const lokiTable = db.addCollection('bobTest', {unique: ['uri']});
      lokiTable.clear();
      lokiTable.insert(superSlim);
      const resultsSet = lokiTable.chain();
      const result = resultsSet.find(queryWorks).data({removeMeta: true});
      expect(result.length).toEqual(3);
      const resultsSet2 = lokiTable.chain();
      const result2 = resultsSet2.find(queryFails).data({removeMeta: true});
      expect(result2.length).toEqual(3); //<<=== THIS FAILS WITH result2.length actually 0
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
      expect(typeof eic.findOne({
        'testid': 1
      })).toEqual('object');

      // coll.findOne return matches 7.2
      expect(eic.findOne({
        'testid': 5
      }).testFloat).toEqual(7.2);

      // findOne with $and op
      expect(eic.findOne({
        '$and': [{
          'testid': 1
        }, {
          'testString': 'bbb'
        }]
      }).testFloat, 6.2);

      // findOne with $or op
      expect(eic.findOne({
        '$or': [{
          'testid': 2
        }, {
          'testString': 'zzz'
        }]
      }).testFloat).toEqual(7.2);

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
      expect(result[0].hasOwnProperty('meta')).toEqual(false);
      expect(result[1].hasOwnProperty('$loki')).toEqual(false);
      expect(result[1].hasOwnProperty('meta')).toEqual(false);
      expect(result[2].hasOwnProperty('$loki')).toEqual(false);
      expect(result[2].hasOwnProperty('meta')).toEqual(false);
      expect(result[3].hasOwnProperty('$loki')).toEqual(false);
      expect(result[3].hasOwnProperty('meta')).toEqual(false);

      // indexed sort with strip meta
      result = items.chain().simplesort('owner').limit(2).data({removeMeta:true});
      expect(result.length).toEqual(2);
      expect(result[0].owner).toEqual('odin');
      expect(result[0].hasOwnProperty('$loki')).toEqual(false);
      expect(result[0].hasOwnProperty('meta')).toEqual(false);
      expect(result[1].owner).toEqual('odin');
      expect(result[1].hasOwnProperty('$loki')).toEqual(false);
      expect(result[1].hasOwnProperty('meta')).toEqual(false);

      // unindexed find strip meta
      result = items.chain().find({maker: 'elves'}).data({removeMeta: true});
      expect(result.length).toEqual(2);
      expect(result[0].maker).toEqual('elves');
      expect(result[0].hasOwnProperty('$loki')).toEqual(false);
      expect(result[0].hasOwnProperty('meta')).toEqual(false);
      expect(result[1].maker).toEqual('elves');
      expect(result[1].hasOwnProperty('$loki')).toEqual(false);
      expect(result[1].hasOwnProperty('meta')).toEqual(false);

      // now try unfiltered without strip meta and ensure loki and meta are present
      result = items.chain().data();
      expect(result.length).toEqual(4);
      expect(result[0].hasOwnProperty('$loki')).toEqual(true);
      expect(result[0].hasOwnProperty('meta')).toEqual(true);
      expect(result[1].hasOwnProperty('$loki')).toEqual(true);
      expect(result[1].hasOwnProperty('meta')).toEqual(true);
      expect(result[2].hasOwnProperty('$loki')).toEqual(true);
      expect(result[2].hasOwnProperty('meta')).toEqual(true);
      expect(result[3].hasOwnProperty('$loki')).toEqual(true);
      expect(result[3].hasOwnProperty('meta')).toEqual(true);

      // now try without strip meta and ensure loki and meta are present
      result = items.chain().simplesort('owner').limit(2).data();
      expect(result.length).toEqual(2);
      expect(result[0].owner).toEqual('odin');
      expect(result[0].hasOwnProperty('$loki')).toEqual(true);
      expect(result[0].hasOwnProperty('meta')).toEqual(true);
      expect(result[1].owner).toEqual('odin');
      expect(result[1].hasOwnProperty('$loki')).toEqual(true);
      expect(result[1].hasOwnProperty('meta')).toEqual(true);

      // unindexed find strip meta
      result = items.chain().find({maker: 'elves'}).data();
      expect(result.length).toEqual(2);
      expect(result[0].maker).toEqual('elves');
      expect(result[0].hasOwnProperty('$loki')).toEqual(true);
      expect(result[0].hasOwnProperty('meta')).toEqual(true);
      expect(result[1].maker).toEqual('elves');
      expect(result[1].hasOwnProperty('$loki')).toEqual(true);
      expect(result[1].hasOwnProperty('meta')).toEqual(true);
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

  describe('batches removes work', function () {
    it('works', function() {
      var rrs = db.addCollection('rrs');
      var idx, count=100;
      var r1, r2, c1, c2;

      for (idx=0; idx<count; idx++) {
        rrs.insert({ a: Math.floor(Math.random()*5), b: idx });
      }

      r1 = rrs.find({ a: 2 });
      r2 = rrs.find({ a: 4 });

      c1 = r1?r1.length:0;
      c2 = r2?r2.length:0;

      // on initial insert, loki ids will always be one greater than data position
      rrs.chain().find({a: 2}).remove();
      // so not that data positions have shifted we will do another
      rrs.chain().find({a: 4}).remove();

      // verify that leftover count matches total count minus deleted counts
      expect(rrs.count()).toEqual(count-c1-c2);
    });
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

      // evaluate documents
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

      // assert set equality of docArrays irrelevant of sort/sequence
      var result1 = users.find(query).sort(docCompare);
      var result2 = view.data().sort(docCompare);
      result1.forEach(function (obj) {
        delete obj.meta
      });
      result2.forEach(function (obj) {
        delete obj.meta
      });

      // Result data Equality
      expect(result1).toEqual(result2);

      // Strict Equality
      expect(JSON.stringify(users.find(query)) === JSON.stringify(view.data())).toBeTruthy();

      // View data equality
      expect(JSON.stringify(view.resultset)).toEqual(JSON.stringify(view.resultset.copy()));

      // View data copy strict equality
      expect(view.resultset === view.resultset.copy()).toBeFalsy();

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

      // dynamic view initialization 1
      expect(pview.resultset.filteredrows.length).toEqual(3);
      // dynamic view initialization 2
      expect(pview.resultdata.length).toEqual(0);

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
      expect(pviewResultsetLenBefore + 1).toEqual(pviewResultsetLenAfter);

      // Test sorting and lazy build of resultdata

      // retain copy of internal resultset's filteredrows before lazy sort
      var frcopy = pview.resultset.filteredrows.slice();
      pview.data();
      // now make a copy of internal result's filteredrows after lazy sort
      var frcopy2 = pview.resultset.filteredrows.slice();

      // verify filteredrows logically matches resultdata (irrelevant of sort)
      for (var idxFR = 0; idxFR < frcopy2.length; idxFR++) {
        expect(pview.resultdata[idxFR]).toEqual(pview.collection.data[frcopy2[idxFR]]);
      }

      // now verify they are not exactly equal (verify sort moved stuff)
      expect(JSON.stringify(frcopy) === JSON.stringify(frcopy2)).toBeFalsy();
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

      // one result exists
      expect(results.length).toEqual(1);
      // the correct result is returned
      expect(results[0].a).toEqual(1);

      item.a = 2;
      test.update(item);

      results = test.find({
        index: 'key'
      });

      // one result exists
      expect(results.length).toEqual(1);
      // the correct result is returned
      expect(results[0].a).toEqual(2);
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
      // no results found
      expect(resultsWithIndex.length).toEqual(0);
    });
  });

  describe('stepDynamicViewPersistence', function () {
    it('works', function testCollections() {
      // mock persistence by using memory adapter
      var mem = new loki.LokiMemoryAdapter();
      var db = new loki('testCollections', {adapter:mem});
      db.name = 'testCollections';

      // DB name
      expect(db.getName()).toEqual('testCollections');

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

      // List collections
      expect(db.listCollections().length).toEqual(2);

      t.clear();
      var users = [{
        name: 'joe'
      }, {
        name: 'dave'
      }];
      t.insert(users);

      // 2 docs after array insert
      expect(2).toEqual(t.data.length)

      t.remove(users);
      // 0 docs after array remove
      expect(0).toEqual(t.data.length)

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
