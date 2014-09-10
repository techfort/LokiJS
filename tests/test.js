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

suite.assertEqual('Result data Equality', users.find(query), view.data());
suite.assertNotStrictEqual('Strict Equality', users.find(query), view.data());
suite.assertEqual('View data equality', view.resultset, view.resultset.copy());
suite.assertNotStrictEqual('View data copy strict equality', view.resultset, view.resultset.copy());
suite.report();