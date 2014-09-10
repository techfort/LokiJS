// to be run in node
var gordian = require('gordian'),
  suite = new gordian('LokiTests'),
  loki = require('../src/lokijs.js'),
  db,
  users,
  view,
  query;

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

users.insert({
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

suite.assertEqual('Result data Equality', users.find(query), view.data());
suite.assertNotStrictEqual('Strict Equality', users.find(query), view.data());
suite.assertEqual('View data equality', view.resultset, view.resultset.copy());
suite.assertNotStrictEqual('View data copy strict equality', view.resultset, view.resultset.copy());
suite.report();