var loki = require('../src/lokijs.js'),
	db = new loki(),
	gordian = require('gordian'),
	suite = new gordian('testEvents'),
	options = {
		asyncListeners: false,
		disableChangesApi: false
	},
	users = db.addCollection('users', options),
	test = db.addCollection('test', options),
	test2 = db.addCollection('test2', options);

var u = users.insert({
	name: 'joe'
});
u.name = 'jack';
users.update(u);
test.insert({
	name: 'test'
});
test2.insert({
	name: 'test2'
});

var userChanges = db.generateChangesNotification(['users']);
suite.assertEqual('Single collection changes', 2, userChanges.length);
var someChanges = db.generateChangesNotification(['users', 'test2']);
suite.assertEqual('Changes number for selected collections', 3, someChanges.length);
var allChanges = db.generateChangesNotification();
suite.assertEqual('Changes number for all collections', 4, allChanges.length);
suite.report();