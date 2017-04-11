if (typeof (window) === 'undefined') {
  var loki = require('../../src/lokijs.js');
}

describe('testing persistence adapter', function () {

	it('standard env adapter', function (done) {
		var db = new loki();
		db.initializePersistence();
		db.addCollection("myColl").insert({name: "Hello World"});

		db.saveDatabase().then(function () {
			var db2 = new loki();
      db2.initializePersistence();

			db2.loadDatabase().then(function () {
				expect(db2.getCollection("myColl").find()[0].name).toEqual("Hello World");
				done();
			});

			var db3 = new loki("other");
      db3.initializePersistence();

      db3.loadDatabase().then(function () {
        expect(false).toEqual(true);
      }, function () {
        expect(true).toEqual(true);
      });
		});
	});
});
