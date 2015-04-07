
// var fs = require("fs");
// var isError = require('util').isError;



// // these 2 function test the interworking between Lokijs and the adapter
// function saveTest(){
// 	users.insert([{
// 		name: 'joe'
// 	}, {
// 		name: 'jack'
// 	}]);
// 	db.saveDatabase(reloadTest);
// }

// function reloadTest(){
// 	var reloaded = new loki('./loki.json.crypted',{ adapter: cryptedFileAdapter });
// 	reloaded.loadDatabase({}, function () {
// 		var users2 = reloaded.getCollection('users');
// 		suite.assertEqual('There are 2 objects in the reloaded and decrypted db', 2, users2.data.length);
// 		errorHandlingTest();
// 	});
// }

// function errorHandlingTest(){
// 	var reloaded = new loki('./nonExistingDatabase',{ adapter: cryptedFileAdapter });
// 	reloaded.loadDatabase({}, function (r){
// 		suite.assertStrictEqual('Missing database caught by loadDatabase and passed via Lokijs', (r !== undefined) , true);
// 		noSecretOnSaveTest();
// 	});
// }


// // now on to testing error handling in the adapter itself

// function noSecretOnSaveTest(){

// 	cryptedFileAdapter.setSecret(undefined);

// 	cryptedFileAdapter.saveDatabase('./testfile.json',"{}",
// 		function(r){
// 			suite.assertStrictEqual('Missing secret caught on saveDatabase', isError(r), true);
// 			noSecretOnLoadTest();
// 		});
// }

// function noSecretOnLoadTest(){
// 	cryptedFileAdapter.loadDatabase('./loki.json.crypted',
// 		function(r){
// 			suite.assertStrictEqual('Missing secret caught by loadDatabase', isError(r), true);
// 			missingDbTest();
// 		});
// }

// function missingDbTest(){
// 	cryptedFileAdapter.setSecret('mySecret');

// 	cryptedFileAdapter.loadDatabase("./nonExistingDatabase",
// 		function(r){
// 			suite.assertStrictEqual('Missing database caught by loadDatabase', isError(r), true);
// 			noJsonTest();
// 		});
// }

// function noJsonTest(){
// 	fs.writeFileSync("./nonJsonTestFile.txt","this is not json",'utf8');
// 	cryptedFileAdapter.loadDatabase("./nonJsonTestFile.txt",
// 	function(r){
// 		fs.unlink("./nonJsonTestFile.txt");
// 		suite.assertStrictEqual('No Json content caught by loadDatabase', isError(r), true);
// 		wrongJsonTest();
// 	});
// }

// function wrongJsonTest(){
// 	fs.writeFileSync("./wrongJsonTestFile.txt",'{"name":"value"}','utf8');
// 	cryptedFileAdapter.loadDatabase("./wrongJsonTestFile.txt",
// 	function(r){
// 		fs.unlink("./wrongJsonTestFile.txt");
// 		suite.assertStrictEqual('Wrong Json content caught by loadDatabase', isError(r), true);
// 		endOfTest();
// 	});
// }

// function endOfTest(){
// 	suite.report();
// 	fs.unlink('./loki.json.crypted');
// }

// var cryptedFileAdapter = require('../src/lokiCryptedFileAdapter');

// cryptedFileAdapter.setSecret('mySecret');

// var loki = require('../src/lokijs.js'),
// 	db = new loki('./loki.json.crypted',{ adapter: cryptedFileAdapter }),
// 	gordian = require('gordian'),
// 	suite = new gordian('testCryptedFileAdapter'),
// 	users = db.addCollection('users');

// saveTest();








