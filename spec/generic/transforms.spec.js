if (typeof (window) === 'undefined') var loki = require('../../src/lokijs.js');

describe('transforms', function () {
  beforeEach(function () {
    db = new loki('transformTest'),
    items = db.addCollection('items');

    items.insert({ name : 'mjolnir', owner: 'thor', maker: 'dwarves' });
    items.insert({ name : 'gungnir', owner: 'odin', maker: 'elves' });
    items.insert({ name : 'tyrfing', owner: 'Svafrlami', maker: 'dwarves' });
    items.insert({ name : 'draupnir', owner: 'odin', maker: 'elves' });
  });

  describe('basic find transform', function() {
    it('works', function () {

      var tx = [
        {
          type: 'find',
          value: {
            owner: 'odin'
          }
        }
      ];

      var results = items.chain(tx).data();

      expect(results.length).toBe(2);
    });
  });

  describe('basic multi-step transform', function() {
    it('works', function () {

      var tx = [
        {
          type: 'find',
          value: {
            owner: 'odin'
          }
        },
        {
          type: 'where',
          value: function(obj) {
            return (obj.name.indexOf("drau") !== -1);
          }
        }
      ];

      var results = items.chain(tx).data();

      expect(results.length).toBe(1);
    });
  });

  describe('parameterized find', function() {
    it('works', function () {

      var tx = [
        {
          type: 'find',
          value: {
            owner: '[%lktxp]OwnerName'
          }
        }
      ];

      var params = {
        OwnerName: 'odin'
      }

      var results = items.chain(tx, params).data();

      expect(results.length).toBe(2);
    });
  });

  describe('parameterized where', function() {
    it('works', function () {

      var tx = [
        {
          type: 'where',
          value: '[%lktxp]NameFilter'
        }
      ];

      var params = {
        NameFilter: function(obj) {
          return (obj.name.indexOf("nir") !== -1);
        }
      };

      var results = items.chain(tx, params).data();

      expect(results.length).toBe(3);
    });
  });

  describe('named find transform', function() {
    it('works', function () {

      var tx = [
        {
          type: 'find',
          value: {
            owner: '[%lktxp]OwnerName'
          }
        }
      ];

      items.addTransform("OwnerLookup", tx);

      var params = {
        OwnerName: 'odin'
      }

      var results = items.chain("OwnerLookup", params).data();

      expect(results.length).toBe(2);
    });
  });

  describe('dynamic view named transform', function() {
    it('works', function () {
      var testColl = db.addCollection('test');

      testColl.insert({
        a: 'first',
        b: 1
      });

      testColl.insert({
        a: 'second',
        b: 2
      });

      testColl.insert({
        a: 'third',
        b: 3
      });

      testColl.insert({
        a: 'fourth',
        b: 4
      });

      testColl.insert({
        a: 'fifth',
        b: 5
      });

      testColl.insert({
        a: 'sixth',
        b: 6
      });

      testColl.insert({
        a: 'seventh',
        b: 7
      });

      testColl.insert({
        a: 'eighth',
        b: 8
      });

      // our view should allow only first 4 test records
      var dv = testColl.addDynamicView('lower');
      dv.applyFind({ b : {'$lte' : 4 } });

      // our transform will desc sort string column as 'third', 'second', 'fourth', 'first',
      // and then limit to first two
      var tx = [
        {
          type: 'simplesort',
          property: 'a',
          desc: true
        },
        {
          type: 'limit',
          value: 2
        }
      ];

      expect(dv.branchResultset(tx).data().length).toBe(2);

      // now store as named (collection) transform and run off dynamic view
      testColl.addTransform("desc4limit2", tx);

      var results = dv.branchResultset("desc4limit2").data();

      expect(results.length).toBe(2);
      expect(results[0].a).toBe("third");
      expect(results[1].a).toBe("second");

    });
  });

});