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

//Test Basic Join
var joined = films.mapJoin(directors.data, 'directorId', 'directorId', function(left,right){
  return {
    filmTitle: left.title,
    directorName: right.name
  }
})

suite.assertEqual('Got the right number of results', joined.length, films.data.length);
suite.assertEqual('Got correct left field', joined[0].filmTitle, 'Taxi');
suite.assertEqual('Got correct right field', joined[0].directorName, 'Martin Scorsese');

//Test filtered join
joined = films
          .chain()
          .find({directorId: 3})
          .mapJoin(directors.data, 'directorId', 'directorId', function(left,right) {
              return {
                filmTitle: left.title,
                directorName: right.name
              }
          });
suite.assertEqual('Got right number of filtered results', joined.length, 3)
suite.assertEqual('Got correct filtered left field', joined[0].filmTitle, 'Jaws');

suite.report();
