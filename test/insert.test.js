var loki = require('../src/lokijs.js');

var testUsers = [{
    name: 'dave',
    age: 25,
    lang: 'English'
  },
  {
    name: 'joe',
    age: 39,
    lang: 'Italian'
  },
  {
    name: 'jonas',
    age: 30,
    lang: 'Swedish'
  }];

describe('insert()', function () {
  it('should insert one obj ok, with undefined isClone', function () {
    var db = new loki();
    var users = db.addCollection('user');
    users.insert(testUsers[0]);
    (testUsers[0].meta === undefined).should.be.true;
    users.data.length.should.equal(1);
  });

  it('should insert one obj ok, with isClone = false', function () {
    var db = new loki();
    var users = db.addCollection('user');
    var _testUsers = clone(testUsers);
    users.insert(_testUsers[1], false);
    _testUsers[1].meta.should.be.ok;
    _testUsers[1].id.should.equal(1);
  });

  it('should insert one array ok, with null isClone', function () {
    var db = new loki();
    var users = db.addCollection('user');
    users.insert(testUsers, null);
    users.data.length.should.equal(1);
  });

  it('should throw "Document needs to be an object" Error', function () {
    var db = new loki();
    var users = db.addCollection('user');
    (function () {
      users.insert(function () {});
    }).should.throw(/^Document needs to be an object/);
  });

  it('should throw "Object cannot be null" Error', function () {
    var db = new loki();
    var users = db.addCollection('user');
    (function () {
      users.insert(null);
    }).should.throw(/^Object cannot be null/);
  });  
});

describe('bulkInsert()', function () {
  it('should bulkInsert an array ok, with undefined isClone', function () {
    var db = new loki();
    var users = db.addCollection('user');
    users.bulkInsert(testUsers);
    users.data.length.should.equal(3);
  });

  it('should bulkInsert an array ok, with isClone = false', function () {
    var db = new loki();
    var users = db.addCollection('user');
    var _testUsers = clone(testUsers);
    users.bulkInsert(_testUsers, false);
    _testUsers[0].meta.should.be.ok;
    _testUsers[1].id.should.equal(_testUsers[0].id + 1);
  });

  it('should throw "Document needs to be an array" Error', function () {
    var db = new loki();
    var users = db.addCollection('user');
    (function () {
      users.bulkInsert(function () {});
    }).should.throw(/^Document needs to be an array/);
  });
});

function clone (obj) {
  return JSON.parse(JSON.stringify(obj));
}