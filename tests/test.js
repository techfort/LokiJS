// to be run in node
var gordian = require('gordian'),
  suite = new gordian('LokiTests'),
  loki = require('../src/lokijs.js'),
  db,
  users;

function docCompare(a, b) {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  
  return 0;
}

db = new loki('test.json');
users = db.addCollection('user');
var jonas=null;

function populateTestData() {

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

}

function testCoreMethods() {
  // findOne()
  var j = users.findOne({'name':'jonas'});
  suite.assertStrictEqual("findOne", j.name, 'jonas');
  
  // find()
  var result = users.find({'age': {'$gt':29}});
  suite.assertStrictEqual("find", result.length, 2);
  
  // $regex test
  suite.assertStrictEqual('$regex'
  , users.find({ "name": { '$regex': /o/ }}).length
  , 2);

  // insert() : try inserting existing document (should fail), try adding doc with legacy id column
  var collectionLength = users.data.length;
  var objDave = users.findOne({'name':'dave'});
  var wasAdded = true;
  try {
    users.insert(objDave);
  }
  catch (err) {
    wasAdded = false;
  }
  suite.assertStrictEqual('insert existing document caught', wasAdded, false);
  
  // our collections are not strongly typed so lets invent some object that has its 'own' id column
  // and make sure it renames that old id column to 'originalId'
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
  }
  catch (err) {
    wasAdded = false;
  }
  
  suite.assertStrictEqual('insert legacy document allowed', wasAdded, true);
  
  // remove object so later queries access valid properties on all objects
  if (wasAdded) {
    var hasOID = (typeof (legacyObject.originalId) !== 'undefined');
    suite.assertStrictEqual('insert legacy document has originalId property', hasOID, true);
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
  }
  catch (err) {
    wasUpdated = false;
  }
  suite.assertStrictEqual('updating object not in collection should fail', wasUpdated, false);
  
  // remove() - add some bogus object to remove
  var userCount1 = users.data.length;
  
  testObject = {
    first: 'aaa',
    last: 'bbb',
    city: 'pasadena',
    state: 'ca'
  }
  
  users.insert(testObject);
  
  suite.assertStrictEqual('delete test : insert obj to delete', userCount1+1, users.data.length);
  users.remove(testObject);
  suite.assertStrictEqual('delete test : delete', userCount1, users.data.length);
}

