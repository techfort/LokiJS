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

    var joe = coll.get(1);
    joe.username = 'jack';
    coll.update(joe);
    expect(coll.get(1).username).toEqual('joe');

  });
})
