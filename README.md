# LokiJS Simplified for Angular Dummies

[![Join the chat at https://gitter.im/techfort/LokiJS](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/techfort/LokiJS?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
![alt CI-badge](https://travis-ci.org/techfort/LokiJS.svg?branch=master)
[![npm version](https://badge.fury.io/js/lokijs.svg)](http://badge.fury.io/js/lokijs)
[![alt packagequality](http://npm.packagequality.com/shield/lokijs.svg)](http://packagequality.com/#?package=lokijs)

## Overview


This version of Lokijs for Angular simplifies things to the most basic level because i found Loki difficult to work with in a mobile environment.  all you do is setup json files that specify the layout of your data then add, and update entries to the databases.

###Install:
`git clone https://github.com/helzgate/LokiJS.git`

###Html:
```
<script src="lokijs/src/lokijs.js"></script>
<script src="lokijs/src/loki-angular.js"></script>
```

###App:
`angular.module('app',['lokijs']);`

###Configure database template:

````
(function(){
	angular.module('app').constant(
	'json1', 
	{  
   		"db":"locations",
   		"collection": "Cities" ,
		   "documents" :
			[  
   		   		{
					"name": "Tulsa",
					"enabled" : true,
					"face" : "You now it"
   		   		}
			]
	}
	)
})();
````
###Controller:
```
angular.module('app').controller('myCtrl', myCtrl);
myCtrl.$inject = ['Lokiwork'];
```
###Regular use: (you have to set the current doc first)

`Lokiwork.setCurrentDoc(<database>, <collection>, <document name>)`

####Examples
```
 Lokiwork.setCurrentDoc('settings', 'globals', {'name': "user settings"})
    .then(function(data){               
       Lokiwork.updateDoc("face", "i guess you don't know it");
    });
    
  Lokiwork.deleteCurrentDoc();
  
  Lokiwork.getCurrentDoc();
  
  Lokiwork.getCollection('settings', 'globals');
  
  Lokiwork.deleteDatabase("settings");
  
  Lokiwork.addDocument("settings", "globals", {name:"user settings", gay: true, brands:false})
            	.then(function(){             
              		console.log('successfully created new document');            
          		});
```

###Notes:
- If you delete a database it's recreated the next time the app is restarted and on the first query because it will see the angular json file and recreate it (it won't overwrite existing though).  If you want to permanantly remove a database, then you have to also remove the angular json file.  This is perfect, because on a mobile device the user may have local storage wiped, no problem, because the next time they boot up the databases will all be recreated.

- If you create multiple databases, the code will automatically switch between the databases for you when you specify the current working doc `Lokiwork.setCurrentDoc(...)`  You may not need to ability to have multiple databases, but it's there.

- Each angular json file has to be titled, "json1", "json2" for the next one, "json3", etc.
- "db" title has to be spelled exactly "db"
- "collection" title has to be spelled exactly "collection"

###Demo (not working though, something weird going on with angular + Plnkr)
[plkr](http://embed.plnkr.co/3H1kgFKWsr341zsWLZvp/preview)

###The official Lokijs page
[LokiJS](https://github.com/techfort/LokiJS)