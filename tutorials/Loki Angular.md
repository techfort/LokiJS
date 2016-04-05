# Lokiwork, the LokiJS Angular Service


## Overview


This service of Lokijs for Angular simplifies things to the most basic level because i found Loki difficult to work with in a mobile environment.  all you do is setup json files that specify the layout of your data then add, and update entries to the databases.

### Demo
View the Plunker demo [here](http://plnkr.co/3H1kgFKWsr341zsWLZvp).

### Install:
`bower install lokijs`

### Html:
```
<script src="bower_components/lokijs/src/lokijs.js"></script>
<script src="bower_components/lokijs/src/loki-angular.js"></script>
```

### App:
`angular.module('app',['lokijs']);`

### Configure database template:
I might call this file -> `json_locations.js` Note: each one has to be called, json1, json2, json3, etc as shown in the following: 
````
app.constant(
	'json1', 
	{  
   		"db":"settings",
   		"collection": "globals" ,
		   "documents" :
			[  
   		   		{
					"name": "user settings",
					"brands" : true,
					"random" : "some value"
   		   		}
			]
	}
	);
````
### Controller:
```
app.controller('myCtrl', function($scope, Lokiwork){...});
```
### Usage:

Lokiwork.setCurrentDoc(dbname, collection, document_identifier);

    Lokiwork.setCurrentDoc('settings', 'globals', {'name': "user settings"});

Lokiwork.getCurrentDoc();

    Lokiwork.getCurrentDoc();
 
Lokiwork.updateCurrentDoc(name, value);
  
    Lokiwork.updateCurrentDoc("power", true);

Lokiwork.deleteCurrentDoc();

    Lokiwork.deleteCurrentDoc();

Lokiwork.getDoc(dbName, collName, docName);

    Lokiwork.getDoc("settings", "globals", {name:"user settings"});

Lokiwork.addDocument(dbName, collName, newDoc);

    Lokiwork.addDocument("settings", "globals", doc_obj); //example below

Lokiwork.updateDoc(dbname, collName, document_identifier, name, value);

    Lokiwork.updateDoc("settings", "globals", {name:"user settings"}, "brands", false});

Lokiwork.deleteDocument(dbName, collName, document_identifier);

    Lokiwork.deleteDocument('settings','globals', {name:'user settings'});

Lokiwork.getCollection(dbName, collName);

    Lokiwork.getCollection('settings', 'globals');

Lokwork.addCollection(json_obj);

    Lokiwork.addCollection(item); // example below

Lokiwork.deleteCollection(dbName, collName);

    Lokiwork.deleteCollection('settings', globals');

Lokiwork.deleteDatabase(dbName);
 
    Lokiwork.deleteDatabase("settings");

#### Further examples:
  
  ```
var collection = {  
  "db":"settings",
  "collection": "globals" ,
  "documents" :
  [  
   	{
      "name": "user settings",
      "brands" : true,
      "face" : "You now it"
   	}
  ]
};
   Lokiwork.addCollection(collection);
   ```
   
With addDocument, you can pass a json document in if it's small enough, otherwise assign it to a variable first.
```
Lokiwork.addDocument("settings", "globals", {name:"user settings2", gay: true, brands:false})
```
You can also use promises and/or chain them:
```
Lokiwork.setCurrentDoc('settings', 'globals', {'name': "user settings"})
    .then(function(data){               
       Lokiwork.updateCurrentDoc("address", "1801 Waters Ridge Drive");
    });
```

### Remember!
A lot of the above commands may not be necessary if you are implementing a static change, just edit the underlying json javascript file, delete the local storage file, and restart the app.

### Notes:
- If you delete a database it's recreated the next time the app is restarted and on the first query because it will see the angular json file and recreate it (it won't overwrite existing though).  If you want to permanantly remove a database, then you have to also remove the angular json file.  This is perfect, because on a mobile device the user may have local storage wiped, no problem, because the next time they boot up the databases will all be recreated.
- Since Lokijs is generating all of the database content it should be 100% compatible with native Lokijs commands not listed here but found on the office website shown below.


### The official Lokijs page
[LokiJS](https://github.com/techfort/LokiJS)