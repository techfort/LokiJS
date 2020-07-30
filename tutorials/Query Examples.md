### Note: we now have several quickstart examples in the 'examples' subfolder of this repository.

> https://github.com/techfort/LokiJS/blob/master/examples/quickstart-core.js and
> https://github.com/techfort/LokiJS/blob/master/examples/quickstart-chaining.js
> https://github.com/techfort/LokiJS/blob/master/examples/quickstart-transforms.js
> https://github.com/techfort/LokiJS/blob/master/examples/quickstart-dynview.js

> For persistence examples we have numbered node quickstarts in the [examples folder](https://github.com/techfort/LokiJS/tree/master/examples) and web quickstart gists available within [Loki Sandbox](https://rawgit.com/techfort/LokiJS/master/examples/sandbox/LokiSandbox.htm).

### Designing Queries

LokiJS has evolved several mechanisms for querying the database.  At the highest level of abstraction, let us divide the methods into these categories : 
* Core Methods - simple, yet powerful method for queries applied directly to a collection.
* Chaining (via Resultsets) - allows for sorting, limiting, offsets, and multiple queries in sequence.
* Chaining Transforms - similar to method chaining above, yet defined in object structure which can be serialized.
* DynamicViews - allows for optimal performance and availability commonly used queries with potentially large resultsets.

Within each of those methods, your queries generally fall into 'find' and 'where' categories.  

### 'Where' queries
These queries leverage javascript functions to filter data.  This is the slowest but most versatile method for filtering documents in a collection.  Essentially we will test your filter on every document in the collection to see if it should be in the results.

```javascript
// simple anonymous filter
var results = coll.where(function(obj) {
  return obj.legs === 8;
});

// -or- set up named filter function
function sleipnirFilter(obj) {
  return obj.legs === 8;
}

// and then pass that
results = coll.where(sleipnirFunction);
```

### 'Find' queries
Find queries are based on subset of mongo query syntax and are capable of utilizing indexes to speed up queries.  When used with Collection Transforms or Dynamic Views, these filters can be saved into the database itself.  This is the preferred method for querying a Loki database.  Query everything (or filter as much as you can) with find queries, and use 'where' filtering if there are edge cases which find does not support (or does not support yet).

### 'Find' Operator Examples : 

**_[Currently adding and reviewing functionality of several operators... we should probably expand this section out into greater detail with better examples]_**

The primary operators currently supported are : 

**$eq** - filter for document(s) with property of (strict) equality
```javascript
// implicit (assumes $eq operator)
var results = coll.find({'Name': 'Odin'});

// explicit $eq
results = coll.find({'Name': { '$eq' : 'Odin' }});
```
**$ne** - filter for document(s) with property not equal to provided value
```javascript
// not equal test
var results = coll.find({'legs': { '$ne' : 8 }});
```
**$aeq** - filter for document(s) with property of abstract (loose) equality
```javascript
// will match documents with age of '20' or 20
var results = coll.find({age: {$aeq: 20}});
```
**$dteq** - filter for document(s) with date property equal to provided date value
```javascript
var dt1 = new Date("1/1/2017");
var dt2 = new Date("1/1/2017");

items.insert({ name : 'mjolnir', created: dt1 });
items.insert({ name : 'gungnir', created: dt2 });

// returns both of the above inserted documents
var results = items.find({ created: { $dteq: new Date("1/1/2017") } });
```
**$gt** - filter for document(s) with property greater than provided value
```javascript
var results = coll.find({'age': {'$gt': 40}});
```
**$gte** - filter for document(s) with property greater or equal to provided value
```javascript
var results = coll.find({'age': {'$gte': 40}});
```
**$lt** - filter for document(s) with property less than provided value
```javascript
var results = coll.find({'age': {'$lt': 40}});
```
**$lte** - filter for document(s) with property less than or equal to provided value
```javascript
var results = coll.find({'age': {'$lte': 40}});
```
**$between** - filter for documents(s) with property between provided vals
```javascript
// match users with count value between 50 and 75
var results = users.find({ count : { '$between': [50, 75] }});
```
>
> Note : the above $gt, $gte, $lt, $lte, and $between ops use 'loki' sorting which provides a unified range actoss 
> mixed types and which return the same results whether the property is indexed or not. This is needed for binary 
> indexes and for guarantees of results equality between indexed and non-indexed comparisons.
>
> If you do not expect to utilize a binary index and you expect that simple javascript comparisons are acceptable, 
> we provide the following ops which (due to their simplified comparisons) may provide more optimal execution speeds.
>
> **$jgt** - filter (using simplified javascript comparison) for docs with property greater than provided value
> ```javascript
> var results = coll.find({'age': {'$jgt': 40}});
> ```
> **$jgte** - filter (using simplified javascript comparison) for docs with property greater than or equal to provided value
> ```javascript
> var results = coll.find({'age': {'$jgte': 40}});
> ```
> **$jlt** - filter (using simplified javascript comparison) for docs with property less than provided value
> ```javascript
> var results = coll.find({'age': {'$jlt': 40}});
> ```
> **$jlte** - filter (using simplified javascript comparison) for docs with property less than or equal to provided value
> ```javascript
> var results = coll.find({'age': {'$jlte': 40}});
> ```
> **$jbetween** - filter (using simplified javascript comparison) for docs with property between provided vals
> ```javasscript
> var results = users.find({ count : { '$jbetween': [50, 75] }});
> ```
**$regex** - filter for document(s) with property matching provided regular expression
>_If using regex operator within a named transform or dynamic view filter, it is best to use the latter two examples since raw regex does not seem to serialize/deserialize well._

```javascript

// pass in raw regex
var results = coll.find({'Name': { '$regex' : /din/ }});

// or pass in string pattern only
results = coll.find({'Name': { '$regex': 'din' }});

// or pass in [pattern, options] string array
results = coll.find({'Name': { '$regex': ['din', 'i'] }});

```

**$in** - filter for document(s) with property matching any of the provided array values. Your property should not be an array but your compare values should be.
```javascript
users.insert({ name : 'odin' });
users.insert({ name : 'thor' });
users.insert({ name : 'svafrlami' });

// match users with name in array set ['odin' or 'thor']
var results = users.find({ 'name' : { '$in' : ['odin', 'thor'] } });
```
**$nin** - filter for document(s) with property not matching any of the provided array values.
```javascript
users.insert({ name : 'odin' });
users.insert({ name : 'thor' });
users.insert({ name : 'svafrlami' });

// match users with name not in array set ['odin' or 'thor'] (svafrlami doc only)
var results = users.find({ 'name' : { '$nin' : ['odin', 'thor'] } }); 
```
**$keyin** - filter for document(s) whose property value is defined in the provided hash object keys.  _(Equivalent to $in: Object.keys(hashObject))_ ( [#362](https://github.com/techfort/LokiJS/issues/362), [#365](https://github.com/techfort/LokiJS/issues/365) )
```javascript
categories.insert({ name: 'Title', column: 'title'})

// since the op doesn't use the title value, this is most effective with existing objects
var result = categories.find({column: { $keyin: { title: 'anything'} }});
```
**$nkeyin** - filter for document(s) whose property value is not defined in the provided hash object keys. **_(Equivalent to $nin: Object.keys(hashObject))_** ( [#362](https://github.com/techfort/LokiJS/issues/362), [#365](https://github.com/techfort/LokiJS/issues/365) )
```javascript
var result = categories.find({column: { $nkeyin: { title: 'anything'} }});
```
**$definedin** - filter for document(s) whose property value is defined in the provided hash object as a value other than **_undefined_**. [#285](https://github.com/techfort/LokiJS/issues/285)
```javascript
items.insert({ name : 'mjolnir', owner: 'thor', maker: 'dwarves' });
items.insert({ name : 'gungnir', owner: 'odin', maker: 'elves' });
items.insert({ name : 'tyrfing', owner: 'Svafrlami', maker: 'dwarves' });
items.insert({ name : 'draupnir', owner: 'odin', maker: 'elves' });

// returns gungnir and draupnir.  similar to $keyin, the value ('rule') is not used by the op
var results = items.find({maker: { $efinedin: { elves: 'rule' } } });
```
**$undefinedin** -  filter for document(s) whose property value is not defined in the provided hash object or defined but is **_undefined_**. [#285](https://github.com/techfort/LokiJS/issues/285)
```javascript
items.insert({ name : 'mjolnir', owner: 'thor', maker: 'dwarves' });
items.insert({ name : 'gungnir', owner: 'odin', maker: 'elves' });
items.insert({ name : 'tyrfing', owner: 'Svafrlami', maker: 'dwarves' });
items.insert({ name : 'draupnir', owner: 'odin', maker: 'elves' });

// returns mjolnir and tyrfing where the 'dwarves' val is not a property on our passed object
var results = items.find({maker: { $undefinedin: { elves: 'rule' } } });
```
**$contains** - filter for document(s) with property containing the provided value. ( [commit](https://github.com/techfort/LokiJS/pull/120/commits/1f08433203554ccf00b381cbea4e72e25e62d5da), [#205](https://github.com/techfort/LokiJS/issues/205) ).  Use this when your property contains an array but your 
compare value is not an array.
>When typeof property is : 
>- string: it will do a substring match for your string (indexOf)
>- array:  it will check for 'value' existence in that array (indexOf) 
>- object: it will check to see if your 'value' is a defined property of that object

```javascript
users.insert({ name : 'odin', weapons : ['gungnir', 'draupnir']});
users.insert({ name : 'thor', weapons : ['mjolnir']});
users.insert({ name : 'svafrlami', weapons : ['tyrfing']});
users.insert({ name : 'arngrim', weapons : ['tyrfing']});

// returns 'svafrlami' and 'arngrim' documents
var results = users.find({ 'weapons' : { '$contains' : 'tyrfing' } });
```
**$containsAny** - filter for document(s) with property containing any of the provided values. 
Use this when your property contains an array -and- your compare value is an array.
>When typeof property is : 
>- string: it will do a substring match for your string (indexOf)
>- array:  it will check for 'value' existence in that array (indexOf) 
>- object: it will check to see if your 'value' is a defined property of that object
```javascript
users.insert({ name : 'odin', weapons : ['gungnir', 'draupnir']});
users.insert({ name : 'thor', weapons : ['mjolnir']});
users.insert({ name : 'svafrlami', weapons : ['tyrfing']});
users.insert({ name : 'arngrim', weapons : ['tyrfing']});

// returns 'svafrlami', 'arngrim', and 'thor' documents
results = users.find({ 'weapons' : { '$containsAny' : ['tyrfing', 'mjolnir'] } });
```
**$containsNone** - filter for documents(s) with property containing none of the provided values
```javascript
users.insert({ name : 'odin', weapons : ['gungnir', 'draupnir']});
users.insert({ name : 'thor', weapons : ['mjolnir']});
users.insert({ name : 'svafrlami', weapons : ['tyrfing']});
users.insert({ name : 'arngrim', weapons : ['tyrfing']});

// returns 'svafrlami' and 'arngrim'
results = users.find({ 'weapons' : { '$containsNone' : ['gungnir', 'mjolnir'] } });
```
**$type** - filter for documents which have a property of a specified type

```javascript
users.insert([
  { name: 'odin', weapons: ['gungnir', 'draupnir'] },
  { name: 'thor', weapons: 'mjolnir' },
  { name: 'svafrlami', weapons: ['tyrfing'] },
  { name: 'arngrim', weapons: ['tyrfing'] }
]);

// returns docs with (non-array) string value for 'weapons' (mjolnir)
var results = users.find({ 'weapons' : { '$type' : 'string' } });
```

**$finite** - filter for documents with property which is numeric or non-numeric.

```javascript

// return all docs where isFinite(doc.age) === true
var results = users.find({ age: { $finite: true }});

```

**$size** - filter for documents which have array property of specified size. _(does not work for strings)_
```javascript
users.insert([
  { name: 'odin', weapons: ['gungnir', 'draupnir'] },
  { name: 'thor', weapons: 'mjolnir' },
  { name: 'svafrlami', weapons: ['tyrfing'] },
  { name: 'arngrim', weapons: ['tyrfing'] }
]);

// returns docs where 'weapons' are 2-element arrays (odin)
var results = users.find({ 'weapons' : { '$size' : 2 } });
```
**$len** - filter for documents which have string property of specified length.
```javascript
users.insert([
  { name: 'odin', weapons: ['gungnir', 'draupnir'] },
  { name: 'thor', weapons: 'mjolnir' },
  { name: 'svafrlami', weapons: ['tyrfing'] },
  { name: 'arngrim', weapons: ['tyrfing'] }
]);

// returns docs where 'name' is a 9 character string (svafrllami)
var results = users.find({ 'name' : { '$len' : 9 } });
```
**$and** - filter for documents which meet all nested subexpressions
```javascript
// fetch documents matching both sub-expressions
var results = coll.find({
  '$and': [{ 
      'age' : {
        '$gt': 30
      }
    },{
      'name' : 'Thor'
    }]
});

// alternative 'implicit' syntax :
results = coll.find({
  age: { $gt: 30 },
  name: 'Thor'
});
```

**$or** - filter for documents which meet any of the nested subexpressions
```javascript
// fetch documents matching any of the sub-expressions
var results = coll.find({
  '$or': [{ 
      'age' : {
        '$gte': '40'
      }
    },{
      'name' : 'Thor'
    }]
});
```

**$exists** - filter for documents which contain (even when the value is null) this field or not
```javascript
// fetch documents which do not have this field. Use '$exists': true for documents which have this field (it may be null)
var results = coll.find({
  'age': {
    '$exists': false
  }
});
```

**$$eq, $$eq, etc.** - many filters support column comparisons - comparing one column in a document
with another (instead of between column and value):
```javascript
// fetch documents where foo > bar
var results = coll.find({{ foo: { $$gt: 'bar' } }})

// instead of passing second column name, you can pass a function that computes value to compare against
var results = coll.find({{ foo: { $$lt: doc => doc.bar + 1 } }})
```
### Features which support 'find' queries
These operators can be used to compose find filter objects which can be used within : 
* Collection find()
* Collection findOne()
* (chained) Resultset find()
* Collection Transforms
* DynamicView applyFind()

### Programmatic query examples
The following queries return the same results : 
```javascript
// Core collection 'find' method
var results = coll.find({'Age': {'$gte': 40}});

// Resultset chaining
results = coll.chain().find({'Age': {'$gte': 40}}).data();

// Core collection 'where' method
results = coll.where(function(obj) {
	return obj.Age >= 40;
});
```
### Resultset chaining
The core 'find' and 'where' functionality are two of the main building blocks that Resultset chaining allows you to build from.  Other methods available include : 
* limit - allows limiting the results to a specific document count.
* offset - allows skipping the first number of documents from the results.
* branch - useful for splitting a query path into multiple branches.
* simplesort - just pass a property name and your resulset will be sorted by this.
* sort - allows you to provide your own comparison function to sort the resultset with.
* compoundsort - allows you sort based on multiple properties in ascending or descending order.
* update - used to run an update operation (javascript function) on all documents currently in the resultset.
* remove - removes all document objects which are currently in resultset from collection (as well as resultset)
* map - maps into a new anonymous collection, provide this with a map function
* mapReduce - allows you to specify both a map function and a reduce function on the current resultset data.
* eqJoin - Left joining two sets of data. Join keys can be defined or calculated properties
* transform - at the resultset level, this requires a raw transform array. When beginning a chain, a named or raw transform may be passed in to the chain method.  (See the ['Collection Transforms'](https://github.com/techfort/LokiJS/wiki/Collection-Transforms) wiki page for more details.)

An example making better use of chaining might be the following : 

```javascript
var results = coll.chain()
                  .find({'Age': {'$gt':20}})
                  .where(function(obj) {
                     return obj.Country.indexOf('FR') === 0;
                   })
                  .simplesort('Name')
                  .offset(100)
                  .limit(25)
                  .data();
```

### Resultset branching
Resultsets and their results are not meant to be 'held' around. Those situations usually involve utilitizing Dynamic Views to keep results up-to-date.  You can however temporarily branch a resulset as often as you like, provided that you use the results right away (before any inserts/updates/deletes can occur).  Dynamic views also allows branching results which, in turn, takes its internal resultset and uses this branch to allow you to further query and transform its results without the initial penalty of the already executed filters.

A simple example of collection branching might appear as follows : 
```javascript
var baseResulset = coll.chain().find({'Age': {'$gte': 40}});
var branchedResulset = baseResultset.branch();

var usResults = baseResultset.find({'Country': 'US'}).data();
var ieResults = branchedResulset.find({'Country': 'IE'}).data();
```
The advantage being if the base resulset query was time consuming, your subsequent branches would not need to incur that common cost.  Branching is typically more useful in large collections or extremely time sensitive applications.  

Retaining the resultset (even when not branching) can be done to break up a chain into several parts if you need to examine data() or document counts at various stages in the chain.

### Summary

Wherever possible, use 'Find' queries over 'Where' queries.  'Find' queries are able to utilize indexes if they are applied and are relevant to your query.

The 'Core' (Collection) querying methods (Collection.where(), Collection.find(), Collection.findOne(), Collection.by()) are the best method for learning lokijs.  For many applications this may be sufficient for your query needs.  Features not (yet?) available would be sorting, limiting, offsets and other higher level transformations.  

Chaining queries is done via a call to collection.chain() which instances the Resultset class.  In doing so, we establish a 'state' for our queries.  You can string together multiple 'find', 'where', sorts, limit, offset (etc) operations to progressively filter and transform your results.  You may also establish query branching to split off your query into multiple directions as efficiently as possible.  Chaining via resultsets is still intended for instant evaluation.  If you keep a resultset around in memory, it is not guaranteed to remain up-to-date if the underlying data changes.  Only the first chained operation may use database filters, so prioritize your most expensive find() filter (which has an index applied) to be the first chained operation.

Chaining via transforms allows the same functionality as method chaining to be defined in an object, functioning similar to a stored procedure.  Since it is an object representation, it can (optionally) be named and saved along with your database.  This method is also intended for instant evaluation.

DynamicViews are intended to keep a 'fresh' database view readily available.  You may apply 'find' and 'where' filters, and specify sorting.  As documents are inserted, updated, or removed, you view will immediately be kept up-to-date.  This ensures optimal read performance against your view, as it is always up-to-date.  If your view requires further filtering, you may branch resultsets off of it.  The moment at which you branch off a DynamicView, you take a snapshot of the DynamicView's internal resultset at that point in time, allowing you to perform a wide variety of chaining operations for immediate evaluation.  So if you do DynamicView branching, consider the view as guaranteed freshness and the branches as quick disposable branches to be evaluated.
