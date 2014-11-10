var loki = require('../src/lokijs.js'),
	db,
	users;

db = new loki('test.json');

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
			"id": 1
		}, {
			"name": "jack",
			"objType": "users",
			"meta": {
				"version": 0,
				"created": 1415467401388,
				"revision": 0
			},
			"id": 2
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
console.log(users.get(1) instanceof User);