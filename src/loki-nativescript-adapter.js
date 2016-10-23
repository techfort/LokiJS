 /**
 * LokiNativescriptAdapter
 * @author Stefano Falda <stefano.falda@gmail.com>
 *
 * Lokijs adapter for nativescript framework (http://www.nativescript.org)
 *
 * The db file is created in the app documents folder.

 * How to use:
 * Just create a new loki db and your ready to go:
 *
 * let db = new loki('loki.json',{autosave:true});
 *
 */

function LokiNativescriptAdapter() {
  this.fs = require("file-system");
}

LokiNativescriptAdapter.prototype.loadDatabase = function(dbname) {
  var documents = this.fs.knownFolders.documents();
  var myFile = documents.getFile(dbname);

  //Read from filesystem
  return myFile.readText().then(function (content) {
      //The file is empty or missing
      if (content===""){
          throw new Error("DB file does not exist");
      } else {
          return content;
      }
  });
};

LokiNativescriptAdapter.prototype.saveDatabase = function(dbname, serialized) {
  var documents = this.fs.knownFolders.documents();
  var myFile = documents.getFile(dbname);

  return myFile.writeText(serialized);
};

LokiNativescriptAdapter.prototype.deleteDatabase = function deleteDatabase(dbname) {
  var documents = this.fs.knownFolders.documents();
  var file = documents.getFile(dbname);

  return file.remove();
};

module.exports = LokiNativescriptAdapter;
