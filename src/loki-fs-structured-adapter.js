
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
     * @param {function} callback - callback should accept string param containing db object reference.
     * @memberof LokiFsStructuredAdapter
     */
    LokiFsStructuredAdapter.prototype.loadDatabase = function(dbname, callback)
    {
      var instream = fs.createReadStream(dbname);
      var outstream = new stream();
      var rl = readline.createInterface(instream, outstream);
      var self=this;

      this.dbref = null;

      rl.on('line', function(line) {
        // for database container, it should single JSON object (a one line file)
        if (self.dbref === null && line !== "") {
          self.dbref = JSON.parse(line);
        }
      });

      rl.on('close', function() {
        if (self.dbref.collections.length > 0) {
          self.loadNextCollection(dbname, 0, function() {
            callback(self.dbref);
          });
        }
      });
    };

    /**
     * Recursive function to chain loading of each collection one at a time. 
     * If at some point i can determine how to make async driven generator, this may be converted to generator.
     *
     * @param {string} dbname - the name to give the serialized database within the catalog.
     * @param {int} collectionIndex - the ordinal position of the collection to load.
     * @param {function} callback - (Optional) callback to pass to next invocation or to call when done
     * @memberof LokiFsStructuredAdapter
     */
    LokiFsStructuredAdapter.prototype.loadNextCollection = function(dbname, collectionIndex, callback) {
      var instream = fs.createReadStream(dbname + "." + collectionIndex);
      var outstream = new stream();
      var rl = readline.createInterface(instream, outstream);
      var self=this,
        obj;

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

        // if there are more collections, load the next one
        if (++collectionIndex < self.dbref.collections.count) {
          self.loadNextCollection(dbname, collectionIndex, callback);
        }
        // otherwise we are done, callback to loadDatabase so it can return the new db object representation.
        else {
          callback();
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

      for (idx=0; idx<len; idx++) {
        yield this.dirtyPartitions[idx];
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
    LokiFsStructuredAdapter.prototype.exportDatabase = function(dbname, dbref, callback)
    {
      var idx;

      // since we don't have dirty flag for db container (partition -1), always save that
      this.dirtyPartitions = [-1];

      this.dbref = dbref;

      // retain list of dirty partitions at class level for iterator to use
      for(idx=0; idx<dbref.collections.length; idx++) {
        if (dbref.collections[idx].dirty) {
          this.dirtyPartitions.push(idx);
        }
      }

      // create (dirty) partition generator/iterator
      var pi = this.getPartition();
      // line generator/iterator
      var li;
      // each partition gets own filename
      var filename;

      // iterate generator for each of the (dirty) collections which need to be saved
      for (var partindex of pi) {
        // db container (partition -1) uses just dbname for filename,
        // otherwise append collection array index to filename
        filename = dbname + ((partindex === -1)?"":("." + partindex));

        var wstream = fs.createWriteStream(filename);

        li = this.generateDestructured({ partition: partindex });

        // iterate each of the lines generated by generateDestructured()
        for(var outline of li) {
          wstream.write(outline + "\n");
        }

        wstream.end();
      }
    };

    return LokiFsStructuredAdapter;

  }());
}));
