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

  describe('dynamic view batch removes work as expected', function() {
    it('works', function() {
      var db = new loki('dvtest');
      var items = db.addCollection('users');
      var dv = items.addDynamicView('dv');
      dv.applyFind({a:1});

      items.insert([
        { a: 0, b:1 },
        { a: 1, b:2 },
        { a: 0, b:3 },
        { a: 1, b:4 },
        { a: 0, b:5 },
        { a: 1, b:6 },
        { a: 1, b:7 },
        { a: 1, b:8 },
        { a: 0, b:9 }
      ]);

      expect(dv.data().length).toEqual(5);

      items.findAndRemove({b: {$lt: 7}});

      expect(dv.data().length).toEqual(2);

      var results = dv.branchResultset().simplesort('b').data();

      expect(results[0].b).toEqual(7);
      expect(results[1].b).toEqual(8);
    });
  });

  describe('dynamic (persistent/sorted) view batch removes work as expected', function() {
    it('works', function() {
      var db = new loki('dvtest');
      var items = db.addCollection('users');
      var dv = items.addDynamicView('dv', { persistent: true });
      dv.applyFind({a:1});
      dv.applySimpleSort('b');

      items.insert([
        { a: 0, b:1 },
        { a: 1, b:2 },
        { a: 0, b:3 },
        { a: 1, b:4 },
        { a: 0, b:5 },
        { a: 1, b:6 },
        { a: 1, b:7 },
        { a: 1, b:8 },
        { a: 0, b:9 }
      ]);

      expect(dv.data().length).toEqual(5);

      items.findAndRemove({b: {$lt: 7}});

      var results = dv.data();
      expect(results.length).toEqual(2);
      expect(results[0].b).toEqual(7);
      expect(results[1].b).toEqual(8);
    });
  });

  describe('dynamic (persistent/sorted/indexed) view batch removes work as expected', function() {
    it('works', function() {
      var db = new loki('dvtest');
      var items = db.addCollection('users', { indices: ['b'] });
      var dv = items.addDynamicView('dv', { persistent: true });
      dv.applyFind({a:1});
      dv.applySimpleSort('b');

      items.insert([
        { a: 0, b:1 },
        { a: 1, b:2 },
        { a: 0, b:3 },
        { a: 1, b:4 },
        { a: 0, b:5 },
        { a: 1, b:6 },
        { a: 1, b:7 },
        { a: 1, b:8 },
        { a: 0, b:9 }
      ]);

      expect(dv.data().length).toEqual(5);

      items.findAndRemove({b: {$lt: 7}});

      var results = dv.data();
      expect(results.length).toEqual(2);
      expect(results[0].b).toEqual(7);
      expect(results[1].b).toEqual(8);
    });
  });

  describe('dynamic view rematerialize works as expected', function () {
    it('works', function() {
      var db = new loki('dvtest');
      var items = db.addCollection('users');
      items.insert(testRecords);
      var dv = items.addDynamicView();

      dv.applyFind({'owner': 'odin'});
      dv.applyWhere(function(obj) {
        return (obj.maker === 'elves');
      });

     expect(dv.data().length).toEqual(2);
     expect(dv.filterPipeline.length).toEqual(2);

     dv.rematerialize({ removeWhereFilters: true });
     expect(dv.data().length).toEqual(2);
     expect(dv.filterPipeline.length).toEqual(1);
    });
  });

  describe('dynamic view toJSON does not circularly reference', function () {
    it('works', function () {
      var db = new loki('dvtest');
      var items = db.addCollection('users');
      items.insert(testRecords);
      var dv = items.addDynamicView();

      var obj = dv.toJSON();
      expect (obj.collection).toEqual(null);
    });
  });

  describe('dynamic view removeFilters works as expected', function () {
    it('works', function() {
      var db = new loki('dvtest');
      var items = db.addCollection('users');
      items.insert(testRecords);
      var dv = items.addDynamicView("ownr");

      dv.applyFind({'owner': 'odin'});
      dv.applyWhere(function(obj) {
        return (obj.maker === 'elves');
      });

     expect(dv.filterPipeline.length).toEqual(2);
     expect(dv.data().length).toEqual(2);

     dv.removeFilters();
     expect(dv.filterPipeline.length).toEqual(0);
     expect(dv.count()).toEqual(4);
    });
  });

  describe('removeDynamicView works correctly', function () {
    it('works', function() {
      var db = new loki('dvtest');
      var items = db.addCollection('users');
      items.insert(testRecords);
      var dv = items.addDynamicView("ownr", { persistent: true });

      dv.applyFind({'owner': 'odin'});
      dv.applyWhere(function(obj) {
        return (obj.maker === 'elves');
      });

     expect(items.DynamicViews.length).toEqual(1);

     items.removeDynamicView('ownr');
     expect(items.DynamicViews.length).toEqual(0);
    });
  });

  describe('removeDynamicView works correctly (2)', function () {
    it("works", function() {
      var db = new loki('test.db');
      var coll = db.addCollection('coll');
      coll.addDynamicView('dv1');
      coll.addDynamicView('dv2');
      coll.addDynamicView('dv3');
      coll.addDynamicView('dv4');
      coll.addDynamicView('dv5');

      expect (coll.DynamicViews.length).toEqual(5);
      coll.removeDynamicView('dv3');
      expect(coll.DynamicViews.length).toEqual(4);

      expect(coll.getDynamicView("dv1").name).toEqual("dv1");
      expect(coll.getDynamicView("dv2").name).toEqual("dv2");
      expect(coll.getDynamicView("dv3")).toEqual(null);
      expect(coll.getDynamicView("dv4").name).toEqual("dv4");
      expect(coll.getDynamicView("dv5").name).toEqual("dv5");
    });
  });

  describe('dynamic view simplesort options work correctly', function () {
    it('works', function() {
      var db = new loki('dvtest.db');
      var coll = db.addCollection('colltest', { indices : ['a', 'b'] });

      // add basic dv with filter on a and basic simplesort on b
      var dv = coll.addDynamicView('dvtest');
      dv.applyFind({a: { $lte: 20 }});
      dv.applySimpleSort("b");

      // data only needs to be inserted once since we are leaving collection intact while
      // building up and tearing down dynamic views within it
      coll.insert([{a:1, b:11}, {a:2, b:9}, {a:8, b:3}, {a:6, b: 7}, {a:2, b:14}, {a:22, b: 1}]);

      // test whether results are valid
      var results = dv.data();
      expect(results.length).toBe(5);
      for (idx=0; idx<results.length-1; idx++) {
        expect(loki.LokiOps.$lte(results[idx]["b"], results[idx+1]["b"]));
      }

      // remove dynamic view
      coll.removeDynamicView("dvtest");

      // add basic dv with filter on a and simplesort (with js fallback) on b
      dv = coll.addDynamicView('dvtest');
      dv.applyFind({a: { $lte: 20 }});
      dv.applySimpleSort("b", { useJavascriptSorting: true });

      // test whether results are valid
      // for our simple integer datatypes javascript sorting is same as loki sorting
      var results = dv.data();
      expect(results.length).toBe(5);
      for (idx=0; idx<results.length-1; idx++) {
        expect(results[idx]["b"] <= results[idx+1]["b"]);
      }

      // remove dynamic view
      coll.removeDynamicView("dvtest");

      // add basic dv with filter on a and simplesort (forced js sort) on b
      dv = coll.addDynamicView('dvtest');
      dv.applyFind({a: { $lte: 20 }});
      dv.applySimpleSort("b", { disableIndexIntersect: true, useJavascriptSorting: true });

      // test whether results are valid
      var results = dv.data();
      expect(results.length).toBe(5);
      for (idx=0; idx<results.length-1; idx++) {
        expect(results[idx]["b"] <= results[idx+1]["b"]);
      }

      // remove dynamic view
      coll.removeDynamicView("dvtest");

      // add basic dv with filter on a and simplesort (forced loki sort) on b
      dv = coll.addDynamicView('dvtest');
      dv.applyFind({a: { $lte: 20 }});
      dv.applySimpleSort("b", { forceIndexIntersect: true });

      // test whether results are valid
      var results = dv.data();
      expect(results.length).toBe(5);
      for (idx=0; idx<results.length-1; idx++) {
        expect(loki.LokiOps.$lte(results[idx]["b"], results[idx+1]["b"]));
      }
    });
  });

  describe('querying branched result set', function () {
    var elves;
    beforeAll(function () {
      var db = new loki('firstonly.db');
      var items = db.addCollection('items');
      items.insert({ name: 'mjolnir', owner: 'thor', maker: 'dwarves' });
      items.insert({ name: 'gungnir', owner: 'odin', maker: 'elves' });
      items.insert({ name: 'tyrfing', owner: 'Svafrlami', maker: 'dwarves' });
      items.insert({ name: 'draupnir', owner: 'odin', maker: 'elves' });

      elves = items.addDynamicView('elves');
      elves.applyFind({ maker: 'elves' });
    });

    it('finds first result with firstOnly: true', function () {
      var resultset = elves.branchResultset();
      var result = resultset.find({ name: { $ne: 'thor' } }, true).data();
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('gungnir');
    });

    it('finds first result with firstOnly: true and empty query', function () {
      var resultset = elves.branchResultset();
      var result = resultset.find({}, true).data();
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('gungnir');
    });
  });
});
