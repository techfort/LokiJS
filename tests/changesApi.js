// var loki = require('../src/lokijs.js'),
describe('changesApi', function() {
  it('does what it says on the tin', function() {
    var db = new loki(),
    // gordian = require('gordian'),
    // suite = new gordian('testEvents'),
    options = {
      asyncListeners: false,
      disableChangesApi: false
    },
    users = db.addCollection('users', options),
    test = db.addCollection('test', options),
    test2 = db.addCollection('test2', options);

    var u = users.insert({
      name: 'joe'
    });
    u.name = 'jack';
    users.update(u);
    test.insert({
      name: 'test'
    });
    test2.insert({
      name: 'test2'
    });

    var userChanges = db.generateChangesNotification(['users']);

    suite.assertEqual('Single collection changes', 2, userChanges.length);
    suite.assertEqual('Check serialized changes', db.serializeChanges(['users']), JSON.stringify(userChanges));

    var someChanges = db.generateChangesNotification(['users', 'test2']);

    suite.assertEqual('Changes number for selected collections', 3, someChanges.length);
    var allChanges = db.generateChangesNotification();

    suite.assertEqual('Changes number for all collections', 4, allChanges.length);
    users.setChangesApi(false);
    suite.assertEqual('Changes Api disabled', true, users.disableChangesApi);

    u.name = 'john';
    users.update(u);
    var newChanges = db.generateChangesNotification(['users']);

    suite.assertEqual('Change should not register after Api disabled', 2, newChanges.length);
    db.clearChanges();

    suite.assertEqual('clearChanges should wipe changes', 0, users.getChanges().length);

    u.name = 'jim';
    users.update(u);
    users.flushChanges();

    suite.assertEqual('Collection level changes flush', 0, users.getChanges().length);
  })
})
