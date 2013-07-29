window.runExample = function(){
  try {
    // init db
    var db = new loki('Example');


    // create two example collections
    var users = db.addCollection('users','User', ['email'], true);
    var projects = db.addCollection('projects', 'Project', ['name']);

    // show collections in db
    db.listCollections();


    // create six users
    var odin = users.document( { name : 'odin', email: 'odin.soap@lokijs.org', age: 38 } );
    var thor = users.document( { name : 'thor', email : 'thor.soap@lokijs.org', age: 25 } );
    var stan = users.document( { name : 'stan', email : 'stan.soap@lokijs.org', age: 29 } );
    var oliver = users.document( { name : 'oliver', email : 'oliver.soap@lokijs.org', age: 31 } );
    var hector = users.document( { name : 'hector', email : 'hector.soap@lokijs.org', age: 15} );
    var achilles = users.document( { name : 'achilles', email : 'achilles.soap@lokijs.org', age: 31 } );

    
    // create an example project
    var prj = projects.document( { name : 'LokiJS', owner: stan });

    // query for user
    //trace( users.find('name','odin') );
    
    stan.name = 'Stan Laurel';

    // update object (this really only syncs the index)
    users.update(stan);
    //trace(prj);
  
    // a simple filter for users over 30
    function ageView(obj){
      return obj.age > 30;
    }
    // a little more complicated, users with names longer than 3 characters and age over 30
    function aCustomFilter(obj){
      return obj.name.length  < 5 && obj.age > 30;
    }

    // test the filters
    trace('Example: View "Age" test');
    trace(users.view(ageView));
    trace('End view test');
    sep();

    trace('Example: Custom filter test');
    trace(users.view(aCustomFilter));
    trace('End of custom filter');
    sep();
    
    // example of map reduce
    trace('Example: Map-reduce');
    function mapFun(obj){
        return obj.age;
    }
    function reduceFun(array){
      var len = array.length >>> 0;
      var i = len;
      var cumulator = 0;
      while(i--){
          cumulator += array[i];
      }
      return cumulator / len;
    }

    trace('Average age is : ' + users.mapReduce( mapFun, reduceFun).toFixed(2) );
    trace('End of map-reduce');
    sep();

    trace('Example: stringify');
    trace('String representation : ' + db.serialize());
    trace('End stringify example');
    sep();

    trace('Example: findAndModify');
    function updateAge(obj){
      obj.age *= 2;
      return obj;
    }
    users.findAndModify(ageView, updateAge);
    trace(users.find());
    trace('End findAndModify example');

    function sep(){
      trace('//---------------------------------------------//');
    }

  } catch(err){
    console.log(err);
  }
  
};