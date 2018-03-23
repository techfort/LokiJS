var loki = require('../src/lokijs.js');

var DOCUMENT_COUNT = 70000;
var QUERY_INDEX_RANGE = 5;

var db;
var coll;

var start, end;
var totalMS = 0;

function createDatabase(indexed) {
    db = new loki('remove-bench.db');
    if (indexed) {
        coll = db.addCollection('profile', { indices: ['a']});
    }
    else {
        coll = db.addCollection('profile');
    }

    for(idx=0;idx<DOCUMENT_COUNT;idx++) {
        a = Math.floor(Math.random() * QUERY_INDEX_RANGE);
        b = Math.floor(Math.random() * QUERY_INDEX_RANGE);
        coll.insert({ "a": a, "b": b });
    }
}

function profileRemoveFilterByHashMap(indexed) {
  var idx, len, xo={};

  createDatabase(indexed);

  start = process.hrtime();

  coll.chain().find({a: {$ne: 2}}).remove();

  end = process.hrtime(start);

  totalMS = end[0] * 1e3 + end[1] / 1e6;
  totalMS = totalMS.toFixed(2);

  console.log("profileRemoveByHashMap : " + (indexed?"(indexed) ":"") + totalMS + "ms");
}

function profileOldRemove() {
    createDatabase();

    start = process.hrtime();

    var results = coll.find({a: {$ne:2}});
    coll.remove(results);
    
    end = process.hrtime(start);

    totalMS = end[0] * 1e3 + end[1] / 1e6;
    totalMS = totalMS.toFixed(2);
    console.log("profileOldRemove : " + totalMS + "ms");
}

setTimeout(function() {
  profileRemoveFilterByHashMap();
  setTimeout(function() {
    profileRemoveFilterByHashMap();

    setTimeout(function() {
        profileRemoveFilterByHashMap(true);

        setTimeout(function() {
            profileOldRemove();
        }, 1000)
    }, 1000);
  }, 1000);
}, 1000);