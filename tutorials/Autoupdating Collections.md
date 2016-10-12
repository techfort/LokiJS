# The Autoupdate Feature for Collections

Autoupdate can be enabled on a per-collection basis via the constructor option `autoupdate: true`. The feature requires `Object.observe` (currently implemented in Chrome 36+, io.js and Node.js 0.12+). If observers are not available, the option will be ignored.

Autoupdate automatically calls `update(doc)` whenever a document is modified, which is necessary for index updates and dirty-marks (used to determine whether the DB has been modified and should be persisted).

Enabling this feature basically means, that all manual `update` calls can be omitted.

## Example
```js
var doc = collection.by("name", "John");

doc.name = "Peter";
doc.age = 32;
doc.gender = "male";

collection.update(doc); // This line can be safely removed.
```

Autoupdate will call `update` at the end of the current event loop cycle and thus only calls `update` once, even when multiple changes were made.

## Error handling

There is one important difference between autoupdate and manual updates. If for example a document change violates a unique key constraint, `update` will synchronously throw an error which can be catched synchronously:
```js
var collection = db.addCollection("test", [
  unique: ["name"]
]);

collection.insert({ name: "Peter" });

var doc = collection.insert({ name: "Jack" });
doc.name = "Peter";

try {
  collection.update(doc);
} catch(err) {
  doc.name = "Jack";
}
```

Since autoupdate calls `update` asynchronously, you cannot catch errors via `try-catch`. Instead you have to use event listeners:
```js
var collection = db.addCollection("test", [
  unique: ["name"],
  autoupdate: true
]);

collection.insert({ name: "Peter" });

var doc = collection.insert({ name: "Jack" });
doc.name = "Peter";

collection.on("error", function(errDoc) {
  if(errDoc === doc) {
    doc.name = "Jack";
  }
});
```

This can become quite tedious, so you should consider performing checks before updating documents instead.