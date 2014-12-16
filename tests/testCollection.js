var Loki = require('../src/lokijs.js'),
  gordian = require('gordian'),
  suite = new gordian('testCollection');

function SubclassedCollection() {
  Loki.Collection.apply(this, Array.prototype.slice.call(arguments));
}
SubclassedCollection.prototype = new Loki.Collection;
SubclassedCollection.prototype.extendedMethod = function () {
  return this.name.toUpperCase();
}
var coll = new SubclassedCollection('users', {});

suite.assertEqual('Exposed Collection is not null', true, coll != null);
suite.assertEqual('Exposed Collection methods work normally', 'users'.toUpperCase(), coll.extendedMethod());
coll.insert({
  name: 'joe'
});
suite.assertEqual('Exposed Collection operations work normally', coll.data.length, 1);
suite.report();