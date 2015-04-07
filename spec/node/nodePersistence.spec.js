// var loki = require('../src/lokijs.js'),
// 	db = new loki('./loki.json'),
// 	gordian = require('gordian'),
// 	suite = new gordian('nodePersistence'),
// 	users = db.addCollection('users');

// users.insert([{
// 	name: 'joe'
// }, {
// 	name: 'jack'
// }]);

// db.saveDatabase( function reload(){

// var reloaded = new loki('./loki.json');
// 	reloaded.loadDatabase({}, function () {
// 		var users2 = reloaded.getCollection('users');
// 		suite.assertEqual('There are 2 objects in the reloaded db', 2, users2.data.length);
// 		require('fs').unlink('./loki.json');
// 	});
// });

// // test autoload callback fires even when database does not exist
// function testAutoLoad() {
// 	var cbSuccess = false;

// 	var tdb = new loki('nonexistent.db',
// 	{
//         autoload: true,
//         autoloadCallback : function() { cbSuccess = true; }
//     });

// 	setTimeout(function() {
// 		suite.assertEqual('autoload callback was called', cbSuccess, true);
// 		suite.report();
// 	}, 500);
// }

// // due to async nature of top inline test, give it some time to complete
// setTimeout(testAutoLoad, 500);
