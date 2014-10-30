// to be run in node
var gordian = require('gordian'),
  suite = new gordian('LokiTests'),
  loki = require('../src/lokijs.js'),
  db,
  users,
  view,
  query;

function docCompare(a, b) {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  
  return 0;
}

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

var jonas = users.insert({
  name: 'jonas',
  age: 30,
  lang: 'Swedish'
});

view = users.addDynamicView('test');
query = {
  'age': {
    '$gt': 24
  }
};

view.applyFind(query);

// look for all users with 'o' in name
suite.assertStrictEqual('RegExp find op'
, users.find({ "name": { '$regex': /o/ }}).length
, 2);

suite.assertStrictEqual('Resultset chain operations'
, users.chain().find({'age': { '$gte': 30 }}).where(function(obj) { return obj.lang === 'Swedish'; }).data().length
, 1);

suite.assertStrictEqual('Offset/Skip first item of chain() with no filters'
, users.chain().offset(1).data().length
, users.data.length-1
);

suite.assertStrictEqual('Limit results to two documents'
, users.chain().limit(2).data().length
, 2
);

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

// Dynamic, Persistent view ... verify deferred sorting

view2 = users.addDynamicView('test2', true);
view2.applyFind(query);
view2.applySimpleSort("age");

// filteredrows should be updated but not sorted after each insert
// compare how many documents are in results before adding new ones
var v2frl = view2.resultset.filteredrows.length;

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

// now see how many are in results (without rebuilding persistent view)
var v2frl2 = view2.resultset.filteredrows.length;

// only one document should have been added to resultset (1 was filtered out)
suite.assertStrictEqual("dv resultset is 'set' valid", v2frl+1, v2frl2);

// examine the view's filteredrows before calling data() to rebuild data
var frcopy = view2.resultset.filteredrows.slice();
view2.data();
// examine the view's filteredrows now after lazy sorting
var frcopy2 = view2.resultset.filteredrows.slice();
// verify filteredrows logically matches resultdata
for(var idxFR=0; idxFR < frcopy2.length; idxFR++) {
	suite.assertEqual("resultset/resultdata consistency", view2.resultdata[idxFR], view2.collection.data[frcopy2[idxFR]]);
}
// verify the sort had an effect on filteredrows
suite.assertNotEqual('Deferred Sort made changes', frcopy, frcopy2);

// End Dynamic, Persistent view tests

suite.report();
