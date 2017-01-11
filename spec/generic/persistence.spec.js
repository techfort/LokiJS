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
});

describe('testing destructured serialization/deserialization', function () {
  it('verify default (D) destructuring works as expected', function()  {
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

    var coll2 = ddb.addCollection("another");
    coll2.insert({
      a: 1,
      b: 2
    });

    var destructuredJson = ddb.serialize();

    var cddb = new loki("test.db", { serializationMethod: "destructured" });
    cddb.loadJSON(destructuredJson);

    expect(cddb.options.serializationMethod).toEqual("destructured");
    expect(cddb.collections.length).toEqual(2);
    expect(cddb.collections[0].data.length).toEqual(3);
    expect(cddb.collections[0].data[0].val).toEqual(ddb.collections[0].data[0].val);
    expect(cddb.collections[1].data.length).toEqual(1);
    expect(cddb.collections[1].data[0].a).toEqual(ddb.collections[1].data[0].a);
  });

  // Destructuring Formats :
  // D : one big Delimited string { partitioned: false, delimited : true }
  // DA : Delimited Array of strings [0] db [1] collection [n] collection { partitioned: true, delimited: true }
  // NDA : Non-Delimited Array : one iterable array with empty string collection partitions { partitioned: false, delimited: false }
  // NDAA : Non-Delimited Array with subArrays. db at [0] and collection subarrays at [n] { partitioned: true, delimited : false }

  it('verify custom destructuring works as expected', function() {
    var methods = ['D', 'DA', 'NDA', 'NDAA'];
    var idx, options, result;
    var cddb, ddb = new loki("test.db");
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

    var coll2 = ddb.addCollection("another");
    coll2.insert({
      a: 1,
      b: 2
    });

    for(idx=0; idx < methods.length; idx++) {
      switch (idx) {
        case 'D' : options = { partitioned: false, delimited : true }; break;
        case 'DA' : options = { partitioned: true, delimited: true }; break;
        case 'NDA' : options = { partitioned: false, delimited: false }; break;
        case 'NDAA' : options = { partitioned: true, delimited : false }; break;
        default : options = {}; break;
      }

      // do custom destructuring
      result = ddb.serializeDestructured(options);

      // reinflate from custom destructuring
      var cddb = new loki("test.db");
      var reinflatedDatabase = cddb.deserializeDestructured(result, options);
      cddb.loadJSONObject(reinflatedDatabase);

      // assert expectations on reinflated database
      expect(cddb.collections.length).toEqual(2);
      expect(cddb.collections[0].data.length).toEqual(3);
      expect(cddb.collections[0].data[0].val).toEqual(ddb.collections[0].data[0].val);
      expect(cddb.collections[0].data[0].$loki).toEqual(ddb.collections[0].data[0].$loki);
      expect(cddb.collections[0].data[2].$loki).toEqual(ddb.collections[0].data[2].$loki);
      expect(cddb.collections[1].data.length).toEqual(1);
      expect(cddb.collections[1].data[0].a).toEqual(ddb.collections[1].data[0].a);
    }
  });

  it('verify individual partitioning works correctly', function() {
    var idx, options, result;
    var cddb, ddb = new loki("test.db");
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

    var coll2 = ddb.addCollection("another");
    coll2.insert({
      a: 1,
      b: 2
    });

    // Verify db alone works correctly using NDAA format
    result = ddb.serializeDestructured({
      partitioned: true, 
      delimited : false,
      partition: -1 // indicates to get serialized db container only
    });
    
    var cddb = new loki('test');
    cddb.loadJSON(result);

    expect(cddb.collections.length).toEqual(2);
    expect(cddb.collections[0].data.length).toEqual(0);    
    expect(cddb.collections[1].data.length).toEqual(0);    
    expect(cddb.collections[0].name).toEqual(ddb.collections[0].name);
    expect(cddb.collections[1].name).toEqual(ddb.collections[1].name);

    // Verify collection alone works correctly using NDAA format
    result = ddb.serializeDestructured({
      partitioned: true, 
      delimited : false,
      partition: 0 // collection [0] only
    });

    // we dont need to test all components of reassembling whole database
    // so we will just call helper function to deserialize just collection data
    var data = ddb.deserializeCollection(result, { partitioned: true, delimited : false });

    expect(data.length).toEqual(ddb.collections[0].data.length);
    expect(data[0].val).toEqual(ddb.collections[0].data[0].val);
    expect(data[1].val).toEqual(ddb.collections[0].data[1].val);
    expect(data[2].val).toEqual(ddb.collections[0].data[2].val);
    expect(data[0].$loki).toEqual(ddb.collections[0].data[0].$loki);
    expect(data[1].$loki).toEqual(ddb.collections[0].data[1].$loki);
    expect(data[2].$loki).toEqual(ddb.collections[0].data[2].$loki);

    // Verify collection alone works correctly using DA format (the other partitioned format)
    result = ddb.serializeDestructured({
      partitioned: true, 
      delimited : true,
      partition: 0 // collection [0] only
    });

    // now reinflate from that interim DA format
    data = ddb.deserializeCollection(result, { partitioned: true, delimited: true });

    expect(data.length).toEqual(ddb.collections[0].data.length);
    expect(data[0].val).toEqual(ddb.collections[0].data[0].val);
    expect(data[1].val).toEqual(ddb.collections[0].data[1].val);
    expect(data[2].val).toEqual(ddb.collections[0].data[2].val);
    expect(data[0].$loki).toEqual(ddb.collections[0].data[0].$loki);
    expect(data[1].$loki).toEqual(ddb.collections[0].data[1].$loki);
    expect(data[2].$loki).toEqual(ddb.collections[0].data[2].$loki);
  });

});

