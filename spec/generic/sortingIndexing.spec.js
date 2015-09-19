if (typeof (window) === 'undefined') var loki = require('../../src/lokijs.js');

describe('sorting and indexing', function () {
  beforeEach(function () {
    db = new loki('sortingIndexingTest'),
    items = db.addCollection('items');

    items.insert({ name : 'mjolnir', owner: 'thor', maker: 'dwarves' });
    items.insert({ name : 'gungnir', owner: 'odin', maker: 'elves' });
    items.insert({ name : 'tyrfing', owner: 'Svafrlami', maker: 'dwarves' });
    items.insert({ name : 'draupnir', owner: 'odin', maker: 'elves' });
  });

  describe('resultset simplesort', function() {
    it('works', function () {
      var rss = db.addCollection('rssort');
      
      rss.insert({ a: 4, b: 2 });
      rss.insert({ a: 7, b: 1 });
      rss.insert({ a: 3, b: 4 });
      rss.insert({ a: 9, b: 5 });

      var results = rss.chain().simplesort('a').data();
      expect(results[0].a).toBe(3);
      expect(results[1].a).toBe(4);
      expect(results[2].a).toBe(7);
      expect(results[3].a).toBe(9);
    });
  });

  describe('resultset simplesort with dates', function() {
    it('works', function() {
      var now = new Date().getTime();
      var dt1 = new Date(now - 1000);
      var dt2 = new Date(now + 5000);
      var dt3 = new Date(2000, 6, 1);
      var dt4 = new Date(now + 2000);
      var dt5 = new Date(now - 3000);

      var rss = db.addCollection('rssort');
      
      rss.insert({ a: 1, b: dt1 });
      rss.insert({ a: 2, b: dt2 });
      rss.insert({ a: 3, b: dt3 });
      rss.insert({ a: 4, b: dt4 });
      rss.insert({ a: 5, b: dt5 });

      var results = rss.chain().simplesort('b').data();
      expect(results[0].a).toBe(3);
      expect(results[1].a).toBe(5);
      expect(results[2].a).toBe(1);
      expect(results[3].a).toBe(4);
      expect(results[4].a).toBe(2);
    });
  });

  describe('collection indexing', function() {
    it('works', function() {
      var now = new Date().getTime();
      var dt1 = new Date(now - 1000);
      var dt2 = new Date(now + 5000);
      var dt3 = new Date(2000, 6, 1);
      var dt4 = new Date(now + 2000);
      var dt5 = new Date(now - 3000);

      var cidx = db.addCollection('collidx', { indices : ['b']});
      
      cidx.insert({ a: 1, b: dt1 });
      cidx.insert({ a: 2, b: dt2 });
      cidx.insert({ a: 3, b: dt3 });
      cidx.insert({ a: 4, b: dt4 });
      cidx.insert({ a: 5, b: dt5 });

      // force index build while simultaneously testing date equality test
      var results = cidx.find({'b': dt2 });
      expect(results[0].a).toBe(2);

      // now search for date value equal to dt2 (yet separate object instances)
      // this should not work when using the default $eq
      var sdt = new Date(now + 5000);
      results = cidx.find({'b': sdt});
      expect(results.length).toBe(0);

      // now try with new $dteq operator
      results = cidx.find({'b': {'$dteq': sdt}});
      expect(results.length).toBe(1);
      expect(results[0].a).toBe(2);

      // now verify indices
      // they are array of 'positions' so both array index and value are zero based
      expect(cidx.binaryIndices.b.values[0]).toBe(2);
      expect(cidx.binaryIndices.b.values[1]).toBe(4);
      expect(cidx.binaryIndices.b.values[2]).toBe(0);
      expect(cidx.binaryIndices.b.values[3]).toBe(3);
      expect(cidx.binaryIndices.b.values[4]).toBe(1);
    });
  });

});