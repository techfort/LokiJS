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

describe.only('insert()', function () {
  it('should insert one obj ok, with undefined isClone', function () {
    var db = new loki('test.json');
    var users = db.addCollection('user');
    users.insert(testUsers[0]);
    (testUsers[0].meta === undefined).should.be.true;
    users.data.length.should.equal(1);
  });

  it('should insert one obj ok, with isClone = false', function () {
    var db = new loki('test.json');
    var users = db.addCollection('user');
    users.insert(testUsers[1], false);
    testUsers[1].meta.should.be.ok;
    testUsers[1].id.should.equal(1);
  });
});