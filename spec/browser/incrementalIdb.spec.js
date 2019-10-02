describe('IncrementalIndexedDBAdapter', function () {
  it('initializes Loki properly', function() {
    var adapter = new IncrementalIndexedDBAdapter('tests');
    var db = new loki('test.db', { adapter: adapter });
    var coll = db.addCollection('coll');

    expect(db.isIncremental).toBe(true);
    expect(coll.isIncremental).toBe(true);
    expect(adapter.chunkSize).toBe(100);
    expect(adapter.mode).toBe('incremental');
  })
  function checkDatabaseCopyIntegrity(source, copy) {
    source.collections.forEach(function(sourceCol, i) {
      var copyCol = copy.collections[i];
      expect(copyCol.name).toBe(sourceCol.name);
      expect(copyCol.data.length).toBe(sourceCol.data.length);

      copyCol.data.every(function(copyEl, elIndex) {
        expect(JSON.stringify(copyEl)).toBe(JSON.stringify(source.collections[i].data[elIndex]))
      })

      expect(copyCol.idIndex).toEqual(sourceCol.idIndex);
    })
  }
  it('checkDatabaseCopyIntegrity works', function() {
    var db = new loki('test.db');
    var col1 = db.addCollection('test_collection');

    var doc1 = { foo: '1' };
    var doc2 = { foo: '2' };
    var doc3 = { foo: '3' };
    col1.insert([doc1, doc2, doc3]);
    doc2.bar = 'true';
    col1.update(doc2);
    col1.remove(doc3);

    // none of these should throw
    checkDatabaseCopyIntegrity(db, db);
    checkDatabaseCopyIntegrity(db, db.copy());
    checkDatabaseCopyIntegrity(db, JSON.parse(db.serialize()));

    // this should throw
    // expect(function () {
    //   var copy = db.copy();
    //   copy.collections[0].data.push({ hello: '!'})
    //   checkDatabaseCopyIntegrity(db, copy);
    // }).toThrow();
  })
  // it('basically works', function(done) {
  //   var adapter = new IncrementalIndexedDBAdapter('tests');
  //   var db = new loki('test.db', { adapter: adapter });
  //   var col1 = db.addCollection('test_collection');

  //   col1.insert({ customId: 0, val: 'hello', constraints: 100 });
  //   col1.insert({ customId: 1, val: 'hello1' });
  //   var h2 = col1.insert({ customId: 2, val: 'hello2' });
  //   var h3 = col1.insert({ customId: 3, val: 'hello3' });
  //   var h4 = col1.insert({ customId: 4, val: 'hello4' });
  //   var h5 = col1.insert({ customId: 5, val: 'hello5' });

  //   h2.val = 'UPDATED';
  //   col1.update(h2);

  //   h3.val = 'UPDATED';
  //   col1.update(h3);
  //   h3.val2 = 'added!';
  //   col1.update(h3);

  //   col1.remove(h4);

  //   var h6 = col1.insert({ customId: 6, val: 'hello6' });

  //   db.saveDatabase(function (e) {
  //     expect(e).toBe(undefined);

  //     var adapter2 = new IncrementalIndexedDBAdapter('tests');
  //     var db2 = new loki('test.db', { adapter: adapter2 });

  //     db2.loadDatabase({}, function (e) {
  //       expect(e).toBe(undefined);

  //       checkDatabaseCopyIntegrity(db, db2);
  //       done()
  //     });
  //   });
  // })
  // it('works with a lot of fuzzed data', function() {
  // })
  // it('can delete database', function() {
  // })
  // it('stores data in the expected format', function() {
  // })
  // NOTE: Because PhantomJS doesn't support IndexedDB, I moved tests to spec/incrementalidb.html
  it('handles dirtyIds during save properly', function() {
    var adapter = new IncrementalIndexedDBAdapter('tests');
    var db = new loki('test.db', { adapter: adapter });
    var col1 = db.addCollection('test_collection');

    var doc1 = { foo: '1' };
    var doc2 = { foo: '2' };
    var doc3 = { foo: '3' };
    col1.insert([doc1, doc2, doc3]);
    doc2.bar = 'true';
    col1.update(doc2);
    col1.remove(doc3);

    var dirty = col1.dirtyIds;
    expect(dirty.length).toBe(5);

    // simulate save - don't go through IDB, just check that logic is good
    var callCallback;
    adapter.saveDatabase = function(dbname, loki, callback) {
      callCallback = callback;
    };

    // dirty ids zero out and roll back in case of error
    db.saveDatabase();
    expect(col1.dirtyIds).toEqual([]);
    callCallback(new Error('foo'));
    expect(col1.dirtyIds).toEqual(dirty);

    // new dirtied ids get added in case of rollback
    db.saveDatabase();
    expect(col1.dirtyIds).toEqual([]);
    var doc4 = { foo: '4' };
    col1.insert(doc4);
    expect(col1.dirtyIds).toEqual([doc4.$loki]);
    callCallback(new Error('foo'));
    expect(col1.dirtyIds).toEqual([doc4.$loki].concat(dirty));

    // if successful, dirty ids don't zero out
    db.saveDatabase();
    expect(col1.dirtyIds).toEqual([]);
    var doc5 = { foo: '5' };
    col1.insert(doc5);
    expect(col1.dirtyIds).toEqual([doc5.$loki]);
    callCallback();
    expect(col1.dirtyIds).toEqual([doc5.$loki]);
  })
})
