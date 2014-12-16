var loki = require('../src/lokijs.js'),
	db = new loki(),
	gordian = require('gordian'),
	suite = new gordian('testCollection');

var coll = new db.Collection('users');
suite.assertEqual('Exposed Collection is not null', true, coll != null);
coll.insert({
	name: 'joe'
});
suite.assertEqual('Exposed Collection operations work normally', coll.data.length, 1);
suite.report();