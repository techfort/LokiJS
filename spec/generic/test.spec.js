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

      // $regex test
      expect(users.find({
        'name': {
          '$regex': /o/
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

      var range = rset.calculateRange('$eq', 'testid', 22);
      expect(range).toEqual([6, 6]);

      range = rset.calculateRange('$eq', 'testid', 1);
      expect(range).toEqual([0, 1]);

      range = rset.calculateRange('$eq', 'testid', 7);
      expect(range).toEqual([0, -1]);

      range = rset.calculateRange('$gte', 'testid', 23);
      expect(range).toEqual([7, 7]);

      // reference this new record for future evaluations
      eic.insert({
        'testid': 23,
        'testString': 'bbb',
        'testFloat': 1.9
      });

      // test when all records are in range
      range = rset.calculateRange('$lt', 'testid', 25);
      expect(range).toEqual([0, 8]);
      range = rset.calculateRange('$lte', 'testid', 25);
      expect(range).toEqual([0, 8]);
      range = rset.calculateRange('$gt', 'testid', 0);
      expect(range).toEqual([0, 8]);
      range = rset.calculateRange('$gte', 'testid', 0);
      expect(range).toEqual([0, 8]);

      range = rset.calculateRange('$gte', 'testid', 23);
      expect(range).toEqual([7, 8]);

      range = rset.calculateRange('$gte', 'testid', 24);
      expect(range).toEqual([0, -1]);

      range = rset.calculateRange('$lte', 'testid', 5);
      expect(range).toEqual([0, 2]);

      range = rset.calculateRange('$lte', 'testid', 1);
      expect(range).toEqual([0, 1]);

      range = rset.calculateRange('$lte', 'testid', -1);
      expect(range).toEqual([0, -1]);

      // add another index on string property
      eic.ensureIndex('testString');
      rset.find({
        'testString': 'asdf'
      }); // force index to be built

      range = rset.calculateRange('$lte', 'testString', 'ggg');
      expect(range).toEqual([0, 2]); // includes record added in middle

      range = rset.calculateRange('$gte', 'testString', 'm');
      expect(range).toEqual([4, 8]); // offset by 1 because of record in middle

      // add some float range evaluations
      eic.ensureIndex('testFloat');
      rset.find({
        'testFloat': '1.1'
      }); // force index to be built

      range = rset.calculateRange('$lte', 'testFloat', 1.2);
      expect(range).toEqual([0, 0]);

      range = rset.calculateRange('$eq', 'testFloat', 1.111);
      expect(range).toEqual([0, -1]);

      range = rset.calculateRange('$eq', 'testFloat', 8.2);
      expect(range).toEqual([7, 7]); // 8th pos

      range = rset.calculateRange('$gte', 'testFloat', 1.0);
      expect(range).toEqual([0, 8]); // 8th pos
    })
  });

  describe('indexLifecycle', function () {
    it('works', function () {
      var ilc = db.addCollection('ilc');

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

      // coll.find $and
      expect(eic.find({
        '$and': [{
          'testid': 1
        }, {
          'testString': 'bbb'
        }]
      }).length).toEqual(1);

      // resultset.find $and
      expect(eic.chain().find({
        '$and': [{
          'testid': 1
        }, {
          'testString': 'bbb'
        }]
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
  })

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
        delete obj.meta
      });
      result2.forEach(function (obj) {
        delete obj.meta
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
    it('works', function testAnonym() {
      var coll = db.anonym([{
        name: 'joe'
      }, {
        name: 'jack'
      }], ['name']);
      it('Anonym collection', function () {
        expect(coll.data.length).toEqual(2);
      });
      it('Collection not found', function () {
        expect(db.getCollection('anonym')).toEqual(null);
      });
      coll.name = 'anonym';
      db.loadCollection(coll);
      it('Anonym collection loaded', function () {
        expect(!!db.getCollection('anonym') === true).toBeTruthy();
      });
      coll.clear();
      it('No data after coll.clear()', function () {
        expect(0).toEqual(coll.data.length)
      });
    });
  });

  describe('stepDynamicViewPersistence', function () {
    it('works', function testCollections() {
      var db = new loki('testCollections');
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
