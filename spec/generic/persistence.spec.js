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

describe('testing adapter functionality', function () {
  it('verify basic memory adapter functionality works', function() {
    var idx, options, result;

    var memAdapter = new loki.LokiMemoryAdapter();
    var ddb = new loki("test.db", { adapter: memAdapter });

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

    ddb.saveDatabase(function(err) {
      expect(memAdapter.hashStore.hasOwnProperty("test.db")).toEqual(true);
      expect(memAdapter.hashStore["test.db"].savecount).toEqual(1);
    });
    
    // although we are mostly using callbacks, memory adapter is essentially synchronous with callbacks
    
    var cdb = new loki("test.db", { adapter: memAdapter });
    cdb.loadDatabase({}, function() {
      expect(cdb.collections.length).toEqual(2);
      expect(cdb.getCollection("testcoll").findOne({name:"test2"}).val).toEqual(101);
      expect(cdb.collections[0].data.length).toEqual(3);
      expect(cdb.collections[1].data.length).toEqual(1);
    });
    
  });

  it('verify partioning adapter works', function() {
    var mem = new loki.LokiMemoryAdapter();
    var adapter = new loki.LokiPartitioningAdapter(mem);

    var db = new loki('sandbox.db', {adapter: adapter});

    // Add a collection to the database
    var items = db.addCollection('items');
    items.insert({ name : 'mjolnir', owner: 'thor', maker: 'dwarves' });
    items.insert({ name : 'gungnir', owner: 'odin', maker: 'elves' });
    items.insert({ name : 'tyrfing', owner: 'Svafrlami', maker: 'dwarves' });
    items.insert({ name : 'draupnir', owner: 'odin', maker: 'elves' });

    var another = db.addCollection('another');
    var ai = another.insert({ a:1, b:2 });

    // for purposes of our memory adapter it is pretty much synchronous
    db.saveDatabase();

    // should have partitioned the data
    expect(Object.keys(mem.hashStore).length).toEqual(3);
    expect(mem.hashStore.hasOwnProperty("sandbox.db")).toEqual(true);
    expect(mem.hashStore.hasOwnProperty("sandbox.db.0")).toEqual(true);
    expect(mem.hashStore.hasOwnProperty("sandbox.db.1")).toEqual(true);
    // all partitions should have been saved once each
    expect(mem.hashStore["sandbox.db"].savecount).toEqual(1);
    expect(mem.hashStore["sandbox.db.0"].savecount).toEqual(1);
    expect(mem.hashStore["sandbox.db.1"].savecount).toEqual(1);

    // so let's go ahead and update one of our collections to make it dirty
    ai.b = 3;
    another.update(ai);

    // and save again to ensure lastsave is different on for db container and that one collection
    db.saveDatabase();

    // db container always gets saved since we currently have no 'dirty' flag on it to check
    expect(mem.hashStore["sandbox.db"].savecount).toEqual(2);
    // we didn't change this
    expect(mem.hashStore["sandbox.db.0"].savecount).toEqual(1);
    // we updated this collection so it should have been saved again
    expect(mem.hashStore["sandbox.db.1"].savecount).toEqual(2);

    // ok now lets load from it
    var db2 = new loki('sandbox.db', { adapter: adapter});
    db2.loadDatabase();

    expect(db2.collections.length).toEqual(2);
    expect(db2.collections[0].data.length).toEqual(4);
    expect(db2.collections[1].data.length).toEqual(1);
    expect(db2.getCollection("items").findOne({ name : 'gungnir'}).owner).toEqual("odin");
    expect(db2.getCollection("another").findOne({ a: 1}).b).toEqual(3);
  });

  it('verify partioning adapter with paging mode enabled works', function() {
    var mem = new loki.LokiMemoryAdapter();

    // we will use an exceptionally low page size (128bytes) to test with small dataset
    var adapter = new loki.LokiPartitioningAdapter(mem, { paging: true, pageSize: 128});

    var db = new loki('sandbox.db', {adapter: adapter});

    // Add a collection to the database
    var items = db.addCollection('items');
    items.insert({ name : 'mjolnir', owner: 'thor', maker: 'dwarves' });
    items.insert({ name : 'gungnir', owner: 'odin', maker: 'elves' });
    var tyr = items.insert({ name : 'tyrfing', owner: 'Svafrlami', maker: 'dwarves' });
    items.insert({ name : 'draupnir', owner: 'odin', maker: 'elves' });

    var another = db.addCollection('another');
    var ai = another.insert({ a:1, b:2 });

    // for purposes of our memory adapter it is pretty much synchronous
    db.saveDatabase();

    // should have partitioned the data
    expect(Object.keys(mem.hashStore).length).toEqual(4);
    expect(mem.hashStore.hasOwnProperty("sandbox.db")).toEqual(true);
    expect(mem.hashStore.hasOwnProperty("sandbox.db.0.0")).toEqual(true);
    expect(mem.hashStore.hasOwnProperty("sandbox.db.0.1")).toEqual(true);
    expect(mem.hashStore.hasOwnProperty("sandbox.db.1.0")).toEqual(true);
    // all partitions should have been saved once each
    expect(mem.hashStore["sandbox.db"].savecount).toEqual(1);
    expect(mem.hashStore["sandbox.db.0.0"].savecount).toEqual(1);
    expect(mem.hashStore["sandbox.db.0.1"].savecount).toEqual(1);
    expect(mem.hashStore["sandbox.db.1.0"].savecount).toEqual(1);

    // so let's go ahead and update one of our collections to make it dirty
    ai.b = 3;
    another.update(ai);

    // and save again to ensure lastsave is different on for db container and that one collection
    db.saveDatabase();

    // db container always gets saved since we currently have no 'dirty' flag on it to check
    expect(mem.hashStore["sandbox.db"].savecount).toEqual(2);
    // we didn't change this
    expect(mem.hashStore["sandbox.db.0.0"].savecount).toEqual(1);
    expect(mem.hashStore["sandbox.db.0.0"].savecount).toEqual(1);
    // we updated this collection so it should have been saved again
    expect(mem.hashStore["sandbox.db.1.0"].savecount).toEqual(2);

    // now update a multi page items collection and verify both pages were saved
    tyr.maker = "elves";
    items.update(tyr);
    db.saveDatabase();
    expect(mem.hashStore["sandbox.db"].savecount).toEqual(3);
    expect(mem.hashStore["sandbox.db.0.0"].savecount).toEqual(2);
    expect(mem.hashStore["sandbox.db.0.0"].savecount).toEqual(2);
    expect(mem.hashStore["sandbox.db.1.0"].savecount).toEqual(2);

    // ok now lets load from it
    var db2 = new loki('sandbox.db', { adapter: adapter});
    db2.loadDatabase();

    expect(db2.collections.length).toEqual(2);
    expect(db2.collections[0].data.length).toEqual(4);
    expect(db2.collections[1].data.length).toEqual(1);
    expect(db2.getCollection("items").findOne({ name : 'tyrfing'}).maker).toEqual("elves");
    expect(db2.getCollection("another").findOne({ a: 1}).b).toEqual(3);
    
    // verify empty collection saves with paging
    db.addCollection("extracoll");
    db.saveDatabase();
    expect(mem.hashStore["sandbox.db"].savecount).toEqual(4);
    expect(mem.hashStore["sandbox.db.0.0"].savecount).toEqual(2);
    expect(mem.hashStore["sandbox.db.0.0"].savecount).toEqual(2);
    expect(mem.hashStore["sandbox.db.1.0"].savecount).toEqual(2);
    expect(mem.hashStore["sandbox.db.2.0"].savecount).toEqual(1);

    // now verify loading empty collection works with paging codepath
    db2 = new loki('sandbox.db', { adapter: adapter});
    db2.loadDatabase();

    expect(db2.collections.length).toEqual(3);
    expect(db2.collections[0].data.length).toEqual(4);
    expect(db2.collections[1].data.length).toEqual(1);
    expect(db2.collections[2].data.length).toEqual(0);
    
  });

  it('verify reference adapters get db reference which is copy and serializable-safe', function() {
    // Current loki functionality with regards to reference mode adapters:
    // Since we don't use serializeReplacer on reference mode adapters, we make 
    // lightweight clone, cloning only db container and collection containers (object refs are same).
    
    function MyFakeReferenceAdapter() { this.mode = "reference" }
    
    MyFakeReferenceAdapter.prototype.loadDatabase = function(dbname, callback) {
      expect(typeof(dbname)).toEqual("string");
      expect(typeof(callback)).toEqual("function");
      
      var result = new loki("new db");
      var n1 = result.addCollection("n1");
      var n2 = result.addCollection("n2");
      n1.insert({m: 9, n: 8});
      n2.insert({m:7, n:6});
      
      callback(result);
    };
    
    MyFakeReferenceAdapter.prototype.exportDatabase = function(dbname, dbref, callback) {
      expect(typeof(dbname)).toEqual("string");
      expect(dbref.constructor.name).toEqual("Loki");
      expect(typeof(callback)).toEqual("function");

      expect(dbref.persistenceAdapter).toEqual(null);
      expect(dbref.collections.length).toEqual(2);
      expect(dbref.getCollection("c1").findOne({a:1}).b).toEqual(2);
      // these changes should not affect original database
      dbref.filename = "somethingelse";
      dbref.collections[0].name = "see1";
      // (accidentally?) updating a document should...
      dbref.collections[0].findOne({a:1}).b=3;
    };
    
    var adapter = new MyFakeReferenceAdapter();
    var db = new loki("rma test", {adapter: adapter});
    var c1 = db.addCollection("c1");
    var c2 = db.addCollection("c2");
    c1.insert({a:1, b:2});
    c2.insert({a:3, b:4});
    
    db.saveDatabase(function() {
      expect(db.persistenceAdapter).toNotEqual(null);
      expect(db.filename).toEqual("rma test");
      expect(db.collections[0].name).toEqual("c1");
      expect(db.getCollection("c1").findOne({a:1}).b).toEqual(3);
    });
    
    var db2 = new loki("other name", { adapter: adapter});
    db2.loadDatabase({}, function() {
      expect(db2.collections.length).toEqual(2);
      expect(db2.collections[0].name).toEqual("n1");
      expect(db2.collections[1].name).toEqual("n2");
      expect(db2.getCollection("n1").findOne({m:9}).n).toEqual(8);
    });
  });  
});