function testCalculateRange() {
  var eic = db.addCollection("eic");
  eic.ensureBinaryIndex("testid");
  
  eic.insert({'testid':1, 'testString': 'hhh', 'testFloat': 5.2});  //0
  eic.insert({'testid':1, 'testString': 'aaa', 'testFloat': 6.2});  //1
  eic.insert({'testid':5, 'testString': 'zzz', 'testFloat': 7.2});  //2
  eic.insert({'testid':6, 'testString': 'ggg', 'testFloat': 1.2});  //3
  eic.insert({'testid':9, 'testString': 'www', 'testFloat': 8.2});  //4
  eic.insert({'testid':11, 'testString': 'yyy', 'testFloat': 4.2}); //5
  eic.insert({'testid':22, 'testString': 'yyz', 'testFloat': 9.2}); //6
  eic.insert({'testid':23, 'testString': 'm', 'testFloat': 2.2});   //7
  
  var rset = eic.chain();
  rset.find({'testid': 1});  // force index to be built
  
  // ranges are order of sequence in index not data array positions
  
  var range = rset.calculateRange('$eq', 'testid', 22);
  suite.assertEqual('calculateRange $eq', range, [6, 6]);
  
  range = rset.calculateRange('$eq', 'testid', 1);
  suite.assertEqual('calculateRange $eq multiple', range, [0, 1]);
  
  range = rset.calculateRange('$eq', 'testid', 7);
  suite.assertEqual('calculateRange $eq not found', range, [0, -1]);
  
  range = rset.calculateRange('$gte', 'testid', 23);
  suite.assertEqual('calculateRange $gte', range, [7, 7]);
  
  // reference this new record for future evaluations
  eic.insert({'testid':23, 'testString': 'bbb', 'testFloat': 1.9});
  
  range = rset.calculateRange('$gte', 'testid', 23);
  suite.assertEqual('calculateRange $gte', range, [7, 8]);
  
  range = rset.calculateRange('$gte', 'testid', 24);
  suite.assertEqual('calculateRange $gte out of range', range, [0, -1]);
  
  range = rset.calculateRange('$lte', 'testid', 5);
  suite.assertEqual('calculateRange $lte', range, [0, 2]);
  
  range = rset.calculateRange('$lte', 'testid', 1);
  suite.assertEqual('calculateRange $lte', range, [0, 1]);
  
  range = rset.calculateRange('$lte', 'testid', -1);
  suite.assertEqual('calculateRange $lte out of range', range, [0, -1]);
  
  // add another index on string property
  eic.ensureBinaryIndex('testString');
  rset.find({'testString': 'asdf'});  // force index to be built
  
  range = rset.calculateRange('$lte', 'testString', 'ggg');
  suite.assertEqual('calculateRange $lte string', range, [0, 2]);  // includes record added in middle
  
  range = rset.calculateRange('$gte', 'testString', 'm');
  suite.assertEqual('calculateRange $gte string', range, [4, 8]); // offset by 1 because of record in middle
  
  // add some float range evaluations
  eic.ensureBinaryIndex('testFloat');
  rset.find({'testFloat': '1.1'});  // force index to be built
  
  range = rset.calculateRange('$lte', 'testFloat', 1.2);
  suite.assertEqual('calculateRange $lte float', range, [0, 0]);  
  
  range = rset.calculateRange('$eq', 'testFloat', 1.111);
  suite.assertEqual('calculateRange $eq not found', range, [0, -1]);  
  
  range = rset.calculateRange('$eq', 'testFloat', 8.2);
  suite.assertEqual('calculateRange $eq found', range, [7, 7]);  // 8th pos
  
  range = rset.calculateRange('$gte', 'testFloat', 1.0);
  suite.assertEqual('calculateRange $gt all', range, [0, 8]);  // 8th pos
}

function testIndexLifecycle() {
  var ilc = db.addCollection('ilc');
  
  var hasIdx = ilc.binaryIndices.hasOwnProperty('testid');
  suite.assertEqual('index lifecycle before', hasIdx, false);
  
  ilc.ensureBinaryIndex('testid');
  hasIdx = ilc.binaryIndices.hasOwnProperty('testid');
  suite.assertEqual('index lifecycle created', hasIdx, true);
  suite.assertEqual('index lifecycle created', ilc.binaryIndices.testid.dirty, false);
  suite.assertEqual('index lifecycle created', ilc.binaryIndices.testid.values, []);
  
  ilc.insert({'testid': 5});
  suite.assertEqual('index lifecycle dirty', ilc.binaryIndices.testid.dirty, true);
  ilc.insert({'testid': 8});
  suite.assertEqual('index lifecycle still lazy', ilc.binaryIndices.testid.values, []);
  suite.assertEqual('index lifecycle still dirty', ilc.binaryIndices.testid.dirty, true);

  ilc.find({'testid': 8});  // should force index build
  suite.assertEqual('index lifecycle built', ilc.binaryIndices.testid.dirty, false);
  suite.assertEqual('index lifecycle still lazy', ilc.binaryIndices.testid.values.length, 2);
}

function testIndexes() {
  var itc = db.addCollection('test', ['testid']);
  
  itc.insert({'testid':1});
  itc.insert({'testid':2});
  itc.insert({'testid':5});
  itc.insert({'testid':5});
  itc.insert({'testid':9});
  itc.insert({'testid':11});
  itc.insert({'testid':22});
  itc.insert({'testid':22});

  // lte
  var results = itc.find({'testid': {'$lte': 1}});
  suite.assertStrictEqual('find using index $lte', results.length, 1);
  
  results = itc.find({'testid': {'$lte': 22}});
  suite.assertStrictEqual('find using index $lte', results.length, 8);
  
  // lt
  results = itc.find({'testid': {'$lt': 1}});
  suite.assertStrictEqual('find using index $lt', results.length, 0);

  results = itc.find({'testid': {'$lt': 22}});
  suite.assertStrictEqual('find using index $lt', results.length, 6);
  
  // eq
  results = itc.find({'testid': {'$eq': 22}});
  suite.assertStrictEqual('find using index $eq', results.length, 2);
  
  // gt
  results = itc.find({'testid': {'$gt': 22}});
  suite.assertStrictEqual('find using index $eq', results.length, 0);

  results = itc.find({'testid': {'$gt': 5}});
  suite.assertStrictEqual('find using index $eq', results.length, 4);

  // gte
  results = itc.find({'testid': {'$gte': 5}});
  suite.assertStrictEqual('find using index $gte', results.length, 6);

  results = itc.find({'testid': {'$gte': 10}});
  suite.assertStrictEqual('find using index $gte', results.length, 3);
}

