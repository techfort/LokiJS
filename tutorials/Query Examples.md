### Designing Queries

LokiJS has evolved several mechanisms for querying the database.  It may be difficult at first to determine which method you should use for querying, so this page will attempt to describe features and limitations of the various methods.

At the highest level of abstraction, let us divide the methods into these categories : 
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
Find queries are based on subset of mongo query syntax.  This method is capable of utilizing indexes and when used with Collection Transforms or Dynamic Views, these filters can be saved into the database itself.  This is the preferred method for querying a Loki database.  Query everything (or filter as much as you can) with find queries, and use 'where' filtering if there are edge cases which find does not support (or does not support yet).

### 'Find' Operators
The primary operators currently supported are : 

* $eq - filter for document(s) with property of (strict) equality
* $dteq - filter for document(s) with date property equal to provided date value
* $gt - filter for document(s) with property greater than provided value
* $gte - filter for document(s) with property greater or equal to provided value
* $lt - filter for document(s) with property less than provided value
* $lte - filter for document(s) with property less than or equal to provided value
* $ne - filter for document(s) with property not equal to provided value
* $regex - filter for document(s) with property matching provided regular expression
* $in - filter for document(s) with property matching any of the provided array values.
* $contains - filter for document(s) with property containing the provided value
* $containsAny - filter for document(s) with property containing any of the provided values
* $containsNone - filter for documents(s) with property containing none of the provided values
* $and - filter for documents which meet all nested subexpressions
* $or - filter for documents which meet any of the nested subexpressions

### Features which support 'find' queries
These operators can be used to compose find filter objects which can be used within : 
* Collection find()
* Collection findOne()
* (chained) Resultset find()
* Collection Transforms
* DynamicView applyFind()

### 'Find' Operator Examples : 

$eq / $ne : 
```javascript
// explicit
var results = coll.find({'Name': { '$eq' : 'Odin' }});

// implicit (assumes equality operator)
results = coll.find({'Name': 'Odin'});

// not equal test
results = coll.find({'legs': { '$ne' : 8 }});
```

$regex:
```javascript
// pass in raw regex
var results = coll.find({'Name': { '$regex' : /din/ }});

// or pass in string pattern only
results = coll.find({'Name': { '$regex': 'din' }});

// or pass in [pattern, options] string array
results = coll.find({'Name': { '$regex': ['din', 'i'] }});
```
> _If using regex operator within a named transform or dynamic view filter, it is best to use the latter two examples since raw regex does not seem to serialize/deserialize well._

$in:
```javascript
var users = db.addCollection("users");
users.insert({ name : 'odin' });
users.insert({ name : 'thor' });
users.insert({ name : 'svafrlami' });

// match users with name in array set ['odin' or 'thor']
var results = users.find({ 'name' : { '$in' : ['odin', 'thor'] } });
```

$contains / $containsAny / $containsNone
```javascript
var users = db.addCollection("users");
users.insert({ name : 'odin', weapons : ['gungnir', 'draupnir']});
users.insert({ name : 'thor', weapons : ['mjolnir']});
users.insert({ name : 'svafrlami', weapons : ['tyrfing']});
users.insert({ name : 'arngrim', weapons : ['tyrfing']});

// returns 'svafrlami' and 'arngrim' documents
var results = users.find({ 'weapons' : { '$contains' : 'tyrfing' } });

// returns 'svafrlami', 'arngrim', and 'thor' documents
results = users.find({ 'weapons' : { '$containsAny' : ['tyrfing', 'mjolnir'] } });

// returns 'svafrlami' and 'arngrim'
results = users.find({ 'weapons' : { '$containsNone' : ['gungnir', 'mjolnir'] } });
```

### Composing Nested Queries

$and : 
```javascript
// fetch documents matching both sub-expressions
var results = coll.find({
  '$and': [{ 
      'Age' : {
        '$gt': 30
      }
    },{
      'Name' : 'Thor'
    }]
});
```

$or : 
```javascript
// fetch documents matching any of the sub-expressions
var results = coll.find({
  '$or': [{ 
      'Age' : {
        '$gte': '40'
      }
    },{
      'Name' : 'Thor'
    }]
});
```

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
* transform - at the resultset level, this requires a raw transform array. When beginning a chain, a named or raw transform may be passed in to the chain method.  See 'Collection Transforms' wiki page for more details.

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

### Strategies for determining which methods to use

Wherever possible, use 'Find' queries over 'Where' queries.  'Find' queries are able to utilize indexes if they are applied and are relevant to your query.

The 'Core' (Collection) querying methods (Collection.where(), Collection.find(), Collection.findOne(), Collection.by()) are the best method for learning lokijs.  For many applications this may be sufficient for your query needs.  Features not (yet?) available would be sorting, limiting, offsets and other higher level transformations.  

Chaining queries is done via a call to collection.chain() which instances the Resultset class.  In doing so, we establish a 'state' for our queries.  You can string together multiple 'find', 'where', sorts, limit, offset (etc) operations to progressively filter and transform your results.  You may also establish query branching to split off your query into multiple directions as efficiently as possible.  Chaining via resultsets is still intended for instant evaluation.  If you keep a resultset around in memory, it is not guaranteed to remain up-to-date if the underlying data changes.  Only the first chained operation may use database filters, so prioritize your most expensive find() filter (which has an index applied) to be the first chained operation.

Chaining via transforms allows the same functionality as method chaining to be defined in an object, functioning similar to a stored procedure.  Since it is an object representation, it can (optionally) be named and saved along with your database.  This method is also intended for instant evaluation.

DynamicViews are intended to keep a 'fresh' database view readily available.  You may apply 'find' and 'where' filters, and specify sorting.  As documents are inserted, updated, or removed, you view will immediately be kept up-to-date.  This ensures optimal read performance against your view, as it is always up-to-date.  If your view requires further filtering, you may branch resultsets off of it.  The moment at which you branch off a DynamicView, you take a snapshot of the DynamicView's internal resultset at that point in time, allowing you to perform a wide variety of chaining operations for immediate evaluation.  So if you do DynamicView branching, consider the view as guaranteed freshness and the branches as quick disposable branches to be evaluated.