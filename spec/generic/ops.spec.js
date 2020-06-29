if (typeof(window) === 'undefined') var loki = require('../../src/lokijs.js');

describe('Testing operators', function () {

  var db, tree;
  beforeEach(function() {
    db = new loki('testOps'),
    tree = db.addCollection('tree'),

    /*
     * The following data represents a tree that should look like this:
     *
     ├A
     ├B
     └───┐
         ├C
     ├D
     └───┐
         ├E
         ├F
     ├G
     └───┐
         ├H
         ├I
         └───┐
             ├J
             ├K
         ├L
         ├M
     ├N
     └───┐
         ├O
         ├P
         └───┐
             ├Q
             └───┐
                 ├R
                 └───┐
                     ├S
                 ├T
             ├U
         ├V
     ├W
     ├X
     └───┐
         ├Y
         ├Z
    *
    */

    tree.insert([
      { text: 'A', value: 'a', id: 1,  order: 1,  parents_id: [],               level: 0, open: true, checked: false },
      { text: 'B', value: 'b', id: 2,  order: 2,  parents_id: [],               level: 0, open: true, checked: false },
      { text: 'C', value: 'c', id: 3,  order: 3,  parents_id: [2],              level: 1, open: true, checked: false },
      { text: 'D', value: 'd', id: 4,  order: 4,  parents_id: [],               level: 0, open: true, checked: false },
      { text: 'E', value: 'e', id: 5,  order: 5,  parents_id: [4],              level: 1, open: true, checked: false },
      { text: 'F', value: 'f', id: 6,  order: 6,  parents_id: [4],              level: 1, open: true, checked: false },
      { text: 'G', value: 'g', id: 7,  order: 7,  parents_id: [],               level: 0, open: true, checked: false },
      { text: 'H', value: 'h', id: 8,  order: 8,  parents_id: [7],              level: 1, open: true, checked: false },
      { text: 'I', value: 'i', id: 9,  order: 9,  parents_id: [7],              level: 1, open: true, checked: false },
      { text: 'J', value: 'j', id: 10, order: 10, parents_id: [7, 9],           level: 2, open: true, checked: false },
      { text: 'K', value: 'k', id: 11, order: 11, parents_id: [7, 9],           level: 2, open: true, checked: false },
      { text: 'L', value: 'l', id: 12, order: 12, parents_id: [7],              level: 1, open: true, checked: false },
      { text: 'M', value: 'm', id: 13, order: 13, parents_id: [7],              level: 1, open: true, checked: false },
      { text: 'N', value: 'n', id: 14, order: 14, parents_id: [],               level: 0, open: true, checked: false },
      { text: 'O', value: 'o', id: 15, order: 15, parents_id: [14],             level: 1, open: true, checked: false },
      { text: 'P', value: 'p', id: 16, order: 16, parents_id: [14],             level: 1, open: true, checked: false },
      { text: 'Q', value: 'q', id: 17, order: 17, parents_id: [14, 16],         level: 2, open: true, checked: false },
      { text: 'R', value: 'r', id: 18, order: 18, parents_id: [14, 16, 17],     level: 3, open: true, checked: false },
      { text: 'S', value: 's', id: 19, order: 19, parents_id: [14, 16, 17, 18], level: 4, open: true, checked: false },
      { text: 'T', value: 't', id: 20, order: 20, parents_id: [14, 16, 17],     level: 3, open: true, checked: false },
      { text: 'U', value: 'u', id: 21, order: 21, parents_id: [14, 16],         level: 2, open: true, checked: false },
      { text: 'V', value: 'v', id: 22, order: 22, parents_id: [14],             level: 1, open: true, checked: false },
      { text: 'W', value: 'w', id: 23, order: 23, parents_id: [],               level: 0, open: true, checked: false },
      { text: 'X', value: 'x', id: 24, order: 24, parents_id: [],               level: 0, open: true, checked: false },
      { text: 'Y', value: 'y', id: 25, order: 25, parents_id: [24],             level: 1, open: true, checked: false },
      { text: 'Z', value: 'z', id: 26, order: 26, parents_id: [24],             level: 1, open: true, checked: false }
    ]);
  });

  it('$size works', function () {
	res = tree
      .chain()
      .find({
        'parents_id': {'$size': 4}
      })
    expect(res.data().length).toEqual(1);
    expect(res.data()[0].value).toEqual('s');
  });
});