function testResultset() {
  // Resultset find
  suite.assertStrictEqual('Resultset (chained) find'
  , users.chain().find({'age': { '$gte': 30 }}).where(function(obj) { return obj.lang === 'Swedish'; }).data().length
  , 1);

  // Resultset offset
  suite.assertStrictEqual('Resultset (chained) offset'
  , users.chain().offset(1).data().length
  , users.data.length-1
  );

  // Resultset limit
  suite.assertStrictEqual('Resultset (chained) limit'
  , users.chain().limit(2).data().length
  , 2
  );

}

/* Dynamic View Tests */
function stepEvaluateDocument() {
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
  
  suite.assertStrictEqual("evalDoc1", view.data().length, users.data.length - 1);
  jonas.age = 30;
  users.update(jonas);
  suite.assertStrictEqual("evalDoc2", view.data().length, users.data.length);
  jonas.age = 23;
  users.update(jonas);
  suite.assertStrictEqual("evalDoc3", view.data().length, users.data.length - 1);
  jonas.age = 30;
  users.update(jonas);
  suite.assertStrictEqual("evalDoc4", view.data().length, users.data.length);

  // assert set equality of docArrays irrelevant of sort/sequence
  suite.assertEqual('Result data Equality', users.find(query).sort(docCompare), view.data().sort(docCompare));

  suite.assertNotStrictEqual('Strict Equality', users.find(query), view.data());
  suite.assertEqual('View data equality', view.resultset, view.resultset.copy());
  suite.assertNotStrictEqual('View data copy strict equality', view.resultset, view.resultset.copy());
  
  return view;
}

// make sure view persistence works as expected
function stepDynamicViewPersistence() {
  var query = {
    'age': {
      '$gt': 24
    }
  };

  // set up a persistent dynamic view with sort
  var pview = users.addDynamicView('test2', true);
  pview.applyFind(query);
  pview.applySimpleSort("age");

  // the dynamic view depends on an internal resultset
  // the persistent dynamic view also depends on an internal resultdata data array
  // filteredrows should be applied immediately to resultset will be lazily built into resultdata later when data() is called
  suite.assertStrictEqual("dynamic view initialization 1", pview.resultset.filteredrows.length, 3);
  suite.assertStrictEqual("dynamic view initialization 2", pview.resultdata.length, 0);
  
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
  suite.assertStrictEqual("dv resultset is 'set' valid", pviewResultsetLenBefore+1, pviewResultsetLenAfter);

  // Test sorting and lazy build of resultdata
  
  // retain copy of internal resultset's filteredrows before lazy sort
  var frcopy = pview.resultset.filteredrows.slice();
  pview.data();
  // now make a copy of internal result's filteredrows after lazy sort
  var frcopy2 = pview.resultset.filteredrows.slice();
  
  // verify filteredrows logically matches resultdata (irrelevant of sort)
  for(var idxFR=0; idxFR < frcopy2.length; idxFR++) {
    suite.assertEqual("dynamic view resultset/resultdata consistency", pview.resultdata[idxFR], pview.collection.data[frcopy2[idxFR]]);
  }
  // now verify they are not exactly equal (verify sort moved stuff)
  suite.assertNotEqual('dynamic view sort', frcopy, frcopy2);
}

function testDynamicView() {
  var view = stepEvaluateDocument();
  stepDynamicViewPersistence();
}

/* Main Test */
populateTestData();
testCoreMethods();
testCalculateRange();
testIndexes();
testIndexLifecycle();
testResultset();
testDynamicView();

suite.report();
