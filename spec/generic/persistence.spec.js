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
    
    expect(reloaded.options.serializationMethod).toBe("normal");
    expect(reloaded.options.destructureDelimiter).toBe("$<\n");
  });

  it('verify destructuring works as expected', function()  {
    var ddb = new loki("test.db", { serializationMethod: "destructured" });
    var coll = ddb.addCollection("testcoll");
    coll.insert({
      name : "test1",
      val: 100
    });
    coll.insert({
      name : "test2",
      val: 101
    });
    coll.insert({
      name : "test3",
      val: 102
    });
    
    var destructuredJson = ddb.serialize();
    
    var cddb = new loki("test.db", { serializationMethod: "destructured" });
    cddb.loadJSON(destructuredJson);
    
    expect(cddb.options.serializationMethod).toEqual("destructured");
    expect(cddb.collections.length).toEqual(1);
    expect(cddb.collections[0].data.length).toEqual(3);
    expect(cddb.collections[0].data[0].val).toEqual(ddb.collections[0].data[0].val);
  });

});
