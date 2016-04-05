Loki.js has always been a fast, in-memory database solution.  In fact, recent benchmarks indicate that its primary get() operation is about _1.4 million operations_ per second fast on a mid-range Core i5 running under node.js.  The get() operation utilizes an auto generated '$loki' id column with its own auto generated binary index. If you wish to supply your own unique key, you can use add a single unique index to the collection to be used along with the collection.by() method.  This method is every bit as fast as using the built in $loki id.  So out of the gate if you intend to do single object lookups you get this performance.

Example specifying your own unique index :
```javascript
var coll = db.addCollection("users", {
    unique: ['username']
});

// after inserting records you might retrieve your record using coll.by() 
var result = coll.by("username", "Heimdallr");
```

A more versatile way to query is to use collection.find() which accepts a mongo-style query object.  If you do not index the column you are searching against, you can expect about 20k ops/sec under node.js (browser performance may vary but this serves as a good order of magnitude).  For most purposes that is probably more performance than is needed, but you can now apply loki.js binary indexes on your object properties as well.  Using the collection.ensureIndex(propertyName) method, you can create an index which can be used by various find() operations such as collection.find().   For our test benchmark, this increased performance to about _500k ops/sec_.

These binary indices can match multiple results or ranges and you might apply your index similar to in this example : 
```javascript
var coll = db.addCollection('users', {
  indices: ['location']
});

// after inserting records you might use equality or range ops,
// such as this implicit $eq op :
var results = users.find({ location:  'Himinbjörg' });
```

'Where' filters (javascript filter functions) should be used sparingly if performance is of concern.  It is unable to utilize indexes, so performance will be no better than an unindexed find, and depending on the complexity of your filter function even less so.  Unindex queries and where filters always require a full array scan but they can be useful if thousands of ops/sec are sufficient or if used later in a query chain or dynamic view filter pipeline with less penalty.

The Resultset class introduced method chaining as an option for querying.  You might use this method chaining to apply several find operations in succession or mix find(), where(), and sort() operations into a sequential chained pipe.  For simplicity, an example of this might be (where users is a collection object) :

```javascript
    users.chain().find(queryObj).where(queryFunc).simplesort('name').data();
```

Examining this statement, if queryObj (a mongo-style query object) were { 'age': { '$gt': 30 } }, then that age column would be best to apply an index on, and that find() chain operation should come first in the chain.  In chained operations, only the first chained operation can utilize the indexes for filtering.  If it filtered out a sufficient number of records, the impact of the (where) query function will be less.  The overhead of maintaining the filtered result set reduces performance by about 20% over collection.find, but they enable much more versatility.  In our benchmarks this is still about _400k ops/sec_.

Dynamic Views behave similarly to resultsets in that you want to utilize an index, your first filter must be applied using

```javascript
  var userview = users.addDynamicView("over30");
  userview.applyFind({'Age': {'$gte':30}});

  // at any time later you can grab the latest view results
  var results = userview.data();

  // or branch the results for further filtering
  results = userview.branchResultset().find({'Country': 'JP'}).data();
```

That find filter should ideally refer to a field which you have applied an index to ('Age' in this case).  Dynamic Views run their filters once however, so even non performant query pipelines are fast after they are set up.  This is due to re-evaluation of those filters on single objects as they are inserted, updated, or deleted from the collection.  Being single object evaluations there is no array scan penalty which occurs during the first evaluation. The overhead of dynamic views, which ride on top of the resultset, reduces performance of the first evaluation by about 40%, however subsequent queries are highly optimized (faster than collection.find).  Even with that overhead, our benchmarks show roughly _300k ops/sec_ performance on initial evaluation. Depending on update frequency, subsequent evaluations can scale up to over 1 million ops/sec.

In loki.js, Dynamic Views have currently have two options, 'persistent' (default is false) and 'sortPriority' (default is 'passive').  

The '**persistent**' option indicates that results will be kept in an internal array (in addition to normal resultset). This 'resultdata' array is filtered and sorted according to your specifications.  This copying of results into the internal array occurs during the first data() evaluation or once filters or sorts are dirty (documents inserted, updated, removed from view).  This options adds memory overhead, but possibly optimizes data() calls.  

The '**sortPriority**' option can be either 'passive' or 'active'.  By default sorting occurs lazily ('passive') when data() is called and the sorts are flagged as dirty.  If you wish the sorting cost to be 'up-front', you can specify 'active' sortPriority.  With active sortPriority, once an insert/update/delete flags a sort as dirty, we will queue and throttle an async sort to run when the thread yields.  So with lower update frequency, or isolated batched modifications, you can pay the performance cost up-front to ensure optimal data() retrieval speed later.  If your data modifications are frequent and sporadic, an active sortPriority might waste computation sorting if no one ever reads the data.