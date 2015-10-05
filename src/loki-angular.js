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
} (this, function (angular, lokijs) {
	var module = angular.module('lokijs', [])
		.factory('Loki', Loki)
    .service('Lokiwork', Lokiwork);    
    function Loki() {
			return loki;
		}
    Lokiwork.$inject = ['Loki', '$q', '$injector', '$window'];
    function Lokiwork( Loki, $q, $injector, $window){
      var vm = this;
      vm.checkStates = checkStates;
      var statesChecked = false;
      var db;
      var dbitems = [];
      var currentColl = {};
      vm.dbExists = dbExists;
      vm.closeDb = closeDb;
      vm.closeAllDbs = closeAllDbs;
      vm.getCollection = getCollection;
      vm.getDoc = getDoc;
      vm.updateDoc = updateDoc;
      vm.setCurrentDoc = setCurrentDoc;
      vm.getCurrentDoc = getCurrentDoc;
      vm.deleteCurrentDoc = deleteCurrentDoc;
      var currentDoc = {};
      
      // function updateDoc(dbName, collName, docName, data){
      //   return $q(function(resolve, reject){ 
      //       getem(dbName, collName, docName, data)
      //       .then(function(data){
      //         resolve(data);
      //       })
      //    });
      // }
      
      function getCurrentDoc(){
        return currentDoc;
      }
      
      function deleteCurrentDoc(){
        return $q(function(resolve, reject){ 
          _delem()
          .then(function(){
            resolve('deleted');
          });
        });
      }
      
      function setCurrentDoc(dbName, collName, docName){
        return $q(function(resolve, reject){ 
            _getem(dbName, collName, docName)
            .then(function(data){
              currentDoc.dbName = dbName;
              currentDoc.collName = collName;
              currentDoc.doc = data;
              currentDoc.lokiNum = data[0].$loki;
              resolve(data);
            });
         });
      }
      
      function updateDoc(thekey, thevalue){
        return $q(function(resolve, reject){
           if(currentDoc){
           _getem(currentDoc.dbName, currentDoc.collName, currentDoc.doc, thekey, thevalue)
            .then(function(data){
              resolve(data);
            });
           }
           else {
             reject("you have to set a current doc first, use: setCurrentDoc(dbName, collName, docName)");
           }
         });
      }
      
      function getDoc(dbName, collName, docName){
        return $q(function(resolve, reject){ 
            _getem(dbName, collName, docName)
            .then(function(data){
              resolve(data);
            });
         });
      }
      
      function getCollection(dbName, collName){
         return $q(function(resolve, reject){ 
            _getem(dbName, collName)
            .then(function(data){
              resolve(data);
            });
         });
      }
      
      function _getem(dbName, collName, docName, thekey, thevalue){
        return $q(function(resolve, reject){ 
          if(db){
            loadDb(dbName)
            .then(function(){
              if(db.filename === dbName){
              getdata();
            }
            });
            
          }
          else {          
            if(statesChecked){
              loadDb(dbName)
              .then(function(){
                getdata();
              });
            }
            else {
              checkStates().then(function(){
                getdata();
              });
            }
          }
          function getdata(){ 
            if(thekey){
              var coll = db.getCollection(collName);
                //var found = coll.find(docName);
                found = coll.get(parseInt(currentDoc.lokiNum, 10));//coll.find(docName);
                // found = docName;
                if(typeof thevalue === "string"){
                  eval('found.' + thekey +' = \'' + thevalue +'\';');
                }
                else{
                  eval('found.' + thekey +' = ' + thevalue +';');
                }                
                coll.update(found);
                db.save();
                resolve(true);
            }
            else  if (docName){
                var coll = db.getCollection(collName);
                var found = coll.find(docName);
                resolve(angular.fromJson(found));
              } 
              else{
                var coll = db.getCollection(collName);
                resolve(angular.fromJson(coll)); 
              }            
            }
        });
      }
      
      function _delem(){
        return $q(function(resolve, reject){ 
          if(db){
            if(db.filename === currentDoc.dbName){
              deldata();
            }
          }
          else {          
            if(statesChecked){
              loadDb(currentDoc.dbName)
              .then(function(){
                deldata();
              });
            }
            else {
              checkStates().then(function(){
                deldata();
              });
            }
          }
          function deldata(){             
              var coll = db.getCollection(currentDoc.collName);
                coll.remove(parseInt(currentDoc.lokiNum, 10));
                db.save();
                resolve(true);
            }
        });
      }
      
      // function _updatedoc(doc, data){
      //   return $q(function(resolve, reject){ 
      //     if(db){
      //       if(db.filename === dbName){
      //         getdata();
      //       }
      //     }
      //     else {          
      //       if(statesChecked){
      //         loadDb(dbName)
      //         .then(function(){
      //           getdata();
      //         })
      //       }
      //       else {
      //         checkStates().then(function(){
      //           getdata();
      //         });
      //       }
      //     }
      //     function getdata(){ 
      //         if (docName){
      //           var coll = db.getCollection(collName);
      //           var found = coll.find(docName);
      //           resolve(angular.fromJson(found));
      //         } 
      //         else{
      //           var coll = db.getCollection(collName);
      //           resolve(angular.fromJson(coll)); 
      //         }            
      //       }
      //   });
      // }
      
      function dbExists(databaseName){
        var value = window.localStorage.getItem(databaseName);
        if(value) {return true;}
        else{
          return false;
        }
      }
      
      function closeAllDbs(){
        return $q(function(resolve, reject){
          var current = 0;
          for(var x=0; x < dbitems.length; x++){
              current++;
                try{
                  dbitems[x].close(function(){
                    console.log('done closing ' + dbitems[x].filename);
                    returnWhenReady();
                  });
                }
                catch (ex){
                  console.log(ex);
                }           
            }
            
            function returnWhenReady(){
              if(current === dbitems.length - 1){
                resolve();
              }
              else {
                return;
              }
            }
        });
      }
      
      function closeDb(databaseName){
        return $q(function(resolve, reject){
          
          for(var x=0; x < dbitems.length; x++){
            if(dbitems.filename === databaseName){
              dbitems[x].close();
              resolve();
              break;
            }
          }
          
        });
      }
      
      
      function checkStates(){
        return $q(function(resolve, reject){
          if(dbitems.length === 0){
            initialiseAll().then(function(){
                console.log('had to initialize all dbs');
                statesChecked = true;
                resolve();
            }, function (){
                reject();
            });
          }
          else {
            console.log('db list already initialized');
            resolve();
          }
        });
      }
      
      //we need to always reinitialise all databases because they may have
      //been wiped at any given time, or it's a new install.
      function initialiseAll(){
         return $q(function(resolve, reject){
            for(var x=0; x< 10;x++){
                if($injector.has('json' + (x+1))){
                var setting = $injector.get('json' + (x+1));
                   var set = angular.fromJson(setting);
                   initiateDb(set)
                       .then(function(){
                         //load all db items into an array so we can query later
                           dbitems.push(db);           
                           resolve();            
                       }, function () {
                           reject();
                       }); 
                }
                else {
                    break;
                }
            }
         });
      }      
      
      function loadDb(databaseName){
        return $q(function(resolve, reject){
              db = new loki(database.db, {
                autoload: false,
                autoLoadCallback: resolve()
              });
                    
        }); 
      }
      
      //all this does is create the database contexts and add them to an array
      //since we may not want to load all databases into memory for performance reasons.  
      function initiateDb(database){                
        return $q(function(resolve, reject){
            if(dbExists(database.db)){
              db = new loki(database.db, {
                autoload: false,
                autoLoadCallback: resolve()
              });
            }
            else {
               db = new loki(database.db, {
                  autoload: true,
                  autoloadCallback : loadHandler,
                  autosave: true, 
                  autosaveInterval: 10000,
                });
                function loadHandler(){
                    var items = db.addCollection(database.collection);
                    items.insert(database.data);
                    db.save(function(){
                      db.close(function(){
                        resolve();
                      });
                    });
                }
            }
        });
      }
    }
	return module;
}));