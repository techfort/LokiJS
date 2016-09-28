if (typeof (window) === 'undefined') var loki = require('../../src/lokijs.js');

describe('binary indices', function () {
  beforeEach(function () {
    testRecords = [
      { name : 'mjolnir', owner: 'thor', maker: 'dwarves' },
      { name : 'gungnir', owner: 'odin', maker: 'elves' },
      { name : 'tyrfing', owner: 'Svafrlami', maker: 'dwarves' },
      { name : 'draupnir', owner: 'odin', maker: 'elves' }
    ];
  });

  describe('index maintained across inserts', function() {
    it('works', function () {

      var db = new loki('idxtest');
      var items = db.addCollection('users', { indices: ['name'] });
      items.insert(testRecords);

      // force index build
      items.find({ name: 'mjolnir'});
      
      var bi = items.binaryIndices.name;
      expect(bi.values.length).toBe(4);
      expect(bi.values[0]).toBe(3);
      expect(bi.values[1]).toBe(1);
      expect(bi.values[2]).toBe(0);
      expect(bi.values[3]).toBe(2);
      
      items.insert({ name : 'gjallarhorn', owner: 'heimdallr', maker: 'Gjöll' });
      
      // force index build
      items.find({ name: 'mjolnir'});

      // reaquire values array
      bi = items.binaryIndices.name;

      expect(bi.values[0]).toBe(3);
      expect(bi.values[1]).toBe(4);
      expect(bi.values[2]).toBe(1);
      expect(bi.values[3]).toBe(0);
      expect(bi.values[4]).toBe(2);
    });
  });

  describe('index maintained across removes', function() {
    it('works', function () {

      var db = new loki('idxtest');
      var items = db.addCollection('users', { indices: ['name'] });
      items.insert(testRecords);

      // force index build
      items.find({ name: 'mjolnir'});
      
      var bi = items.binaryIndices.name;
      expect(bi.values.length).toBe(4);
      expect(bi.values[0]).toBe(3);
      expect(bi.values[1]).toBe(1);
      expect(bi.values[2]).toBe(0);
      expect(bi.values[3]).toBe(2);
      
      var tyrfing = items.findOne({name: 'tyrfing'});
      items.remove(tyrfing);
      
      // force index build
      items.find({ name: 'mjolnir'});

      // reaquire values array
      bi = items.binaryIndices.name;

      // values are data array positions which should be collapsed, decrementing all index positions after the deleted 
      expect(bi.values[0]).toBe(2);
      expect(bi.values[1]).toBe(1);
      expect(bi.values[2]).toBe(0);
    });
  });

  describe('index maintained across updates', function() {
    it('works', function () {

      var db = new loki('idxtest');
      var items = db.addCollection('users', { indices: ['name'] });
      items.insert(testRecords);

      // force index build
      items.find({ name: 'mjolnir'});
      
      var bi = items.binaryIndices.name;
      expect(bi.values.length).toBe(4);
      expect(bi.values[0]).toBe(3);
      expect(bi.values[1]).toBe(1);
      expect(bi.values[2]).toBe(0);
      expect(bi.values[3]).toBe(2);
      
      var tyrfing = items.findOne({name: 'tyrfing'});
      tyrfing.name = 'etyrfing';
      items.update(tyrfing);
      
      // force index build
      items.find({ name: 'mjolnir'});

      // reaquire values array
      bi = items.binaryIndices.name;

      expect(bi.values[0]).toBe(3);
      expect(bi.values[1]).toBe(2);
      expect(bi.values[2]).toBe(1);
      expect(bi.values[3]).toBe(0);
    });
  });

  describe('positional lookup using get works', function() {
    it('works', function () {

      // Since we use coll.get's ability to do a positional lookup of a loki id during adaptive indexing we will test it here
      
      // let's base this off of our 'remove' test so data is more meaningful
      
      var db = new loki('idxtest');
      var items = db.addCollection('users', { indices: ['name'] });
      items.insert(testRecords);

      // force index build
      items.find({ name: 'mjolnir'});
      
      var item, dataPosition;

      var item = items.findOne({name: 'tyrfing'});
      items.remove(item);
      
      item = items.findOne({name: 'draupnir'});
      dataPosition = items.get(item.$loki, true);
      expect(dataPosition[1]).toBe(2);
      
      item = items.findOne({name: 'gungnir'});
      dataPosition = items.get(item.$loki, true);
      expect(dataPosition[1]).toBe(1);
      
      item = items.findOne({name: 'mjolnir'});
      dataPosition = items.get(item.$loki, true);
      expect(dataPosition[1]).toBe(0);
    });
  });

  describe('positional index lookup using getBinaryIndexPosition works', function() {
    it('works', function () {

      // Since our indexes contain -not loki id values- but coll.data[] positions
      // we shall verify our getBinaryIndexPosition method's ability to look up an 
      // index value based on data array position function (obtained via get)
      
      var db = new loki('idxtest');
      var items = db.addCollection('users', { indices: ['name'] });
      items.insert(testRecords);

      // force index build
      items.find({ name: 'mjolnir'});

      // tyrfing should be in coll.data[2] since it was third added item and we have not deleted yet
      var pos = items.getBinaryIndexPosition(2, 'name');
      // yet in our index it should be fourth (array index 3) since sorted alphabetically
      expect(pos).toBe(3);
      
      // now remove draupnir
      var draupnir = items.findOne({ name: 'draupnir' });
      items.remove(draupnir);
      
      // force index build
      items.find({ name: 'mjolnir'});

      // tyrfing should be in coll.data[2] since it was third added item and we have not deleted yet
      var pos = items.getBinaryIndexPosition(2, 'name');
      // yet in our index it should be now be third (array index 2) 
      expect(pos).toBe(2);
      
    });
  });

  describe('calculateRangeStart works for inserts', function() {
    it('works', function () {

      // calculateRangeStart is helper function for adaptive inserts/updates
      // we will use it to find position within index where (new) nonexistent value should be inserted into index
      
      var db = new loki('idxtest');
      var items = db.addCollection('users', { indices: ['name'] });
      items.insert(testRecords);

      // force index build
      items.find({ name: 'mjolnir'});

      // where would a new item with name of 'fff' be inserted into index?
      var rs = items.chain();

      var pos = rs.calculateRangeStart('name', 'fff');
      expect(pos).toBe(1);

      var pos = rs.calculateRangeStart('name', 'zzz');
      expect(pos).toBe(4);

      var pos = rs.calculateRangeStart('name', 'aaa');
      expect(pos).toBe(0);

      var pos = rs.calculateRangeStart('name', 'gungnir');
      expect(pos).toBe(1);
    });
  });

  describe('adaptiveBinaryIndexInsert works', function() {
    it('works', function () {

      // Since we use coll.get's ability to do a positional lookup of a loki id during adaptive indexing we will test it here
      
      // let's base this off of our 'remove' test so data is more meaningful
      
      var db = new loki('idxtest');
      var items = db.addCollection('users', { indices: ['name'] });
      items.insert(testRecords);

      // force index build
      items.find({ name: 'mjolnir'});

      // we know this will go in coll.data[4] as fifth document
      items.insert({
        name: 'fff'
      });
      
      items.adaptiveBinaryIndexInsert(4, "name");

      expect(items.binaryIndices.name.values[0]).toBe(3);  // draupnir at index position 0 and data[] position 3 (same as old)
      expect(items.binaryIndices.name.values[1]).toBe(4);  // fff at index position 1 and data[] position 4 (now)
      expect(items.binaryIndices.name.values[2]).toBe(1);  // gungnir at index position 2 (now) and data[] position 1
      expect(items.binaryIndices.name.values[3]).toBe(0);  // mjolnir at index position 3 (now) and data[] position 0 
      expect(items.binaryIndices.name.values[4]).toBe(2);  // tyrfing at index position 4 (now) and data[] position 2
    });
  });

  describe('adaptiveBinaryIndexUpdate works', function() {
    it('works', function () {

      var db = new loki('idxtest');
      var items = db.addCollection('users', { 
        indices: ['name'] 
      });
      items.insert(testRecords);

      // force index build
      items.find({ name: 'mjolnir'});

      expect(items.binaryIndices.name.values[0]).toBe(3);  
      expect(items.binaryIndices.name.values[1]).toBe(1);  
      expect(items.binaryIndices.name.values[2]).toBe(0);  
      expect(items.binaryIndices.name.values[3]).toBe(2);  
      
      // for this test, just update gungnir directly in collection.data
      items.data[1].name = 'ygungnir';
      
      // renegotiate index position of 2nd data element (ygungnir) within name index
      items.adaptiveBinaryIndexUpdate(1, "name");

      expect(items.binaryIndices.name.values[0]).toBe(3);  
      expect(items.binaryIndices.name.values[1]).toBe(0);  
      expect(items.binaryIndices.name.values[2]).toBe(2);  
      expect(items.binaryIndices.name.values[3]).toBe(1);  
    });
  });

  describe('adaptiveBinaryIndexRemove works', function() {
    it('works', function () {

      // Since we use coll.get's ability to do a positional lookup of a loki id during adaptive indexing we will test it here
      
      // let's base this off of our 'remove' test so data is more meaningful
      
      var db = new loki('idxtest');
      var items = db.addCollection('users', { indices: ['name'] });
      items.insert(testRecords);

      // force index build
      items.find({ name: 'mjolnir'});

      // at this point lets break convention and use internal method directly, without calling higher level remove() to remove
      // from both data[] and index[].  We are not even removing from data we are just testing adaptiveBinaryIndexRemove as if we did/will.
      
      // lets 'remove' gungnir (which is in data array position 1) from our 'name' index
      items.adaptiveBinaryIndexRemove(1, "name");

      // should only be three index array elements now (ordered by name)
      expect(items.binaryIndices.name.values[0]).toBe(2);  // draupnir at index position 0 and data[] position 2 (now)
      expect(items.binaryIndices.name.values[1]).toBe(0);  // mjolnir at index position 1 and data[] position 0
      expect(items.binaryIndices.name.values[2]).toBe(1);  // tyrfing at index position 2 and data[] position 1 (now)
    });
  });

});