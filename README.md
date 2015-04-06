# LokiJS

[![Join the chat at https://gitter.im/techfort/LokiJS](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/techfort/LokiJS?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
![alt CI-badge](https://travis-ci.org/techfort/LokiJS.svg?branch=master)
[![npm version](https://badge.fury.io/js/lokijs.svg)](http://badge.fury.io/js/lokijs)
[![alt packagequality](http://npm.packagequality.com/shield/lokijs.svg)](http://packagequality.com/#?package=lokijs)

## Overview

LokiJS is a document oriented database written in javascript.
Its purpose is to store javascript objects as documents in a nosql fashion and retrieve them with a similar mechanism.
Runs in node (including cordova/phonegap and node-webkit) and the browser.
LokiJS is ideal for the following scenarios: 

1. where a lightweight in-memory db is ideal (e.g., a session store)
2. cordova/phonegap mobile apps where you can leverage the power of javascript and avoid interacting with native databases
3. data sets loaded into a browser page and synchronised at the end of the work session
4. node-webkit desktop apps

LokiJS supports indexing and views and achieves high-performance through maintaining a binary-index for data.

## Demo

The following demos are available:
- [Sandbox / Playground] (https://rawgit.com/techfort/LokiJS/master/examples/sandbox/LokiSandbox.htm)
- a node-webkit small demo in the folder demos/desktop_app. You can launch it by running `/path/to/nw demos/desktop_app/'

## Wiki
Example usage can be found on the [wiki](https://github.com/techfort/LokiJS/wiki)

### Main Features

1. Fast performance NoSQL in-memory database, collections with binary-index
2. Runs in multiple environments (browser, node)
3. Dynamic Views for fast access of data subsets
4. Built-in persistence adapters, and the ability to support user-defined ones
5. Changes API

## Current state

LokiJS is at version 1.2 [Schnee]. While the roadmap is exciting, LokiJS is at the moment stable.
As LokiJS is written in Javascript it can be run on any environment supporting javascript such as browsers, node.js/node-webkit, and hybrid mobile apps (such as phonegap/cordova).

Made by [@techfort](http://twitter.com/tech_fort), with the precious help of Dave Easterday. [Leave a tip](https://gratipay.com/techfort/) or give us a star if you find LokiJS useful!

## Installation

For browser environments you simply need the lokijs.js file contained in src/

You can use bower to install lokijs with `bower install lokijs`

For node environments you can install through `npm install lokijs`.



## Roadmap

* key-value datastore
* MRU cache
* MongoDB API compatibility
* server standalone (tcp and http servers and clients)
* replication and horizontal scaling

## Contact

For help / enquiries contact joe.minichino@gmail.com

## License

Copyright (c) 2015, Joe Minichino <joe.minichino@gmail.com>
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.
3. All advertising materials mentioning features or use of this software
   must display the following acknowledgement:
   This product includes software developed by TechFort.
4. Neither the name of TechFort nor the
   names of its contributors may be used to endorse or promote products
   derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY <COPYRIGHT HOLDER> ''AS IS'' AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
