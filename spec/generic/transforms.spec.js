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

  describe('eqJoin step with dataOptions works', function() {
    it('works', function () {
      var db1 = new loki('testJoins');
            
      var directors = db1.addCollection('directors');
      var films = db1.addCollection('films');

      directors.insert([
      { name: 'Martin Scorsese', directorId: 1 }, 
      { name: 'Francis Ford Coppola', directorId: 2 }, 
      { name: 'Steven Spielberg', directorId: 3}, 
      { name: 'Quentin Tarantino', directorId: 4}
      ]);

      films.insert([
      { title: 'Taxi', filmId: 1, directorId: 1}, 
      { title: 'Raging Bull', filmId: 2, directorId: 1 }, 
      { title: 'The Godfather', filmId: 3, directorId: 2 }, 
      { title: 'Jaws', filmId: 4, directorId: 3 }, 
      { title: 'ET', filmId: 5, directorId: 3 }, 
      { title: 'Raiders of the Lost Ark', filmId: 6, directorId: 3 }
      ]);

      // Since our collection options do not specify cloning, this is only safe 
      // because we have cloned internal objects with dataOptions before modifying them.
      function fdmap(left, right) {
        // PhantomJS does not support es6 Object.assign
        //left = Object.assign(left, right);
        Object.keys(right).forEach(function(key) {
          left[key] = right[key];
        });
        return left;
      }

      // The 'joinData' in this instance is a Collection which we will call
      //   data() on with the specified (optional) dataOptions on.
      //   It could also be a resultset or data array.
      // Our left side resultset which this transform is executed on will also 
      //   call data() with specified (optional) dataOptions.
      films.addTransform("filmdirect", [
        { 
          type: 'eqJoin',
          joinData: directors,
          leftJoinKey: 'directorId',
          rightJoinKey: 'directorId',
          mapFun: fdmap,
          dataOptions: { removeMeta: true}
        }
      ]);

      // Although we removed all meta, the eqjoin inserts the resulting objects
      // into a new volatile collection which would adds its own meta and loki.
      // We don't care about these useless volatile data so grab results without it.
      var results = films.chain("filmdirect").data({ removeMeta: true });
      
      expect(results.length).toEqual(6);
      expect(results[0].title).toEqual('Taxi');
      expect(results[0].name).toEqual('Martin Scorsese');
      expect(results[5].title).toEqual('Raiders of the Lost Ark');
      expect(results[5].name).toEqual('Steven Spielberg');
      results.forEach(function(obj) {
        expect(Object.keys(obj).length).toEqual(4);
      });
    });
  });

  describe('map step with dataOptions works', function () {
    it('works', function () {
      var db1 = new loki('testJoins');
            
      var c1 = db1.addCollection('c1');
      c1.insert([{a:1, b:9}, {a:2, b:8}, {a:3, b:7}, {a:4, b:6}]);
      
      // only safe because our 'removeMeta' option will clone objects passed in
      function graftMap(obj) {
        obj.c = obj.b - obj.a;
        return obj;
      }
      
      var tx = [{
        type: 'map',
        value: graftMap,
        dataOptions: { removeMeta: true }
      }];
      
      var results = c1.chain(tx).data({removeMeta: true});
      
      expect(results.length).toEqual(4);
      expect(results[0].a).toEqual(1);
      expect(results[0].b).toEqual(9);
      expect(results[0].c).toEqual(8);
      expect(results[3].a).toEqual(4);
      expect(results[3].b).toEqual(6);
      expect(results[3].c).toEqual(2);
      results.forEach(function(obj) {
        expect(Object.keys(obj).length).toEqual(3);
      });
    });
  });
});