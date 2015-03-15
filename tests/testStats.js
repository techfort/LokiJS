var loki = require('../src/lokijs.js'),
  db = new loki(),
  gordian = require('gordian'),
  suite = new gordian('testEvents'),
  users = db.addCollection('users');

users.insert({
  name: 'joe',
  age: 35,
  relatives: {
    firstgrade: 15
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
    firstgrade: 20
  }
});
users.insert({
  name: 'jim',
  age: 28,
  relatives: {
    firstgrade: 15
  }
});
users.insert({
  name: 'dave',
  age: 12,
  relatives: {
    firstgrade: 12
  }
});

console.log('Simple max: ', users.max('relatives.firstgrade'));
console.log('Max record: ', users.maxRecord('relatives.firstgrade'));
console.log('Simple min: ', users.min('age'));
console.log('Min record: ', users.minRecord('age'));
console.log('Average: ', users.avg('relatives.firstgrade'));
console.log('Mode: ', users.mode('relatives.firstgrade'));
console.log('Median: ', users.median('relatives.firstgrade'));
console.log('Extract ages: ', users.extract('age'));
console.log('Standard deviation on firstgrade relatives: ', users.stdDev('relatives.firstgrade'));
console.log('Standard deviation on ages: ', users.stdDev('age'));
