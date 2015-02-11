var loki = require('../src/lokijs.js'),
  db = new loki(),
  gordian = require('gordian'),
  suite = new gordian('testEvents'),
  users = db.addCollection('users');

users.insert({
  name: 'joe',
  age: 39
});
users.insert({
  name: 'jack',
  age: 20
});
users.insert({
  name: 'jim',
  age: 40
});
users.insert({
  name: 'dave',
  age: 33
});
users.insert({
  name: 'jim',
  age: 29
});
users.insert({
  name: 'dave',
  age: 21
});

var dv = users.addDynamicView('testview');
dv.applyWhere(function (obj) {
  return obj.name.length > 3;
});

users.removeWhere(function (obj) {
  return obj.age > 35;
});
suite.assertEqual('Users length after removeWhere()', users.data.length, 4);
users.removeWhere({
  'age': {
    $gt: 25
  }
});
suite.assertEqual('Users length after removeWhere()', users.data.length, 2);
users.remove(6);
suite.assertEqual('Users length after remove(int)', users.data.length, 1);
users.removeDataOnly();
suite.assertEqual('No users left after removeDataOnly()', users.data.length, 0);
suite.assertEqual('DynamicView still in existence after removing data', !!users.getDynamicView('testview'), true);
suite.report();