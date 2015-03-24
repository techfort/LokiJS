var Loki = require('../src/lokijs.js'),
  gordian = require('gordian'),
  suite = new gordian('testJoins'),
  db = new Loki('testJoins', {
    persistenceMethod: null
  }),
  directors = db.addCollection('directors'),
  films = db.addCollection('films');

directors.insert([
  {name: 'Martin Scorsese', directorId: 1},
  {name: 'Francis Ford Coppola', directorId: 2},
  {name: 'Steven Spielberg', directorId: 3},
  {name: 'Quentin Tarantino', directorId: 4}
]);

films.insert([
  {title: 'Taxi', filmId: 1, directorId: 1},
  {title: 'Raging Bull', filmId: 2, directorId: 1},
  {title: 'The Godfather', filmId: 3, directorId: 2},
  {title: 'Jaws', filmId: 4, directorId: 3},
  {title: 'ET', filmId: 5, directorId: 3},
  {title: 'Raiders of the Lost Ark', filmId: 6, directorId: 3}
]);
var joined;

//Basic non-mapped join
joined = films.eqJoin(directors.data, 'directorId', 'directorId').data();
suite.assertEqual('Basic join works', joined[0].left.title, 'Taxi');

//Basic join with map
joined = films.eqJoin(directors.data, 'directorId', 'directorId', function(left,right){
  return {
    filmTitle: left.title,
    directorName: right.name
  }
}).data();
suite.assertEqual('Got the right number of results', joined.length, films.data.length);
suite.assertEqual('Got correct left field', joined[0].filmTitle, 'Taxi');
suite.assertEqual('Got correct right field', joined[0].directorName, 'Martin Scorsese');

//Basic non-mapped join with chained map
joined = films.eqJoin(directors.data, 'directorId', 'directorId')
            .map(function(obj){
              return {
                filmTitle: obj.left.title,
                directorName: obj.right.name
              }
            }).data();
suite.assertEqual('Got correct left field', joined[0].filmTitle, 'Taxi');
suite.assertEqual('Got correct right field', joined[0].directorName, 'Martin Scorsese');


//Test filtered join
joined = films
          .chain()
          .find({directorId: 3})
          .simplesort('title')
          .eqJoin(directors.data, 'directorId', 'directorId', function(left,right) {
              return {
                filmTitle: left.title,
                directorName: right.name
              }
          })
suite.assertEqual('Got pre-filtered join results', joined.data().length, 3);

//Test chaining after join
joined.find({filmTitle: 'Jaws'});
suite.assertEqual('Chaining after join', joined.data()[0].filmTitle, 'Jaws');

//Test calculated keys
joined = films.chain().eqJoin(directors.data,
  function(director){return director.directorId + 1},
  function(film){return film.directorId - 1})
  .data();

suite.assertEqual('calculated join works', joined[0].right.name, 'Steven Spielberg');

suite.report();
