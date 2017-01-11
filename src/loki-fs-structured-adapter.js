
/*
  Loki (node) fs structured Adapter (need to require this script to instance and use it).

  This adapter will save database container and each collection to separate files and
  save collection only if it is dirty.  It is also designed to use a destructured serialization
  method intended to lower the memory overhead of json serialization.

  This adapter utilizes ES6 generator/iterator functionality to stream output and
  uses node linereader module to stream input.  This should lower memory pressure
  in addition to individual object serializations rather than loki's default deep object
  serialization.
*/

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define([], factory);
    } else if (typeof exports === 'object') {
        // Node, CommonJS-like
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.LokiFsStructuredAdapter = factory();
    }
}(this, function () {
  return (function() {

    const fs = require('fs');
    const readline = require('readline');
    const stream = require('stream');

    /**
     * Loki structured (node) filesystem adapter class.
     *     This class fulfills the loki 'reference' abstract adapter interface which can be applied to other storage methods.
     *
     * @constructor LokiFsStructuredAdapter
     *
     */
    function LokiFsStructuredAdapter()
    {
        this.mode = "reference";
        this.dbref = null;
        this.dirtyPartitions = [];
    }

    /**
     * Generator for constructing lines for file streaming output of db container or collection.
     *
     * @param {object} options - (optional) output format options for use externally to loki
     * @param {int} options.partition - (optional) can be used to only output an individual collection or db (-1)
     *
     * @returns {string|array} A custom, restructured aggregation of independent serializations.
     * @memberof LokiFsStructuredAdapter
     */
    LokiFsStructuredAdapter.prototype.generateDestructured = function*(options) {
      var idx, sidx;
      var dbcopy;

      options = options || {};

      if (!options.hasOwnProperty("partition")) {
        options.partition = -1;
      }

      if (options.partition === -1) {
        // instantiate a new loki database by using constructor of dbref passed in to exportDatabase
        dbcopy = new this.dbref.constructor(this.dbref.filename);
        dbcopy.loadJSONObject(this.dbref);

        for(idx=0; idx < dbcopy.collections.length; idx++) {
          dbcopy.collections[idx].data = [];
        }

        yield dbcopy.serialize({
          serializationMethod: "normal"
        });

        return;
      }

      // 'partitioned' along with 'partition' of 0 or greater is a request for single collection serialization
      if (options.partition >= 0) {
        var doccount,
          docidx;

        // dbref collections have all data so work against that
        doccount = this.dbref.collections[options.partition].data.length;

        for(docidx=0; docidx<doccount; docidx++) {
          yield JSON.stringify(this.dbref.collections[options.partition].data[docidx]);
        }
      }
    };

    /**
     * Loki persistence adapter interface function which outputs un-prototype db object reference to load from.
     *
     * @param {string} dbname - the name of the database to retrieve.
     * @returns {Promise} a Promise that resolves after the database was loaded
     * @memberof LokiFsStructuredAdapter
     */
    LokiFsStructuredAdapter.prototype.loadDatabase = function(dbname)
    {
      var instream = fs.createReadStream(dbname);
      var outstream = new stream();
      var rl = readline.createInterface(instream, outstream);
      var self=this;

      this.dbref = null;

      return new Promise(function(resolve, reject) {
        // first, load db container component
        rl.on('line', function(line) {
          // it should single JSON object (a one line file)
          if (self.dbref === null && line !== "") {
            self.dbref = JSON.parse(line);
          }
        });

        // when that is done, examine its collection array to sequence loading each
        rl.on('close', function() {
          if(typeof self.dbref !== 'object')
            reject(new Error('Database could not be read.'));

          if (self.dbref.collections.length > 0) {
            self.loadNextCollection(dbname, 0).then(resolve, reject);
          } else {
            resolve();
          }
        });
      }).then(function() {
        return self.dbref;
      });
    };

    /**
     * Recursive function to chain loading of each collection one at a time.
     * If at some point i can determine how to make async driven generator, this may be converted to generator.
     *
     * @param {string} dbname - the name to give the serialized database within the catalog.
     * @param {int} collectionIndex - the ordinal position of the collection to load.
     * @returns {Promise} a Promise that resolves after the next collection is loaded
     * @memberof LokiFsStructuredAdapter
     */
    LokiFsStructuredAdapter.prototype.loadNextCollection = function(dbname, collectionIndex) {
      var instream = fs.createReadStream(dbname + "." + collectionIndex);
      var outstream = new stream();
      var rl = readline.createInterface(instream, outstream);
      var self=this,
        obj;

      return new Promise(function(resolve) {
        rl.on('line', function (line) {
          if (line !== "") {
            obj = JSON.parse(line);
            self.dbref.collections[collectionIndex].data.push(obj);
          }
        });

        rl.on('close', function (line) {
          instream = null;
          outstream = null;
          rl = null;
          obj = null;

          resolve();
        });
      }).then(function() {
        // if there are more collections, load the next one
        if (++collectionIndex < self.dbref.collections.length) {
          return self.loadNextCollection(dbname, collectionIndex);
        }
      });
    };

    /**
     * Generator for yielding sequence of dirty partition indices to iterate.
     *
     * @memberof LokiFsStructuredAdapter
     */
    LokiFsStructuredAdapter.prototype.getPartition = function*() {
      var idx, len=this.dirtyPartitions.length;
      var clen = this.dbref.collections.length;

      // since database container (partition -1) doesn't have dirty flag at db level, always save
      yield -1;

      // yield list of dirty partitions for iterateration
      for(idx=0; idx<clen; idx++) {
        if (this.dbref.collections[idx].dirty) {
          yield idx;
        }
      }
    };

    /**
     * Loki reference adapter interface function.  Saves structured json via loki database object reference.
     *
     * @param {string} dbname - the name to give the serialized database within the catalog.
     * @param {string} dbref - the loki database object reference to save.
     * @param {function} callback - (Optional) callback passed obj.success with true or false
     * @memberof LokiFsStructuredAdapter
     */
    LokiFsStructuredAdapter.prototype.exportDatabase = function(dbname, dbref)
    {
      var idx;

      this.dbref = dbref;

      // create (dirty) partition generator/iterator
      var pi = this.getPartition();

      return this.saveNextPartition(dbname, pi);
    };

    LokiFsStructuredAdapter.prototype.saveNextPartition = function(dbname, pi) {
      var li;
      var filename;
      var self = this;
      var pinext = pi.next();

      if (pinext.done) {
        return Promise.resolve();
      }

      return new Promise(function(resolve) {
        // db container (partition -1) uses just dbname for filename,
        // otherwise append collection array index to filename
        filename = dbname + ((pinext.value === -1)?"":("." + pinext.value));

        var wstream = fs.createWriteStream(filename);

        wstream.on('close', resolve);

        li = this.generateDestructured({ partition: pinext.value });

        // iterate each of the lines generated by generateDestructured()
        for(var outline of li) {
          wstream.write(outline + "\n");
        }

        wstream.end();
      }).then(function() {
        return self.saveNextPartition(dbname, pi);
      });
    };

    return LokiFsStructuredAdapter;

  }());
}));
