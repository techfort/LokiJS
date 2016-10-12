if (typeof (window) === 'undefined') var loki = require('../../src/lokijs.js');

describe('dynamicviews', function () {
  beforeEach(function () {
    testRecords = [
      { name : 'mjolnir', owner: 'thor', maker: 'dwarves' },
      { name : 'gungnir', owner: 'odin', maker: 'elves' },
      { name : 'tyrfing', owner: 'Svafrlami', maker: 'dwarves' },
      { name : 'draupnir', owner: 'odin', maker: 'elves' }
    ];
  });

  describe('test empty filter across changes', function() {
    it('works', function () {

      var db = new loki('dvtest');
      var items = db.addCollection('users');
      items.insert(testRecords);
      var dv = items.addDynamicView();

      // with no filter, results should be all documents
      var results = dv.data();
      expect(results.length).toBe(4);

      // find and update a document which will notify view to re-evaluate
      var gungnir = items.findOne({'name': 'gungnir'});
      expect(gungnir.owner).toBe('odin');
      gungnir.maker = 'dvalin';
      items.update(gungnir);

      results = dv.data();
      expect (results.length).toBe(4);
    });
  });

});