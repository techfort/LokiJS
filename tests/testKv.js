// var loki = require('../src/lokijs.js'),
// 	gordian = require('gordian'),
// 	suite = new gordian('testKv'),
// 	store = new loki.KeyValueStore();

describe('kv', function () {
  it('works', function () {
    var store = new loki.KeyValueStore();
    var key = {
        name: 'joe'
      },
      value = {
        position: 'developer'
      };

    store.set('foo', 'bar');
    store.set('bar', 'baz');
    store.set('baz', 'quux');
    store.set(key, value);
    expect('bar').toEqual(store.get('foo'));
    expect(value).toEqual(store.get(key));
  });
});
