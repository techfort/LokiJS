if (typeof(window) === 'undefined') var loki = require('../../src/lokijs.js');
  
describe('typed', function () {
  it('works', function () {
    var db = new loki('test.json');
    var users;

    function User(n) {
      this.name = n || '';
      this.log = function () {
        console.log('Name: ' + this.name);
      };
    }

    var json = {
      "filename": "test.json",
      "collections": [{
        "name": "users",
        "data": [{
          "name": "joe",
          "objType": "users",
          "meta": {
            "version": 0,
            "created": 1415467401386,
            "revision": 0
          },
          "$loki": 1
        }, {
          "name": "jack",
          "objType": "users",
          "meta": {
            "version": 0,
            "created": 1415467401388,
            "revision": 0
          },
          "$loki": 2
        }],
        "idIndex": [1, 2],
        "binaryIndices": {},
        "objType": "users",
        "transactional": false,
        "cachedIndex": null,
        "cachedBinaryIndex": null,
        "cachedData": null,
        "maxId": 2,
        "DynamicViews": [],
        "events": {
          "insert": [null],
          "update": [null],
          "close": [],
          "flushbuffer": [],
          "error": [],
          "delete": []
        }
      }],
      "events": {
        "close": []
      },
      "ENV": "NODEJS",
      "fs": {}
    };

    db.loadJSON(JSON.stringify(json), {
      users: {
        proto: User
      }
    });

    users = db.getCollection('users');
    //suite.assertEqual('Inflated object prototype', users.get(1) instanceof User, true);
    expect(users.get(1) instanceof User).toBe(true);
  });
});
