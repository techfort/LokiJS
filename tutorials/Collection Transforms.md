## Collection transforms

**_The basic idea behind transforms is to allow converting a Resultset 'chain' process into an object definition of that process.  This data definition can then be optionally named and saved along with the collections, within a  database._**

This might be useful for :  
* Writing tools which operate on loki databases
* Creating 'stored procedure-like' named queries
* Transforming your data for extraction purposes
* Can be extended upon with custom meta

A transform is a (ordered) array of 'step' objects to be executed on collection chain.  These steps may include the following types : 
* 'find'
* 'where'
* 'simplesort'
* 'compoundsort'
* 'sort'
* 'limit'
* 'offset'
* 'update'
* 'remove'
* 'map'
* 'mapReduce'
* 'eqJoin' 

These transform steps may hardcode their parameters or use a parameter substitution mechanism added for loki transforms.

A simple, one step loki transform might appear as follows : 
```javascript
var tx = [
  {
    type: 'find',
    value: {
      'owner': 'odin'
    }
  }
];
```

This can then optionally be saved into the collection with the command : 
```
userCollection.addTransform('OwnerFilter', tx);
```

This transform can be executed by either : 
```javascript
userCollection.chain('OwnerFilter').data();
```

or 

```javascript
userCollection.chain(tx).data();
```

Parameterization is resolved on any object property right-hand value which is represented in your transform as a string beginning with '[%lktxp]'.  An example of this might be : 
```javascript
var tx = [
  {
    type: 'find',
    value: {
      'owner': '[%lktxp]OwnerName'
    }
  }
];
```

To execute this pipeline you need to pass a parameters object containing a value for that parameter when executing.  An example of this might be : 

```javascript
var params = {
  OwnerName: 'odin'
};

userCollection.chain(tx, params).data();
```

or

```javascript
userCollection.chain("OwnerFilter", params).data();
```

**Where filter functions cannot be saved into a database** but (if you still need them), utilizing transforms along with parameterization can allow for cleanly structuring and executing saved transforms.  An example might be : 
```javascript
var tx = [
  {
    type: 'where',
    value: '[%lktxp]NameFilter'
  }
];

items.addTransform('ByFilteredName', tx);

// the following may then occur immediately or even across save/load cycles
// this example uses anonymous function but this could be named function reference as well
var params = {
  NameFilter: function(obj) {
    return (obj.name.indexOf("nir") !== -1);
  }
};

var results = items.chain("ByFilteredName", params).data();

```

Transforms can contain multiple steps to be executed in succession.  Behind the scenes, the chain command will instance a Resultset and invoke your steps as independent chain operations before finally returning the result upon completion.  A few of the built in 'steps' such as 'mapReduce' actually terminate the transform/chain by returning a data array, so in those cases the chain() result is the actual data, not a resultset which you would need to call data() to resolve.

A more complicated transform example might appear as follows : 
```javascript
var tx = [
  {
    type: 'find',
    value: {
      owner: {
        '$eq': '[%lktxp]customOwner'
      }
    }
  },
  {
    type: 'where',
    value: '[%lktxp]customFilter'
  },
  {
    type: 'limit',
    value: '[%lktxp]customLimit'
  }
];

function myFilter(obj) {
  return (obj.name.indexOf("nir") !== -1);
}

var params = {
  customOwner: 'odin',
  customFilter: myFilter,
  customLimit: 100
}

users.chain(tx, params);
```

As demonstrated by the above example, we will scan the object hierarchy (up to 10 levels deep) and do parameter substitution on right hand values which appear to be parameters, which we will then attempt to look up from your params object.  The parameter substitution will replace that string with a value identical to that contained in your params which can be any data type.

Certain steps which are multiple parameter require specifically named step properties (other than just type and value).  These are demonstrated below as separate steps which do not necessarily make sense within a single transform : 

```javascript
var step1 = {
  type: 'simplesort',
  property: 'name',
  desc: true
};

var step2 = {
  type: 'mapReduce',
  mapFunction: myMap,
  reduceFunction: myReduce
};

var step3 = {
  type: 'eqJoin',
  joinData: jd,
  leftJoinKey: ljk,
  rightJoinKey: rjk,
  mapFun: myMapFun
};

var step4 = {
  type: 'remove'
}
```
## Support within DynamicViews

You can now use transforms as an extraction method for a DynamicView.  Certain applications might use this to create a DynamicView containing a generalized set of results which can be quickly extracted from in user defined transforms.  This feature is provided within the DynamicView's branchResultset() method.  It can accept raw transforms or named transforms stored at the collection level.

An example of this might look like the following : 
```javascript
var db = new loki('test');
var coll = db.addCollection('mydocs');
var dv = coll.addDynamicView('myview');
var tx = [
  {
    type: 'offset',
    value: '[%lktxp]pageStart'
  },
  {
    type: 'limit',
    value: '[%lktxp]pageSize'
  }
];
coll.addTransform('viewPaging', tx);

// add some records

var results = dv.branchResultset('viewPaging', { pageStart: 10, pageSize: 10 }).data();

```

The important distinction is that branching (and thus your transform results) reflect only the view at the point in time at which you branch.  These transforms are extracts and not used internally to the view.

## Adding meta for custom solutions

One use for transforms might be to have user driven solutions where you have the user interface constructing, managing, and executing these transforms.  In such situations you might want to add your own metadata to the transforms to further describe the transform, steps, or parameters.

- Any step with a 'type' unknown to loki transforms will be ignored.  You might decide to always have the first step as a 'meta' type with properties containing information about author, description, or required parameter description meta data.  
- Each of the steps may also include additional properties above what we have defined as required, so you might have step descriptions, last changed dates, etc embedded within steps.

## Summary
Loki transforms establish (with little additional footprint) a process for automating data transformations on your data.  This is not a required functionality and is not intended to replace method chaining, but it allows you to abstract and organize repetitive querying for cleanliness or dynamic purposes.
