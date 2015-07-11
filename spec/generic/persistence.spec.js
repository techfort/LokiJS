if (typeof (window) === 'undefined') var loki = require('../../src/lokijs.js');

describe('testing unique index serialization', function () {
  var db;
  beforeEach(function () {
    db = new loki();
    users = db.addCollection('users');
    users.insert([{
      username: 'joe'
    }, {
      username: 'jack'
    }, {
      username: 'john'
    }, {
      username: 'jim'
    }]);
    users.ensureUniqueIndex('username');
  });

  it('should have a unique index', function () {
    var ser = db.serialize(),
      reloaded = new loki();
    var loaded = reloaded.loadJSON(ser);
    var coll = reloaded.getCollection('users');
    expect(coll.data.length).toEqual(4);
    expect(coll.constraints.unique.username).toBeDefined();
    var joe = coll.by('username', 'joe');
    expect(joe).toBeDefined();
    expect(joe.username).toEqual('joe');
  });
});
