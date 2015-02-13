var loki = require('../src/lokijs.js'),
	gordian = require('gordian'),
	suite = new gordian('testKv'),
	store = new loki.KeyValueStore();

var key = {
		name: 'joe'
	},
	value = {
		position: 'developer'
	};

store.set('foo', 'bar');
//store.set(key, value);
console.log(store.keys.array, store.values.array)
suite.assertEqual('Finding key and value', 'bar', store.get('foo'));
//suite.assertEqual('Finding key by object', value, store.get(key));
suite.report();