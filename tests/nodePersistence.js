var loki = require('../src/lokijs.js'),
	db = new loki('./loki.json'),
	gordian = require('gordian'),
	suite = new gordian('nodePersistence'),
	users = db.addCollection('users');

users.insert([{
	name: 'joe'
}, {
	name: 'jack'
}]);

db.saveDatabase( function reload(){

var reloaded = new loki('./loki.json');
	reloaded.loadDatabase({}, function () {
		var users2 = reloaded.getCollection('users');
		suite.assertEqual('There are 2 objects in the reloaded db', 2, users2.data.length);
		suite.report();
		require('fs').unlink('./loki.json');
	});
});
