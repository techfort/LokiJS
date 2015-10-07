# LokiJS

[![Join the chat at https://gitter.im/techfort/LokiJS](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/techfort/LokiJS?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
![alt CI-badge](https://travis-ci.org/techfort/LokiJS.svg?branch=master)
[![npm version](https://badge.fury.io/js/lokijs.svg)](http://badge.fury.io/js/lokijs)
[![alt packagequality](http://npm.packagequality.com/shield/lokijs.svg)](http://packagequality.com/#?package=lokijs)

## Overview


This version of Lokijs for Angular simplifies things to the most basic level because i found Loki difficult to work with in a mobile environment.  all you do is setup json files that specify the layout of your data then add, and update entries to the databases.

###Install:
`bower install --save https://github.com/helzgate/LokiJS.git`

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

LokiJS is a document oriented database written in javascript, published under MIT License.
Its purpose is to store javascript objects as documents in a nosql fashion and retrieve them with a similar mechanism.
Runs in node (including cordova/phonegap and node-webkit) and the browser.
LokiJS is ideal for the following scenarios: 

1. client-side in-memory db is ideal (e.g., a session store)
2. performance critical applications
3. cordova/phonegap mobile apps where you can leverage the power of javascript and avoid interacting with native databases
4. data sets loaded into a browser page and synchronised at the end of the work session
5. node-webkit desktop apps

LokiJS supports indexing and views and achieves high-performance through maintaining unique and binary indexes (indices) for data.

## Demo

The following demos are available:
- [Sandbox / Playground] (https://rawgit.com/techfort/LokiJS/master/examples/sandbox/LokiSandbox.htm)
- a node-webkit small demo in the folder demos/desktop_app. You can launch it by running `/path/to/nw demos/desktop_app/'

## Wiki
Example usage can be found on the [wiki](https://github.com/techfort/LokiJS/wiki)

### Main Features

1. Fast performance NoSQL in-memory database, collections with unique index (1.1M ops/s) and binary-index (500k ops/s)
2. Runs in multiple environments (browser, node)
3. Dynamic Views for fast access of data subsets
4. Built-in persistence adapters, and the ability to support user-defined ones
5. Changes API
6. Joins

## Current state

LokiJS is at version 1.3 [Eostre].
As LokiJS is written in Javascript it can be run on any environment supporting javascript such as browsers, node.js/node-webkit, and hybrid mobile apps (such as phonegap/cordova).

Made by [@techfort](http://twitter.com/tech_fort), with the precious help of Dave Easterday. [Leave a tip](https://gratipay.com/techfort/) or give us a star if you find LokiJS useful!

## Installation

For browser environments you simply need the lokijs.js file contained in src/

You can use bower to install lokijs with `bower install lokijs`

For node environments you can install through `npm install lokijs`.



## Roadmap
* exactIndex
* key-value datastore
* MRU cache
* MongoDB API compatibility
* server standalone (tcp and http servers and clients)
* replication and horizontal scaling

## Contact

For help / enquiries contact joe.minichino@gmail.com

## Commercial Support

For commercial support contact info.techfort@gmail.com

## License

Copyright (c) 2015 TechFort <joe.minichino@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

