var loki = require('../src/lokijs.js'),
  db = new loki(),
  gordian = require('gordian'),
  suite = new gordian('testEvents'),
  users = db.addCollection('users');

users.insert({
  name: 'joe',
  age: 35
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
  age: 15
});
users.insert({
  name: 'jim',
  age: 28
});
users.insert({
  name: 'dave',
  age: 12
});

console.log(users.max('age'));
console.log(users.avg('age'));
