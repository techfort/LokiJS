var loki = require('../src/lokijs.js'),
	db = new loki(),
	gordian = require('gordian'),
	suite = new gordian('testEvents'),
	users = db.addCollection('users', {
		asyncListeners: false
	});

users.insert({
	name: 'joe'
});
console.log(db.generateChangesNotification());

function testAsync() {
	suite.assertEqual('DB events async', db.asyncListeners, false);
}

testAsync();

suite.report();