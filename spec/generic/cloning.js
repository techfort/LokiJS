if (typeof (window) === 'undefined') var loki = require('../../src/lokijs.js');

describe('cloning behavior', function () {
  beforeEach(function () {
    db = new loki('cloningDisabled'),
    items = db.addCollection('items');

    items.insert({ name : 'mjolnir', owner: 'thor', maker: 'dwarves' });
    items.insert({ name : 'gungnir', owner: 'odin', maker: 'elves' });
    items.insert({ name : 'tyrfing', owner: 'Svafrlami', maker: 'dwarves' });
    items.insert({ name : 'draupnir', owner: 'odin', maker: 'elves' });
  });

  describe('cloning disabled', function() {
    it('works', function () {

      var mj = items.findOne({ name: 'mjolnir'});

      // you are modifying the actual object instance so this is worst case
      // where you modify that object and dont even call update().
      // this is not recommended, you should definately call update after modifying an object.
      mj.maker = "the dwarves";

      var mj2 = items.findOne({ name: 'mjolnir'});

      expect(mj2.maker).toBe("the dwarves");
    });
  });

  describe('cloning inserts are immutable', function() {
    it('works', function() {
      var cdb = new loki('clonetest');
      var citems = cdb.addCollection('items', { clone: true });
      var oldObject = { name: 'mjolnir', owner: 'thor', maker: 'dwarves' };
      var insObject = citems.insert(oldObject);

      // cant' have either of these polluting our collection
      oldObject.name = 'mewmew';
      insObject.name = 'mewmew';

      var result = citems.findOne({'owner': 'thor'});

      expect(result.name).toBe("mjolnir");
    });
  });

  describe('cloning updates are immutable', function() {
    it('works', function() {
      var cdb = new loki('clonetest');
      var citems = cdb.addCollection('items', { clone: true });
      var oldObject = { name: 'mjolnir', owner: 'thor', maker: 'dwarves' };
      citems.insert(oldObject);
      var rObject = citems.findOne({'owner': 'thor'});
      
      // after all that, just do this to ensure internal ref is different
      citems.update(rObject); 
      
      // can't have this polluting our collection
      rObject.name = 'mewmew';
      
      var result = citems.findOne({'owner': 'thor'});

      expect(result.name).toBe("mjolnir");
    });
  });
  
  describe('collection find() cloning works', function() {
    it('works', function () {
      var cdb = new loki('cloningEnabled');
      var citems = db.addCollection('items', {
        clone: true
        //, clonemethod: "parse-stringify"
      });

      citems.insert({ name : 'mjolnir', owner: 'thor', maker: 'dwarves' });
      citems.insert({ name : 'gungnir', owner: 'odin', maker: 'elves' });
      citems.insert({ name : 'tyrfing', owner: 'Svafrlami', maker: 'dwarves' });
      citems.insert({ name : 'draupnir', owner: 'odin', maker: 'elves' });

      // just to prove that resultset.data() is not giving the user the actual object reference we keep internally
      // we will modify the object and see if future requests for that object show the change
      var mj = citems.find({ name: 'mjolnir' })[0];
      mj.maker = "the dwarves";

      var mj2 = citems.find({ name: 'mjolnir' })[0];

      expect(mj2.maker).toBe("dwarves");
    });
  });

  describe('collection findOne() cloning works', function() {
    it('works', function () {
      var cdb = new loki('cloningEnabled');
      var citems = db.addCollection('items', {
        clone: true
        //, clonemethod: "parse-stringify"
      });

      citems.insert({ name : 'mjolnir', owner: 'thor', maker: 'dwarves' });
      citems.insert({ name : 'gungnir', owner: 'odin', maker: 'elves' });
      citems.insert({ name : 'tyrfing', owner: 'Svafrlami', maker: 'dwarves' });
      citems.insert({ name : 'draupnir', owner: 'odin', maker: 'elves' });

      // just to prove that resultset.data() is not giving the user the actual object reference we keep internally
      // we will modify the object and see if future requests for that object show the change
      var mj = citems.findOne({ name: 'mjolnir' });
      mj.maker = "the dwarves";

      var mj2 = citems.findOne({ name: 'mjolnir' });

      expect(mj2.maker).toBe("dwarves");
    });
  });

  describe('collection where() cloning works', function() {
    it('works', function () {
      var cdb = new loki('cloningEnabled');
      var citems = db.addCollection('items', {
        clone: true
        //, clonemethod: "parse-stringify"
      });

      citems.insert({ name : 'mjolnir', owner: 'thor', maker: 'dwarves' });
      citems.insert({ name : 'gungnir', owner: 'odin', maker: 'elves' });
      citems.insert({ name : 'tyrfing', owner: 'Svafrlami', maker: 'dwarves' });
      citems.insert({ name : 'draupnir', owner: 'odin', maker: 'elves' });

      // just to prove that resultset.data() is not giving the user the actual object reference we keep internally
      // we will modify the object and see if future requests for that object show the change
      var mj = citems.where(function(obj) {
        return obj.name === 'mjolnir' ;
      })[0];
      mj.maker = "the dwarves";

      var mj2 = citems.where(function(obj) {
        return obj.name === 'mjolnir' ;
      })[0];

      expect(mj2.maker).toBe("dwarves");
    });
  });

  describe('collection by() cloning works', function() {
    it('works', function () {
      var cdb = new loki('cloningEnabled');
      var citems = db.addCollection('items', {
        clone: true,
        unique: ['name']
        //, clonemethod: "parse-stringify"
      });

      citems.insert({ name : 'mjolnir', owner: 'thor', maker: 'dwarves' });
      citems.insert({ name : 'gungnir', owner: 'odin', maker: 'elves' });
      citems.insert({ name : 'tyrfing', owner: 'Svafrlami', maker: 'dwarves' });
      citems.insert({ name : 'draupnir', owner: 'odin', maker: 'elves' });

      // just to prove that resultset.data() is not giving the user the actual object reference we keep internally
      // we will modify the object and see if future requests for that object show the change
      var mj = citems.by("name", "mjolnir");
      mj.maker = "the dwarves";

      var mj2 = citems.by("name", "mjolnir");

      expect(mj2.maker).toBe("dwarves");
    });
  });

  describe('resultset data cloning works', function() {
    it('works', function () {
      var cdb = new loki('cloningEnabled');
      var citems = db.addCollection('items', {
        clone: true
        //, clonemethod: "parse-stringify"
      });

      citems.insert({ name : 'mjolnir', owner: 'thor', maker: 'dwarves' });
      citems.insert({ name : 'gungnir', owner: 'odin', maker: 'elves' });
      citems.insert({ name : 'tyrfing', owner: 'Svafrlami', maker: 'dwarves' });
      citems.insert({ name : 'draupnir', owner: 'odin', maker: 'elves' });

      // just to prove that resultset.data() is not giving the user the actual object reference we keep internally
      // we will modify the object and see if future requests for that object show the change
      var mj = citems.chain().find({ name: 'mjolnir' }).data()[0];
      mj.maker = "the dwarves";

      var mj2 = citems.findOne({ name: 'mjolnir' });

      expect(mj2.maker).toBe("dwarves");
    });
  });

  describe('resultset data forced cloning works', function() {
    it('works', function () {
      // although our collection does not define cloning, we can choose to clone results
      // within resultset.data() options
      var mj = items.chain().find({ name: 'mjolnir' }).data({
        forceClones: true
        //,forceCloneMethod: 'parse-stringify'
      })[0];
      mj.maker = "the dwarves";

      var mj2 = items.findOne({ name: 'mjolnir' });

      expect(mj2.maker).toBe("dwarves");
    });
  });


});