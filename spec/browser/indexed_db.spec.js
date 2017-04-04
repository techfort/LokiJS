it('indexed adapter', function (done) {
  var db = new loki();

  db.initializePersistence({adapter: new LokiIndexedAdapter("myTestApp")});
  db.addCollection("myColl").insert({name: "Hello World"});

  db.saveDatabase().then(function () {
    var db2 = new loki();
    db2.initializePersistence({adapter: new LokiIndexedAdapter("myTestApp")});

    db2.loadDatabase().then(function () {
      expect(db2.getCollection("myColl").find()[0].name).toEqual("Hello World");

      db2.deleteDatabase().then(function () {
        var ldx = new LokiIndexedAdapter("myTestApp");
        // Should be promised?
        ldx.getDatabaseList(function (result) {
          expect(result.length).toEqual(0);
          done();
        });
      });
    });
  });
});
