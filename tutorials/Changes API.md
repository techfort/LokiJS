# Overview

LokiJS 1.1 introduces a "Changes API" that enables the user to keep track of the changes happened to each collection since a particular point in time, which is usually the start of a work session but it could be a user defined one.
This is particularly useful for remote synchronization.

## Description of the Changes API

The Changes API is a collection-level feature, hence you can establish which collections may simply contain volatile data and which ones need to keep a record of what has changed.

The Changes API is an optional feature and can be activated/deactivated by either passing the option `{ disableChangesApi: isDisabled }` in the config parameter of a collection constructor, or by calling `collection.setChangesApi(isEnabled)`.
Note that LokiJS will always set the fastest performing setting as default on a collection or database, hence the Changes API is **disabled** by default.

There are three events which will trigger a Changes API operation: inserts, updates and deletes.
When either of these events occur, on a collection with Changes API activated, the collection will store a snapshot of the relevant object, associated with the operation and the name of the collection.

From the database object it is then possible to invoke the `serializeChanges` method which will generate a string representation of the changes occurred to be used for synchronization purposes.

## Usage

To enable the Changes API make sure to either instantiate a collection using `db.addCollection('users', { disableChangesApi: false })`, or call `users.setChangesApi(true)` (given an example `users` collection).

To generate a string representation of the changes, call `db.serializeChanges()`. This will generate a representation of all the changes for those collections that have the Changes API enabled. If you are only interested in generating changes for a subset of collections, you can pass an array of names of the collections, i.e. `db.serializeChanges(['users']);`.

To clear all the changes, call `db.clearChanges()`. Alternatively you can call `flushChanges()` on the single collection, normally you would call `db.clearChanges()` on a callback from a successful synchronization operation.

Each change is an object with three properties: `name` is the collection name, `obj` is the string representation of the object and `operation` is a character representing the operation ("I" for insert, "U" for update, "R" for remove). So for example, inserting user `{ name: 'joe' }` in the users collection would generate a change `{ name: 'users', obj: { name: 'joe' }, operation: 'I' }`. Changes are kept in order of how the happened so a 3rd party application will be able to operate insert updates and deletes in the correct order.
