# LokiJS

[![Join the chat at https://gitter.im/techfort/LokiJS](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/techfort/LokiJS?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
![alt CI-badge](https://travis-ci.org/techfort/LokiJS.svg?branch=master)
[![npm version](https://badge.fury.io/js/lokijs.svg)](http://badge.fury.io/js/lokijs)
[![alt packagequality](http://npm.packagequality.com/shield/lokijs.svg)](http://packagequality.com/#?package=lokijs)

## Overview


This version of Lokijs for Angular simplifies things to the most basic level because i found Loki difficult to work with in a mobile environment.  all you do is setup json files that specify the layout of your data then add, and update entries to the databases.

###Install:
`bower install --save https://github.com/helzgate/LokiJS.git`

###Html:
```
<script src="bower_components/lokijs/src/lokijs.js"></script>
<script src="bower_components/lokijs/src/loki-angular.js"></script>
```

###App:
`angular.module('app',['lokijs']);`

###Configure database template:

````(function(){
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

```
 Lokiwork.setCurrentDoc('settings', 'globals', {'name': "user settings"})
    .then(function(data){               
       Lokiwork.updateDoc("face", "i guess you don't know it");
    });
```
###Demo (not working though, something weird going on with angular + Plnkr)
[plkr](http://embed.plnkr.co/3H1kgFKWsr341zsWLZvp/preview)

###The official Lokijs page
[LokiJS](https://github.com/techfort/LokiJS)