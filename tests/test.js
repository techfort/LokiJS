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
users = db.addCollection('user', 'User');

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
suite.report();