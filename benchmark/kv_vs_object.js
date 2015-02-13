var loki = require('../src/lokijs'),
  fs = require('fs'),
  stringsfile = '../tests/strings.txt',
  map = {},
  kv = new loki.KeyValueStore();

var strings = [];
fs.readFile(stringsfile, function (err, data) {
  if (err) throw err;
  strings = data.split('\n');
  for (var i = 0; i < 9998; i += 1) {
    map[strings[i]] = strings[i + 1];
    kv.set(strings[i], strings[i + 1]);
  }


});