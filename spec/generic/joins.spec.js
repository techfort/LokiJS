if (typeof(window) === 'undefined') var loki = require('../../src/lokijs.js');

describe('joins', function () {
  var db, directors, films;

  beforeEach(function () {
    db = new loki('testJoins', {
        persistenceMethod: null
      }),
      directors = db.addCollection('directors'),
      films = db.addCollection('films');

    directors.insert([{
      name: 'Martin Scorsese',
      directorId: 1
    }, {
      name: 'Francis Ford Coppola',
      directorId: 2
    }, {
      name: 'Steven Spielberg',
      directorId: 3
    }, {
      name: 'Quentin Tarantino',
      directorId: 4
    }]);

    films.insert([{
      title: 'Taxi',
      filmId: 1,
      directorId: 1
    }, {
      title: 'Raging Bull',
      filmId: 2,
      directorId: 1
    }, {
      title: 'The Godfather',
      filmId: 3,
      directorId: 2
    }, {
      title: 'Jaws',
      filmId: 4,
      directorId: 3
    }, {
      title: 'ET',
      filmId: 5,
      directorId: 3
    }, {
      title: 'Raiders of the Lost Ark',
      filmId: 6,
      directorId: 3
    }]);
  })

  it('works', function () {
    var joined;

    //Basic non-mapped join
    joined = films.eqJoin(directors.data, 'directorId', 'directorId').data();
    expect(joined[0].left.title).toEqual('Taxi');

    //Basic join with map
    joined = films.eqJoin(directors.data, 'directorId', 'directorId', function (left, right) {
      return {
        filmTitle: left.title,
        directorName: right.name
      }
    }).data();
    expect(joined.length).toEqual(films.data.length);
    expect(joined[0].filmTitle).toEqual('Taxi');
    expect(joined[0].directorName).toEqual('Martin Scorsese');

    //Basic non-mapped join with chained map
    joined = films.eqJoin(directors.data, 'directorId', 'directorId')
      .map(function (obj) {
        return {
          filmTitle: obj.left.title,
          directorName: obj.right.name
        }
      }).data();
    expect(joined[0].filmTitle).toEqual('Taxi');
    expect(joined[0].directorName).toEqual('Martin Scorsese');


    //Test filtered join
    joined = films
      .chain()
      .find({
        directorId: 3
      })
      .simplesort('title')
      .eqJoin(directors.data, 'directorId', 'directorId', function (left, right) {
        return {
          filmTitle: left.title,
          directorName: right.name
        }
      })
    expect(joined.data().length).toEqual(3);

    //Test chaining after join
    joined.find({
      filmTitle: 'Jaws'
    });
    expect(joined.data()[0].filmTitle).toEqual('Jaws');

    //Test calculated keys
    joined = films.chain().eqJoin(directors.data,
        function (director) {
          return director.directorId + 1
        },
        function (film) {
          return film.directorId - 1
        })
      .data();

    expect(joined[0].right.name).toEqual('Steven Spielberg');
  });
});
// var Loki = require('../src/lokijs.js'),
//   gordian = require('gordian'),
//   suite = new gordian('testJoins'),



// suite.report();
