var loki = require('../src/lokijs.js'),
  db = new loki('test', {
    persistenceMethod: null
  }),
  gordian = require('gordian'),
  suite = new gordian('testEvents'),
  users = db.addCollection('users', {
    asyncListeners: false
  });

users.insert({
  name: 'joe'
});

function testAsync() {
  suite.assertEqual('DB events async', db.asyncListeners, false);
}

function testEmit() {
  var index = db.on('test', function test(obj) {
    suite.assertEqual('Argument passed to event', 42, obj);
  });

  db.emit('test', 42);
  db.removeListener('test', index);

  suite.assertEqual('Event has no listeners attached', db.events['test'].length, 0);

  suite.assertThrows('No event testEvent', function testEvent() {
    db.emit('testEvent');
  }, Error);
}

testAsync();
testEmit();

suite.report();