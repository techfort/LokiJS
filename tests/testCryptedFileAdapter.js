var cryptedFileAdapter = require('../src/lokiCryptedFileAdapter');

cryptedFileAdapter.setSecret('mySecret');
	
var loki = require('../src/lokijs.js'),
	db = new loki('./loki.json.crypted',{ adapter: cryptedFileAdapter }),
	gordian = require('gordian'),
	suite = new gordian('testCryptedFileAdapter'),
	users = db.addCollection('users');

users.insert([{
	name: 'joe'
}, {
	name: 'jack'
}]);

db.saveDatabase( function reload(){
	var reloaded = new loki('./loki.json.crypted',{ adapter: cryptedFileAdapter });
	reloaded.loadDatabase({}, function () {
		var users2 = reloaded.getCollection('users');
		suite.assertEqual('There are 2 objects in the reloaded and decrypted db', 2, users2.data.length);
		suite.report();
		require('fs').unlink('./loki.json.crypted');
	});
});
