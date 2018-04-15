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

  it('works with delta mode', function () {
    var db = new loki(),
    options = {
      asyncListeners: false,
      disableChangesApi: false,
      disableDeltaChangesApi: false
    },
    items = db.addCollection('items', options );

    // Add some documents to the collection
    items.insert({ name : 'mjolnir', owner: 'thor', maker: { name: 'dwarves', count: 1 } });
    items.insert({ name : 'gungnir', owner: 'odin', maker: { name: 'elves', count: 1 } });
    items.insert({ name : 'tyrfing', owner: 'Svafrlami', maker: { name: 'dwarves', count: 1 } });
    items.insert({ name : 'draupnir', owner: 'odin', maker: { name: 'elves', count: 1 } });

    // Find and update an existing document
    var tyrfing = items.findOne({'name': 'tyrfing'});
    tyrfing.owner = 'arngrim';
    items.update(tyrfing);
    tyrfing.maker.count = 4;
    items.update(tyrfing);

    var changes = db.serializeChanges(['items']);
    changes = JSON.parse(changes);
    
    expect(changes.length).toEqual(6);

    var firstUpdate = changes[4];
    expect(firstUpdate.operation).toEqual('U');
    expect(firstUpdate.obj.owner).toEqual('arngrim');
    expect(firstUpdate.obj.name).toBeUndefined();

    var secondUpdate = changes[5];
    expect(secondUpdate.operation).toEqual('U');
    expect(secondUpdate.obj.owner).toBeUndefined();
    expect(secondUpdate.obj.maker).toEqual({ count: 4 });
    
  });

  it('batch operations work with delta mode', function() {
    var db = new loki(),
    options = {
      asyncListeners: false,
      disableChangesApi: false,
      disableDeltaChangesApi: false
    },
    items = db.addCollection('items', options );

    // Add some documents to the collection
    items.insert([
      { name : 'mjolnir', owner: 'thor', maker: 'dwarves', count: 0 },
      { name : 'gungnir', owner: 'odin', maker: 'elves', count: 0 },
      { name : 'tyrfing', owner: 'Svafrlami', maker: 'dwarves', count: 0 },
      { name : 'draupnir', owner: 'odin', maker: 'elves', count: 0 }
    ]);

    items.chain().update(function(o) { o.count++; });

    var changes = db.serializeChanges(['items']);
    changes = JSON.parse(changes);
    
    expect(changes.length).toEqual(8);

    expect(changes[0].name).toEqual("items");
    expect(changes[0].operation).toEqual("I");
    expect(changes[1].name).toEqual("items");
    expect(changes[1].operation).toEqual("I");
    expect(changes[2].name).toEqual("items");
    expect(changes[2].operation).toEqual("I");
    expect(changes[3].name).toEqual("items");
    expect(changes[3].operation).toEqual("I");

    expect(changes[4].name).toEqual("items");
    expect(changes[4].operation).toEqual("U");
    expect(changes[4].obj.count).toEqual(1);
    expect(changes[5].name).toEqual("items");
    expect(changes[5].operation).toEqual("U");
    expect(changes[5].obj.count).toEqual(1);
    expect(changes[6].name).toEqual("items");
    expect(changes[6].operation).toEqual("U");
    expect(changes[6].obj.count).toEqual(1);
    expect(changes[7].name).toEqual("items");
    expect(changes[7].operation).toEqual("U");
    expect(changes[7].obj.count).toEqual(1);

    var keys = Object.keys(changes[7].obj);
    keys.sort();
    expect(keys[0]).toEqual("$loki");
    expect(keys[1]).toEqual("count");
    expect(keys[2]).toEqual("meta");
  });
});
