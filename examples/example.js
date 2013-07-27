window.runExample = function(){
  try {
    // init db
    var db = new loki('Example');


    // create two example collections
    var users = db.addCollection('users','User', ['email']);
    var projects = db.addCollection('projects', 'Project', ['name']);

    // show collections in db
    db.listCollections();


    // create two users
    var odin = users.document( { name : 'odin', email: 'odin.soap@lokijs.com', age: 38 } );
    var thor = users.document( { name : 'thor', email : 'thor.soap@lokijs.com', age: 25 } );
    var stan = users.document( { name : 'stan', email : 'stan.soap@lokijs.com', age: 29 } );
    var oliver = users.document( { name : 'oliver', email : 'oliver.soap@lokijs.com', age: 31 } );
    var hector = users.document( { name : 'hector', email : 'hector.soap@lokijs.com', age: 15} );
    var achilles = users.document( { name : 'achilles', email : 'achilles.soap@lokijs.com', age: 31 } );

    
    // create an example project
    var prj = projects.document( { name : 'LokiJS', owner: stan });

    // query for user
    //trace( users.find('name','odin') );
    
    stan.name = 'Joe Minichino';

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
    trace('View test');
    trace(users.view(ageView));
    trace('End view test');

    trace('Custom filter');
    trace(users.view(aCustomFilter));
    trace('End of custom filter');
  
  } catch(err){
    console.log(err);
  }
  
};