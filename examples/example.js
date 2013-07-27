window.runExample = function(){

  // init db
  var db = new loki('Example');

  // create two example collections
  var users = db.addCollection('users','User', ['email']);
  var projects = db.addCollection('projects', 'Project',['name']);

  // show collections in db
  db.listCollections();

  // create two users
  var joe = users.document( { name : 'joe', email: 'joe.minichino@gmail.com', age: 38 } );
  var jack = users.document( { name : 'jack', email : 'jack.black@gmail.com', age: 25 } );


  // create an example project
  var prj = projects.document( { name : 'LokiJS', owner: joe });

  // query for user
  trace( users.find('name','joe') );
  
  joe.name = 'Joe Minichino';

  // update object (this really only syncs the index)
  users.update(joe);
  trace(prj);


};