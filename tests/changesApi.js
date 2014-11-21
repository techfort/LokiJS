var loki = require('../src/lokijs.js'),
	db = new loki(),
	gordian = require('gordian'),
	suite = new gordian('testEvents'),
	users = db.addCollection('users', {
		asyncListeners: false
	}),
	test = db.addCollection('test'),
	test2 = db.addCollection('test2');

users.insert({
	name: 'joe'
});
test.insert({
	name: 'test'
});
test2.insert({
	name: 'test2'
});

var someChanges = db.generateChangesNotification(['users', 'test2']);
suite.assertEqual('Changes number', 2, someChanges.length);
var allChanges = db.generateChangesNotification();
suite.assertEqual('Changes number for all collections', 3, allChanges.length);
suite.report();