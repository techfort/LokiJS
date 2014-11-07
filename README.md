# LokiJS

## Overview

LokiJS is a document oriented client side database written in javascript.
Its purpose is to store javascript objects as documents in a nosql fashion and retrieve them with a similar mechanism.
Runs in node and the browser.
LokiJS is ideal for the following scenarios: 

1. where a lightweight in-memory db is ideal
2. cross-platform mobile apps where you can leverage the power of javascript and avoid interacting with native databases
3. data sets are not so large that it wouldn't be a problem loading the entire db from a server and synchronising at the end of the work session

LokiJS supports indexing and views and achieves high-performance through maintaining a binary-index for data.

example usage [here](https://github.com/techfort/LokiJS/wiki)

## Current state

LokiJS is currently at an alpha stage, it is stable but not 100% feature complete.
As LokiJS is written in Javascript it can be run on any environment supporting javascript such as browsers, node.js/node-webkit, hybrid mobile apps (such as phonegap/cordova), or the jvm through engines such as rhino.

## Installation

For browser environments you simply need the lokijs.js file contained in src/

You can use bower to install lokijs with `bower install lokijs`

For node environments you can install through `npm install lokijs`.

## Roadmap

* Wider and more specific support for indexes such as unique, compound.
* Replication across nodes.

## Contact

For help / enquiries contact joe.minichino@gmail.com

## License

Copyright (c) 2013, Joe Minichino <joe.minichino@gmail.com>
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
