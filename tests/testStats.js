var loki = require('../src/lokijs.js'),
  db = new loki(),
  gordian = require('gordian'),
  suite = new gordian('testEvents'),
  users = db.addCollection('users');

users.insert({
  name: 'joe',
  age: 35,
  relatives: {
    firstgrade: 12
  }
});
users.insert({
  name: 'jack',
  age: 20,
  relatives: {
    firstgrade: 20
  }
});
users.insert({
  name: 'jim',
  age: 40,
  relatives: {
    firstgrade: 32
  }
});
users.insert({
  name: 'dave',
  age: 15,
  relatives: {
    firstgrade: 10
  }
});
users.insert({
  name: 'jim',
  age: 28,
  relatives: {
    firstgrade: 12
  }
});
users.insert({
  name: 'dave',
  age: 12,
  relatives: {
    firstgrade: 19
  }
});

console.log(users.max('relatives.firstgrade'));
console.log(users.maxRecord('relatives.firstgrade'));
console.log(users.min('age'));
console.log(users.minRecord('age'));
console.log(users.avg('relatives.firstgrade'));
console.log(users.extract('relatives.firstgrade'));
console.log(users.stdDev('relatives.firstgrade'));
console.log(users.mode('relatives.firstgrade'));
