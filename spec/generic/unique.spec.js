if (typeof (window) === 'undefined') {
  var loki = require('../../src/lokijs.js');
}
describe('Constraints', function () {
  var db;
  beforeEach(function () {
    db = new loki();
  });

  it('should retrieve records with by()', function () {
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
    }).toThrow(new Error('Duplicate key for property username'));

    joe.username = 'jim';
    coll.update(joe);
    expect(byUsername('jim')).toEqual(joe);
  });
});
