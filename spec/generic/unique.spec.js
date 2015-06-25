if (typeof (window) === 'undefined') {
  var loki = require('../../src/lokijs.js');
}
describe('Constraints', function () {

  it('should retrieve records with by()', function () {
    var db = new loki();
    var coll = db.addCollection('users', {
      unique: ['username']
    });
    coll.insert({
      username: 'joe',
      name: 'Joe'
    });
    coll.insert({
      username: 'jack',
      name: 'Jack'
    });
    expect(coll.by('username', 'joe').name).toEqual('Joe');

    var byUsername = coll.by('username');
    expect(byUsername('jack').name).toEqual('Jack');

    var joe = coll.by('username', 'joe');
    joe.username = 'jack';
    expect(function () {
      coll.update(joe)
    }).toThrow(new Error('Duplicate key for property username: ' + joe.username));
    joe.username = 'jim';
    coll.update(joe);
    expect(byUsername('jim')).toEqual(joe);
  });

  it('should create a unique index', function () {
    var db = new loki();
    var coll2 = db.addCollection('moreusers');
    coll2.insert({
      name: 'jack'
    });
    coll2.insert({
      name: 'tim'
    });
    coll2.ensureUniqueIndex('name');
  });

  it('should not add record with null index', function() {
    var db = new loki();
    var coll3 = db.addCollection('nullusers', {
      unique: ['username']
    });
    coll3.insert({
      username: 'joe',
      name: 'Joe'
    });
    coll3.insert({
      username: null,
      name: 'Jack'
    });

    expect(Object.keys(coll3.constraints.unique.username.keyMap).length).toEqual(1);
  });

  it('should not throw an error id multiple nulls are added', function() {
    var db = new loki();
    var coll4 = db.addCollection('morenullusers', {
      unique: ['username']
    });
    coll4.insert({
      username: 'joe',
      name: 'Joe'
    });
    coll4.insert({
      username: null,
      name: 'Jack'
    });
    coll4.insert({
      username: null,
      name: 'Jake'
    });
    expect(Object.keys(coll4.constraints.unique.username.keyMap).length).toEqual(1);
  });
});
