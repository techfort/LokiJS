var logger = (function (fileWriter) {
  var LokiLogger = function (options) {
    var opt = options || {};
    this.logToFile = false;
    this.logfile = opt.filename || undefined;
    if (this.logfile) {
      this.logToFile = true;
    }
    /**
     * Log levels
     * 4 = log nothing
     * 3 = ERROR
     * 2 = ERROR | WARNING
     * 1 = ERROR | WARNING | INFO
     */
    this.logLevel = opt.level || 4;
  }

  LokiLogger.prototype.log = function (level, message) {
    var method;
    switch (level) {
    case 1:
      method = console.log;
      break;
    case 2:
      method = console.warn;
      break;
    case 3:
      method = console.error;
      break;
    }
    method.apply(message);
    if (this.logToFile) {
      fileWriter.write(JSON.stringify(message));
    }
  };

  LokiLogger.prototype.info = function (message) {
    if (this.loglevel === 1) {
      this.log(1, message);
    }
  };

  LokiLogger.prototype.warn = function (message) {
    if (this.logLevel < 4) {
      this.log(2, message);
    }
  };

  LokiLogger.prototype.error = function (message) {
    if (this.logLevel < 3) {
      this.log(3, message);
    }
  };
}(fileWriter));