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



});