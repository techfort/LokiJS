if (typeof(window) === 'undefined') var loki = require('../../src/lokijs.js');

describe('changesApi', function () {
  it('does what it says on the tin', function () {
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

    expect(userChanges.length).toEqual(2);
    expect(db.serializeChanges(['users'])).toEqual(JSON.stringify(userChanges));

    var someChanges = db.generateChangesNotification(['users', 'test2']);

    expect(someChanges.length).toEqual(3);
    var allChanges = db.generateChangesNotification();

    expect(allChanges.length).toEqual(4);
    users.setChangesApi(false);
    expect(users.disableChangesApi).toEqual(true);

    u.name = 'john';
    users.update(u);
    var newChanges = db.generateChangesNotification(['users']);

    expect(newChanges.length).toEqual(2);
    db.clearChanges();

    expect(users.getChanges().length).toEqual(0);

    u.name = 'jim';
    users.update(u);
    users.flushChanges();

    expect(users.getChanges().length).toEqual(0);
  });
});