describe("Individual operator tests", function() {

  var ops;
  beforeEach(function() {
    ops = loki.LokiOps;
  });

  it('$ne op works as expected', function () {
    expect(ops.$ne(15, 20)).toEqual(true);

    expect(ops.$ne(15, 15.0)).toEqual(false);

    expect(ops.$ne(0, "0")).toEqual(true);

    expect(ops.$ne(NaN, NaN)).toEqual(false);

    expect(ops.$ne("en", NaN)).toEqual(true);

    expect(ops.$ne(0, NaN)).toEqual(true);
  });

  it('misc eq ops works as expected', function() {
    expect(ops.$aeq(1,11)).toEqual(false);
    expect(ops.$aeq(1, '1')).toEqual(true);
    expect(ops.$aeq(undefined, null)).toEqual(true);

    var dt1 = new Date();
    var dt2 = new Date();
    dt2.setTime(dt1.getTime());
    var dt3 = new Date();
    dt3.setTime(dt1.getTime() - 10000);

    expect(ops.$dteq(dt1, dt2)).toEqual(true);
    expect(ops.$dteq(dt1, dt3)).toEqual(false);
  });

  it('$type op works as expected', function() {
    expect(ops.$type('test', 'string')).toEqual(true);
    expect(ops.$type(4, 'number')).toEqual(true);
    expect(ops.$type({a:1}, 'object')).toEqual(true);
    expect(ops.$type(new Date(), 'date')).toEqual(true);
    expect(ops.$type([1,2], 'array')).toEqual(true);

    expect(ops.$type('test', 'number')).toEqual(false);
    expect(ops.$type(4, 'string')).toEqual(false);
    expect(ops.$type({a:1}, 'date')).toEqual(false);
    expect(ops.$type(new Date(), 'object')).toEqual(false);
    expect(ops.$type([1,2], 'number')).toEqual(false);
  });

  it('$in op works as expected', function() {
    expect(ops.$in(4, [1, 2, 3, 4])).toEqual(true);
    expect(ops.$in(7, [1, 2, 3, 4])).toEqual(false);
    expect(ops.$in("el", "hello")).toEqual(true);
    expect(ops.$in("le", "hello")).toEqual(false);
  });

  it('$between op works as expected', function() {
    expect(ops.$between(75, [5, 100])).toEqual(true);
    expect(ops.$between(75, [75, 100])).toEqual(true);
    expect(ops.$between(75, [5, 75])).toEqual(true);
    expect(ops.$between(75, [5, 74])).toEqual(false);
    expect(ops.$between(75, [76, 100])).toEqual(false);
    expect(ops.$between(null, [5, 100])).toEqual(false);
  });

  it('$between find works as expected', function() {
    // test unindexed code path
    var db = new loki('db');
    var coll = db.addCollection('coll');
    coll.insert({ name : 'mjolnir', count: 73 });
    coll.insert({ name : 'gungnir', count: 5 });
    coll.insert({ name : 'tyrfing', count: 15 });
    coll.insert({ name : 'draupnir', count: 132 });

    // simple inner between
    var results = coll.chain().find({count: {$between: [10, 80]}}).simplesort('count').data();
    expect(results.length).toEqual(2);
    expect(results[0].count).toEqual(15);
    expect(results[1].count).toEqual(73);

    // range exceeds bounds
    results = coll.find({count: {$between: [100, 200]}});
    expect(results.length).toEqual(1);
    expect(results[0].count).toEqual(132);

    // no matches in range
    expect(coll.find({count: {$between: [133, 200]}}).length).toEqual(0);
    expect(coll.find({count: {$between: [1, 4]}}).length).toEqual(0);

    // multiple low and high bounds
    var db = new loki('db');
    var coll = db.addCollection('coll');
    coll.insert({ name : 'first', count: 5});
    coll.insert({ name : 'mjolnir', count: 15 });
    coll.insert({ name : 'gungnir', count: 15 });
    coll.insert({ name : 'tyrfing', count: 75 });
    coll.insert({ name : 'draupnir', count: 75 });
    coll.insert({ name : 'last', count: 100});

    results = coll.chain().find({count: {$between: [15, 75]}}).simplesort('count').data();
    expect(results.length).toEqual(4);
    expect(results[0].count).toEqual(15);
    expect(results[1].count).toEqual(15);
    expect(results[2].count).toEqual(75);
    expect(results[3].count).toEqual(75);

    expect(coll.find({count: {$between: [-1, 4]}}).length).toEqual(0);
    expect(coll.find({count: {$between: [-1, 5]}}).length).toEqual(1);
    expect(coll.find({count: {$between: [-1, 6]}}).length).toEqual(1);
    expect(coll.find({count: {$between: [99, 140]}}).length).toEqual(1);
    expect(coll.find({count: {$between: [100, 140]}}).length).toEqual(1);
    expect(coll.find({count: {$between: [101, 140]}}).length).toEqual(0);
    expect(coll.find({count: {$between: [12, 76]}}).length).toEqual(4);
    expect(coll.find({count: {$between: [20, 60]}}).length).toEqual(0);

    // now test -indexed- code path
    coll.ensureIndex('count');

    results = coll.chain().find({count: {$between: [15, 75]}}).simplesort('count').data();
    expect(results.length).toEqual(4);
    expect(results[0].count).toEqual(15);
    expect(results[1].count).toEqual(15);
    expect(results[2].count).toEqual(75);
    expect(results[3].count).toEqual(75);

    expect(coll.find({count: {$between: [-1, 4]}}).length).toEqual(0);
    expect(coll.find({count: {$between: [-1, 5]}}).length).toEqual(1);
    expect(coll.find({count: {$between: [-1, 6]}}).length).toEqual(1);
    expect(coll.find({count: {$between: [99, 140]}}).length).toEqual(1);
    expect(coll.find({count: {$between: [100, 140]}}).length).toEqual(1);
    expect(coll.find({count: {$between: [101, 140]}}).length).toEqual(0);
    expect(coll.find({count: {$between: [12, 76]}}).length).toEqual(4);
    expect(coll.find({count: {$between: [20, 60]}}).length).toEqual(0);
  });

  it('indexed $in find works as expected', function() {
    // test unindexed code path
    var db = new loki('db');
    var coll = db.addCollection('coll', { indices: ['count'] });
    coll.insert({ name : 'mjolnir', count: 73 });
    coll.insert({ name : 'gungnir', count: 5 });
    coll.insert({ name : 'tyrfing', count: 15 });
    coll.insert({ name : 'draupnir', count: 132 });

    var results = coll.chain().find({count: {$in: [15, 73]}}).simplesort('count').data();
    expect(results.length).toEqual(2);
    expect(results[0].count).toEqual(15);
    expect(results[1].count).toEqual(73);
  });

  it('nested indexed $in find works as expected', function() {
    var db = new loki('db');
    var coll = db.addCollection('coll', { indices: ['nested.count'] });
    coll.insert({ name : 'mjolnir', nested: { count: 73 } });
    coll.insert({ name : 'gungnir', nested: { count: 5 } });
    coll.insert({ name : 'tyrfing', nested: { count: 15 } });
    coll.insert({ name : 'draupnir', nested: { count: 132 } });

    var results = coll.chain().find(
      { 'nested.count': { $in: [15, 73] } }
    ).simplesort('nested.count').data();

    expect(results.length).toEqual(2);
    expect(results[0].nested.count).toEqual(15);
    expect(results[1].nested.count).toEqual(73);
  });

  it('ops work with mixed datatypes', function() {
    var db = new loki('db');
    var coll = db.addCollection('coll');

    coll.insert({ a: null, b: 5});
    coll.insert({ a: "asdf", b: 5});
    coll.insert({ a: "11", b: 5});
    coll.insert({ a: 2, b: 5});
    coll.insert({ a: "1", b: 5});
    coll.insert({ a: "4", b: 5});
    coll.insert({ a: 7.2, b: 5});
    coll.insert({ a: "5", b: 5});
    coll.insert({ a: 4, b: 5});
    coll.insert({ a: "18.1", b: 5});

    expect(coll.findOne({ a: "asdf"}).a).toEqual("asdf");
    // default equality is strict, otherwise use $aeq
    expect(coll.find({ a: 4}).length).toEqual(1);
    expect(coll.find({ a: '4'}).length).toEqual(1);
    // default range ops (lt, lte, gt, gte, between) are loose
    expect(coll.find({ a: { $between : [4, 12] }}).length).toEqual(5); // "4", 4, "5", 7.2, "11"
    expect(coll.find({ a: { $gte: "7.2" }}).length).toEqual(4); // 7.2, "11", "18.1", "asdf" (strings after numbers)
    expect(coll.chain().find({ a: { $gte: "7.2" }}).find({ a: { $finite: true }}).data().length).toEqual(3); // 7.2, "11", "18.1"
    expect(coll.find({ a: { $gt: "7.2" }}).length).toEqual(3); // "11", "18.1", "asdf"
    expect(coll.find({ a: { $lte: "7.2" }}).length).toEqual(7); // 7.2, "5", "4", 4, 2, 1, null

    // expect same behavior when binary index is applied to property being queried
    coll.ensureIndex('a');

    expect(coll.findOne({ a: "asdf"}).a).toEqual("asdf");
    // default equality is strict, otherwise use $aeq
    expect(coll.find({ a: 4}).length).toEqual(1);
    expect(coll.find({ a: '4'}).length).toEqual(1);
    // default range ops (lt, lte, gt, gte, between) are loose
    expect(coll.find({ a: { $between : [4, 12] }}).length).toEqual(5); // "4", 4, "5", 7.2, "11"
    expect(coll.find({ a: { $gte: "7.2" }}).length).toEqual(4); // 7.2, "11", "18.1", "asdf" (strings after numbers)
    expect(coll.chain().find({ a: { $gte: "7.2" }}).find({ a: { $finite: true }}).data().length).toEqual(3); // 7.2, "11", "18.1"
    expect(coll.find({ a: { $gt: "7.2" }}).length).toEqual(3); // "11", "18.1", "asdf"
    expect(coll.find({ a: { $lte: "7.2" }}).length).toEqual(7); // 7.2, "5", "4", 4, 2, 1, null

  });

  it('js range ops work as expected', function() {
    var db = new loki('db');
    var coll = db.addCollection('coll');

    coll.insert({ a: null, b: 5});
    coll.insert({ a: "11", b: 5});
    coll.insert({ a: 2, b: 5});
    coll.insert({ a: "1", b: 5});
    coll.insert({ a: "4", b: 5});
    coll.insert({ a: 7.2, b: 5});
    coll.insert({ a: "5", b: 5});
    coll.insert({ a: 4, b: 5});
    coll.insert({ a: "18.1", b: 5});

    expect(coll.find({ a: { $jgt: 5 } }).length).toEqual(3);
    expect(coll.find({ a: { $jgte: 5 } }).length).toEqual(4);
    expect(coll.find({ a: { $jlt: 7.2 } }).length).toEqual(6);
    expect(coll.find({ a: { $jlte: 7.2 } }).length).toEqual(7);
    expect(coll.find({ a: { $jbetween: [3.2, 7.8] } }).length).toEqual(4);
  });

  it('$regex ops work as expected', function() {
    var db = new loki('db');
    var coll = db.addCollection('coll');

    coll.insert({ name : 'mjolnir', count: 73 });
    coll.insert({ name : 'gungnir', count: 5 });
    coll.insert({ name : 'tyrfing', count: 15 });
    coll.insert({ name : 'draupnir', count: 132 });

    expect(coll.find({ name: { $regex: 'nir' } }).length).toEqual(3);
    expect(coll.find({ name: { $not: { $regex: 'nir' } } }).length).toEqual(1);

    expect(coll.find({ name: { $regex: 'NIR' } }).length).toEqual(0);
    expect(coll.find({ name: { $regex: [ 'NIR', 'i' ] } }).length).toEqual(3);
    expect(coll.find({ name: { $not: { $regex: [ 'NIR', 'i' ] } } }).length).toEqual(1);

    expect(coll.find({ name: { $regex: /NIR/i } }).length).toEqual(3);
    expect(coll.find({ name: { $not: { $regex: /NIR/i } } }).length).toEqual(1);
  });

  it('query nested documents', function() {
    var db = new loki('db');
    var coll = db.addCollection('coll');

    coll.insert({ a: null, b: 5, c: { a: 1 }});
    coll.insert({ a: "11", b: 5, c: { a: 1 }});
    coll.insert({ a: 2, b: 5, c: { a: 1 }});
    coll.insert({ a: "1", b: 5, c: { b: 1 }});
    coll.insert({ a: "4", b: 5, c: { b: 1 }});
    coll.insert({ a: 7.2, b: 5});
    coll.insert({ a: "5", b: 5});
    coll.insert({ a: 4, b: 5});
    coll.insert({ a: "18.1", b: 5});

    expect(coll.find({ "c.a": { $eq: 1 } }).length).toEqual(3);
    expect(coll.find({ "c.a": { $eq: undefined } }).length).toEqual(6);
    expect(coll.find({ "c": { $eq: undefined } }).length).toEqual(4);
  });

  it('$exists ops work as expected', function() {
    var db = new loki('db');
    var coll = db.addCollection('coll');

    coll.insert({ a: null, b: 5, c: { a: 1 }});
    coll.insert({ a: "11", b: 5, c: { a: 1 }});
    coll.insert({ a: 2, b: 5, c: { a: 1 }});
    coll.insert({ a: "1", b: 5, c: { b: 1 }});
    coll.insert({ a: "4", b: 5, c: { b: 1 }});
    coll.insert({ a: 7.2, b: 5});
    coll.insert({ a: "5", b: 5});
    coll.insert({ a: 4, b: 5});
    coll.insert({ a: "18.1", b: 5});

    expect(coll.find({ "c.a": { $exists: true } }).length).toEqual(3);
    expect(coll.find({ "c.a": { $exists: false } }).length).toEqual(6);
    expect(coll.find({ "c.a.b": { $exists: true } }).length).toEqual(0);
    expect(coll.find({ "c.a.b": { $exists: false } }).length).toEqual(9);
    expect(coll.find({ "c": { $exists: true } }).length).toEqual(5);
    expect(coll.find({ "c": { $exists: false } }).length).toEqual(4);
  });

  it('$elemMatch op works as expected', function () {
    var db = new loki('db');
    var coll = db.addCollection('coll');
    coll.insert({
      entries: [
        { name: 'foo', count: 1 },
        { name: 'bar', count: 2, nested: [{ foo: { bar: [0, 1] }, baz: true  }] },
      ]
    });
    coll.insert({
      entries: [
        { name: 'baz', count: 2 },
        { name: 'bar', count: 3, nested: [{ foo: { bar: [1, 2] }, baz: false }] },
      ]
    });

    expect(coll.find({
      entries: { $elemMatch: { name: 'bar' } }
    }).length).toBe(2)

    expect(coll.find({
      entries: { $elemMatch: { name: 'bar', count: 2 } }
    }).length).toBe(1)

    expect(coll.find({
      entries: {
        $elemMatch: { name: { $eq: 'bar' }, count: { $between: [2, 3] } }
      }
    }).length).toBe(2)

    expect(coll.find({
      entries: { $elemMatch: { name: 'bar' } },
      'entries.count': 1
    }).length).toBe(1)

    expect(coll.find({
      'entries.nested': {
        $elemMatch: { 'foo.bar': { $contains: 1 } }
      }
    }).length).toBe(2)

    expect(coll.find({
      'entries.nested': {
        $elemMatch: { 'foo.bar': { $contains: 1 }, baz: false }
      }
    }).length).toBe(1)
  });

  it('$$op column comparisons work', function () {
    var db = new loki('db');
    var coll = db.addCollection('coll');

    coll.insert({ a: null, b: 5 });
    coll.insert({ a: '5', b: 5 });
    coll.insert({ a: 5, b: 5 });
    coll.insert({ a: 6, b: 5 });
    coll.insert({ a: 3, b: 5 });
    coll.insert({ a: 3, b: 'number' });

    // standard case
    expect(coll.find({ a: { $$eq: 'b' } }).length).toEqual(1);
    expect(coll.find({ a: { $$aeq: 'b' } }).length).toEqual(2);
    expect(coll.find({ a: { $$ne: 'b' } }).length).toEqual(5);
    expect(coll.find({ a: { $$gt: 'b' } }).length).toEqual(1);
    expect(coll.find({ a: { $$gte: 'b' } }).length).toEqual(3);

    // function variant
    expect(coll.find({ a: { $$gt: function (record) { return record.b - 1 } } }).length).toEqual(4);

    // comparison on filtered rows
    expect(coll.find({ b: { $gt: 0 }, a: { $$aeq: 'b' } }).length).toEqual(2);

    // type
    expect(coll.find({ a: { $$type: 'b' } }).length).toEqual(1);
    expect(coll.find({ a: { $type: { $$eq: 'b' } } }).length).toEqual(1);

    // $not, $and, $or
    expect(coll.find({ a: { $not: { $$type: 'b' } } }).length).toEqual(5);
    expect(coll.find({ a: { $and: [{ $type: 'number' }, { $$gte: 'b' }] } }).length).toEqual(2);
    expect(coll.find({ a: { $or: [{ $eq: null }, { $$gt: 'b' }] } }).length).toEqual(2);

    // $len
    coll.insert({ text1: 'blablabla', len: 10 })
    coll.insert({ text1: 'abcdef', len: 6 })
    coll.insert({ text1: 'abcdef', len: 3 })
    expect(coll.find({ text1: { $len: { $$eq: 'len' } } }).length).toEqual(1);

    // $size
    coll.insert({ array1: [1, 2, 3], size: 2 })
    coll.insert({ array1: [1, 2], size: 1 })
    coll.insert({ array1: [1, 2], size: 3 })
    coll.insert({ array1: [1, 2, 3, 4], size: 5 })
    expect(coll.find({ array1: { $size: { $$eq: 'size' } } }).length).toEqual(0);
    expect(coll.find({ array1: { $size: { $$lt: 'size' } } }).length).toEqual(2);

    // $elemMatch
    coll.insert({ els: [{ a: 1, b: 2 }] })
    coll.insert({ els: [{ a: 1, b: 2 }, { a: 2, b: 2 }] })
    expect(coll.find({ els: { $elemMatch: { a: { $$eq: 'b' } } } }).length).toEqual(1);

    // $elemMatch - dot scan
    coll.insert({ els2: [{ a: { val: 1 }, b: 2 }] })
    coll.insert({ els2: [{ a: { val: 1 }, b: 2 }, { a: { val: 2 }, b: 2 }] })
    expect(coll.find({ els2: { $elemMatch: { 'a.val': { $$eq: 'b' } } } }).length).toEqual(1);

    // dot notation
    coll.insert({ c: { val: 5 }, b: 5 });
    coll.insert({ c: { val: 6 }, b: 5 });
    coll.insert({ c: { val: 7 }, b: 6 });
    expect(coll.find({ 'c.val': { $$gt: 'b' } }).length).toEqual(2);

    // dot notation - on filtered rows
    expect(coll.find({ b: { $gt: 0 }, 'c.val': { $$gt: 'b' } }).length).toEqual(2);
  });
});
