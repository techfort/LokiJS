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

describe('loki()', function () {
  it('should new loki() ok', function () {
    var db = new loki('test.json');
    users = db.addCollection('user');
    db.collections.length.should.equal(1);
  });
});