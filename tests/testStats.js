// var loki = require('../src/lokijs.js'),
//   db = new loki(),
//   gordian = require('gordian'),
//   suite = new gordian('testEvents'),
//   users = db.addCollection('users');

describe('stats', function() {
  it('works', function() {
    var db = new loki();
    var users = db.addCollection('users');

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

    suite.assertEqual('Simple max: ', 32, users.max('relatives.firstgrade'));
    suite.assertEqual('Max record: ', {
      index: 3,
      value: 32
    }, users.maxRecord('relatives.firstgrade'));
    suite.assertEqual('Simple min: ', 12, users.min('age'));
    suite.assertEqual('Min record: ', {
      index: 6,
      value: 12
    }, users.minRecord('age'));
    suite.assertEqual('Average: ', 19, users.avg('relatives.firstgrade'));
    // suite.assertEqual('Mode: ', 20, users.mode('relatives.firstgrade'));
    suite.assertEqual('Median: ', 17.5, users.median('relatives.firstgrade'));
    suite.assertEqual('Extract ages: ', [35, 20, 40, 15, 28, 12], users.extract('age'));
    suite.assertEqual('Standard deviation on firstgrade relatives: ', 6.48074069840786, users.stdDev('relatives.firstgrade'));
    suite.assertEqual('Standard deviation on ages: ', 10.23067283548187, users.stdDev('age'));
  })
})

// suite.report();