describe('testing changesAPI', function() {
  it('verify pending changes persist across save/load cycle', function() {
    var mem = new loki.LokiMemoryAdapter();
    var db = new loki('sandbox.db', { adapter: mem });

    // Add a collection to the database
    var items = db.addCollection('items', { disableChangesApi: false });

    // Add some documents to the collection
    items.insert({ name : 'mjolnir', owner: 'thor', maker: 'dwarves' });
    items.insert({ name : 'gungnir', owner: 'odin', maker: 'elves' });
    items.insert({ name : 'tyrfing', owner: 'Svafrlami', maker: 'dwarves' });
    items.insert({ name : 'draupnir', owner: 'odin', maker: 'elves' });

    // Find and update an existing document
    var tyrfing = items.findOne({'name': 'tyrfing'});
    tyrfing.owner = 'arngrim';
    items.update(tyrfing);

    // memory adapter is synchronous so i will not bother with callbacks
    db.saveDatabase();

    var db2 = new loki('sandbox.db', { adapter: mem });
    db2.loadDatabase({});

    var result = JSON.parse(db2.serializeChanges());
    expect(result.length).toEqual(5);

    expect(result[0].name).toEqual("items");
    expect(result[0].operation).toEqual("I");
    expect(result[0].obj.name).toEqual("mjolnir");

    expect(result[4].name).toEqual("items");
    expect(result[4].operation).toEqual("U");
    expect(result[4].obj.name).toEqual("tyrfing");
  });
});

