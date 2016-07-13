(function (root, factory) {

  module.exports = factory();

}(this, function () {
  return (function () {

    let fs = require('fs');

    let accessDataDir = (datadir) => {
      return new Promise((resolve, reject) => {
        fs.lstat(datadir, (err, stats) => {
          if (err) {
            reject({
              message: 'Dir does not exist'
            });
          }
          resolve(stats);
        });
      });
    };

    let iterateFolders = (db, dir) => {
      console.log(`Colls: ${db.listCollections().length}`);
      db.listCollections().forEach(coll => {
        console.log(`coll: ${coll.name}`);
      });
    };

    class LokiIncrementalAdapter {
      constructor() {
        this.mode = 'reference';
      }

      checkAvailability() {
        if (typeof fs !== 'undefined' && fs) return true;
        return false;
      }

      exportDatabase(dir, dbref, callback) {
        console.log('Saving with incremental adapter');

        console.log('Database dir is ' + dir);
        let promise = accessDataDir(dir);
        console.log(promise);
        promise.then(() => {
          console.log('iterating folders...');
          iterateFolders(dbref, dir)
        });
        promise.catch((err) => {
          console.log(err);
        });
        if (callback) {
          callback();
        }
      }

      loadDatabase(dbname, callback) {
        console.log(this, dbname, callback);
      }
    }

    return LokiIncrementalAdapter;

  }());
}));
