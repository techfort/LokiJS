/*
  Loki Angular Adapter (need to include this script to use it)
 * @author Joe Minichino <joe.minichino@gmail.com>
 *
 * A lightweight document oriented javascript database
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['angular', 'lokijs'], factory);
    } else if (typeof exports === 'object') {
        // CommonJS
        module.exports = factory();
    } else {
        // Browser globals
        root.lokiAngular = factory(
            root.angular,
            // Use thirdParty.loki if available to cover all legacy cases
            root.thirdParty && root.thirdParty.loki ?
            root.thirdParty.loki : root.loki
        );
    }
}(this, function (angular, lokijs) {
    var module = angular.module('lokijs', [])
        .factory('Loki', Loki)
        .service('Lokiwork', Lokiwork);

    function Loki() {
        return loki;
    }
    Lokiwork.$inject = ['Loki', '$q', '$injector', '$window'];

    function Lokiwork(Loki, $q, $injector, $window) {
        var vm = this;
        vm.checkStates = checkStates;
        var statesChecked = false;
        var db;
        var userDbPreference = '';
        var userPrefJsonFile = 0;
        var numOfJsonDatabases = 0;
        var dbitems = [];
        var lokidbs = [];
        vm.dbExists = dbExists;
        vm.closeDb = closeDb;
        vm.closeAllDbs = closeAllDbs;
        vm.getCollection = getCollection;
        vm.addCollection = addCollection;
        vm.removeCollection = removeCollection;
        vm.getDoc = getDoc;
        vm.updateDoc = updateDoc;
        vm.updateCurrentDoc = updateCurrentDoc;
        vm.setCurrentDoc = setCurrentDoc;
        vm.getCurrentDoc = getCurrentDoc;
        vm.deleteDocument = deleteDocument;
        vm.deleteCurrentDoc = deleteCurrentDoc;
        vm.deleteDatabase = deleteDatbase;
        vm.addDocument = addDocument;
        vm.insertItemInDoc = insertItemInDoc;
        var currentDoc = {};
        var currentColl = {};
        numOfJsonDatabases = getNumberOfJsonDatabases();



        function getCurrentDoc() {
            return currentDoc;
        }

        function deleteDatbase(data) {
            localStorage.removeItem(data);
        }

        function deleteDocument(dbName, collName, doc) { //doc should be in {name:value} format 
            return $q(function (resolve, reject) {
                userDbPreference = dbName;
                _getem('delete_doc', dbName, collName, doc)
                    .then(function (data) {
                        currentDoc = {};
                        resolve(data);
                    }, function(data){
                            reject(data);
                        });
            });
        }


        function insertItemInDoc(item) {
            return $q(function (resolve, reject) {
                _getem('insert_item_in_doc', currentDoc.dbName, currentDoc.collName, currentDoc.doc, "", item)
                    .then(function (data) {
                        resolve(data);
                    }, function (data) {
                        reject(data);
                    });
            });
        }

        function deleteCurrentDoc() {
            return $q(function (resolve, reject) {
                _getem('delete_current_doc')
                    .then(function (data) {
                        resolve(data);
                    }, function (data) {
                        reject(data);
                    });
            });
        }

        function addDocument(dbName, collName, newDoc) {
            return $q(function (resolve, reject) {
                userDbPreference = dbName;
                _getem('create_doc', dbName, collName, "", "", newDoc)
                    .then(function (data) {
                        currentDoc.dbName = dbName;
                        currentDoc.collName = collName;
                        currentDoc.doc = data;
                        currentDoc.lokiNum = data[0].$loki;
                        resolve(data[0]);
                    }, function(data){
                            reject(data);
                        });
            });
        }

        function setCurrentDoc(dbName, collName, docName) {
            return $q(function (resolve, reject) {
                userDbPreference = dbName;
                _getem('set_doc', dbName, collName, docName)
                    .then(function (data) {
                        currentDoc.dbName = dbName;
                        currentDoc.collName = collName;
                        currentDoc.doc = data;
                        currentDoc.lokiNum = data[0].$loki;
                        resolve(data[0]);
                    }, function(data){
                            reject(data);
                        });
            });
        }

        function updateCurrentDoc(thekey, thevalue) {
            return $q(function (resolve, reject) {
                if (currentDoc) {
                    _getem('update__current_doc', currentDoc.dbName, currentDoc.collName, currentDoc.doc, thekey, thevalue)
                        .then(function (data) {
                            resolve(data[0]);
                        }, function(data){
                            reject(data);
                        });
                } else {
                    reject("you have to set a current doc first, use: setCurrentDoc(dbName, collName, docName)");
                }
            });
        }

        function updateDoc(dbName, collName, docName, thekey, thevalue) {
            return $q(function (resolve, reject) {
                userDbPreference = dbName;
                if (currentDoc) {
                    _getem('update_doc', dbName, collName, docName, thekey, thevalue)
                        .then(function (data) {
                            resolve(data[0]);
                        }, function(data){
                            reject(data);
                        });
                } else {
                    reject("bad, check parameters)");
                }
            });
        }

        function getDoc(dbName, collName, docName) {
            return $q(function (resolve, reject) {
                userDbPreference = dbName;
                _getem('get_doc', dbName, collName, docName)
                    .then(function (data) {
                        currentDoc.dbName = dbName;
                        currentDoc.collName = collName;
                        currentDoc.doc = data;
                        currentDoc.lokiNum = data[0].$loki;
                        resolve(data[0]);
                    }, function(data){
                            reject(data);
                        });
            });
        }

        function getCollection(dbName, collName) {
            return $q(function (resolve, reject) {
                userDbPreference = dbName;
                _getem('get_collection', dbName, collName)
                    .then(function (data) {
                        currentColl.dbName = dbName;
                        currentColl.collName = collName;
                        resolve(data);
                    }, function(data){
                            reject(data);
                        });
            });
        }

        function removeCollection(dbName, collName) {
            return $q(function (resolve, reject) {
                userDbPreference = dbName;
                _getem('remove_collection', dbName, collName)
                    .then(function (data) {
                        currentColl = {};
                        resolve(data);
                    }, function(data){
                            reject(data);
                        });
            });
        }

        function addCollection(collData) {
            return $q(function (resolve, reject) {
                userDbPreference = collData.db;
                _getem('add_collection', collData.db, '', '', '', collData)
                    .then(function (data) {
                        currentColl.dbName = collData.db;
                        currentColl.collName = collData.collection;
                        resolve(data);
                    }, function(data){
                            reject(data);
                        });
            });
        }


        // function _getCollIndex(dbName, collName){
        //   db.loadDatabase(dbName);
        //   var coll = db.getCollection(collName);

        // }

        function _getem(operation, dbName, collName, docName, thekey, thevalue) {
            return $q(function (resolve, reject) {
                if (db) {
                    if (db.filename === dbName) {
                        getdata();
                    } else {
                        loadDb(dbName)
                            .then(function () {
                                getdata();
                            });
                    }
                } else {
                    if (statesChecked) {
                        loadDb(dbName)
                            .then(function () {
                                getdata();
                            });
                    } else {
                        checkStates().then(function () {
                            getdata();
                        }, function(data){
                            reject(data);
                        });
                    }
                }
                
                

                function getdata() {
                    if (operation === 'update_doc' || operation === 'insert_item_in_doc') {
                        db.loadDatabase(dbName);
                        var coll = db.getCollection(collName);
                        
                        for(var i in docName) {
                            currentDoc.key = i;
                            currentDoc.value = docName[i];
                        }
                        for (var x = 0; x < coll.data.length; x++){
                            if (coll.data[x][currentDoc.key] == currentDoc.value){
                                currentDoc.lokiNum = coll.data[x].$loki;
                            }
                        }
                        found = coll.get(parseInt(currentDoc.lokiNum, 10));

                        if (operation === 'update_doc') {
                            if( Object.prototype.toString.call( thevalue ) === '[object Array]' ) {
                                found[thekey] = angular.toJson(thevalue);
                            }
                            else if( Object.prototype.toString.call( thevalue ) === '[object Object]' ) {
                                found[thekey] = angular.toJson(thevalue);
                            }
                            else {
                                found[thekey] = thevalue;
                            }
                            coll.update(found);
                        } else {
                            found.insert(thevalue);
                        }
                        db.save();
                        resolve(true);
                    }
                    else if(operation === 'update_current_doc'){
                         db.loadDatabase(dbName);
                        var coll0 = db.getCollection(collName);
                        found = coll0.get(parseInt(currentDoc.lokiNum, 10));
                        if( Object.prototype.toString.call( thevalue ) === '[object Array]' ) {
                            found[thekey] = angular.toJson(thevalue);
                        }
                        else if( Object.prototype.toString.call( thevalue ) === '[object Object]' ) {
                            found[thekey] = angular.toJson(thevalue);
                        }
                        else {
                            found[thekey] = thevalue;
                        }
                        coll0.update(found);
                        
                        db.save();
                        resolve(true);
                    } 
                    else if (operation === 'delete_current_doc' || operation === 'delete_doc') {
                        db.loadDatabase(dbName);
                        var coll6 = db.getCollection(collName);
                        if(operation === 'delete_doc'){
                            for(var i in docName) {
                            currentDoc.key = i;
                            currentDoc.value = docName[i];
                        }
                        for (var x = 0; x < coll6.data.length; x++){
                            if (coll6.data[x][currentDoc.key] == currentDoc.value){
                                currentDoc.lokiNum = coll6.data[x].$loki;
                            }
                        }
                        }
                        coll6.remove(currentDoc.lokiNum);                        
                        db.save();
                        resolve(true);
                    }                    
                    else if (operation === 'get_doc' || operation === 'set_doc') {
                        db.loadDatabase(dbName);
                        var coll1 = db.getCollection(collName);
                        var found = coll1.find(docName);
                        resolve(angular.fromJson(found));
                    } else if (operation === 'get_collection') {
                        db.loadDatabase(dbName);
                        var coll2 = db.getCollection(collName);
                        resolve(angular.fromJson(coll2));
                    } else if (operation === 'remove_collection') {
                        db.loadDatabase(dbName);
                        db.removeCollection(collName);
                        //coll = db.getCollection(collName);
                        db.save(function () {
                            resolve('collection deleted');
                        });
                    } else if (operation === 'add_collection') {
                        db.loadDatabase(thevalue.db);
                        var items = db.addCollection(thevalue.collection);
                        items.insert(thevalue.documents);
                        db.save(function () {
                            resolve('collection added');
                        });

                    } else if (operation === 'create_doc') {
                        db.loadDatabase(dbName);
                        var coll3 = db.getCollection(collName);
                        coll3.insert(thevalue);
                        db.save(function () {
                            var found = coll3.find({
                                name: thevalue.name
                            });
                            resolve(angular.fromJson(found));
                        });

                    } 
                    // _getem('delete_doc', dbName, collName, "", "", doc)
                    else if (operation === 'delete_current_doc') {
                        var coll5 = db.getCollection(currentDoc.collName);
                        if (!coll5) {
                            reject('You forgot to specify a current doc first');
                        } else {
                            coll5.remove(parseInt(currentDoc.lokiNum, 10));
                            db.save();
                            resolve(true);
                        }
                    }
                }
            });
        }

        function dbExists(databaseName) {
            var value = window.localStorage.getItem(databaseName);
            if (value) {
                return true;
            } else {
                return false;
            }
        }

        function closeAllDbs() {
            return $q(function (resolve, reject) {
                var current = 0;
                for (var x = 0; x < lokidbs.length; x++) {
                    current++;
                    lokidbs[x].close();
                    if (x === (lokidbs.length - 1)) {
                        resolve();
                    }
                }
            });
        }

        function closeDb(databaseName) {
            return $q(function (resolve, reject) {

                for (var x = 0; x < lokidbs.length; x++) {
                    if (lokidbs.filename === databaseName) {
                        lokidbs[x].close();
                        resolve();
                        break;
                    }
                }

            });
        }


        function checkStates() {
            return $q(function (resolve, reject) {
                if (dbitems.length === 0) {
                    initialiseAll().then(function () {
                        console.log('had to initialize all dbs');
                        statesChecked = true;
                        resolve();
                    }, function (data) {
                        reject(data);
                    });
                } else {
                    console.log('db list already initialized');
                    resolve();
                }
            });
        }

        function firstFewItemsOfDbList() {
            return $q(function (resolve, reject) {
                for (var x = 0; x < numOfJsonDatabases; x++) {
                    if ($injector.has('json' + (x + 1))) {
                        var item = {};
                        var setting = $injector.get('json' + (x + 1));
                        if (setting.db === userDbPreference) { //userDbPreference is the name
                            userPrefJsonFile = x + 1; //userPrefJsonFile is the index
                            if (x === (numOfJsonDatabases - 1)) {
                                resolve();
                            }
                        } else {
                            item.filename = setting.db;
                            item.json = x + 1;
                            dbitems.push(item);
                            if (x === (numOfJsonDatabases - 1)) {
                                resolve();
                            }
                        }
                    }
                }
            });
        }

        function initialiseDbList() {
            return $q(function (resolve, reject) {                
                firstFewItemsOfDbList()
                    .then(function () {
                        if (userPrefJsonFile == 0){
                            reject('Oops!, you didn\'t specify any starting document');
                        }
                        var currentdb = $injector.get('json' + userPrefJsonFile);
                        var item = {};
                        item.filename = currentdb.db;
                        item.json = userPrefJsonFile;
                        dbitems.push(item);
                        resolve();
                    });
            });
        }

        function getNumberOfJsonDatabases() {
            if (numOfJsonDatabases >= 1) {
                return numOfJsonDatabases;
            } else {
                for (var x = 0; x < 10; x++) {
                    if ($injector.has('json' + (x + 1))) {
                        numOfJsonDatabases++;
                    }

                }
                return numOfJsonDatabases;
            }
        }

        var still_running = false;
        var current_iteration = 1;

        function initialiseAll() {
            return $q(function (resolve, reject) {
                initialiseDbList()
                    .then(function () {

                        function iterate_me() {
                            if ($injector.has('json' + dbitems[current_iteration - 1].json)) {
                                var setting = $injector.get('json' + dbitems[current_iteration - 1].json);

                                console.log('number = ' + current_iteration);
                                var set = angular.fromJson(setting);
                                still_running = true;
                                console.log('about to load' + set.db);
                                initiateDb(set)
                                    .then(function () {
                                        //lokidbs.push(angular.copy(db));
                                        if (!doesDBAlreadyExistInArray(db.filename)) {
                                            lokidbs.push(angular.copy(db));
                                        }
                                        still_running = false;
                                        if (current_iteration === (dbitems.length)) {
                                            resolve();
                                        } else {
                                            current_iteration++;
                                            iterate_me();
                                            return;
                                        }
                                    });
                            }
                        }
                        iterate_me();
                    }, function(data){
                        reject(data);
                    });
            });
        }

        function doesDBAlreadyExistInArray(dbname) {
            var answer = false;
            for (var x = 0; x < lokidbs.length; x++) {
                if (lokidbs[x].filename === dbname) {
                    answer = true;
                }
            }
            return answer;
        }

        function getIndexOfDbItem(dbname) {
            var answer = -1;
            for (var x = 0; x < numOfJsonDatabases; x++) {
                if (dbitems[x].filename === dbname) {
                    answer = x;
                }
            }
            return answer;
        }

        function loadDb(databaseName) {
            return $q(function (resolve, reject) {
                for (var x = 0; x < lokidbs.length; x++) {
                    if (lokidbs[x].filename === databaseName) {
                        db = lokidbs[x];
                        resolve();
                    }
                }
            });
        }



        function initiateDb(database) {
            return $q(function (resolve, reject) {
                var db_does_exist = false;
                if (dbExists(database.db)) {
                    db_does_exist = true;
                }
                db = new loki(database.db, {
                    autoload: true,
                    autoloadCallback: loadHandler, //loadHandler, //for some reason this has to be called like this
                    autosave: true,
                    autosaveInterval: 10000
                });

                function loadHandler() {
                    if (db_does_exist) {

                        resolve();
                    } else {
                        var items = db.addCollection(database.collection);
                        items.insert(database.documents);
                        db.save();
                        resolve();
                    }
                }
            });
        }
    }
    return module;
}));
