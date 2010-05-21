var Asset, Buffer, Gzip, Package, Parallel, compiler, compressGzip, fs, log, makePackage, path, resolveContents, sys, watch, yui_compile;
var __slice = Array.prototype.slice, __bind = function(func, obj, args) {
    return function() {
      return func.apply(obj || {}, args ? args.concat(__slice.call(arguments, 0)) : arguments);
    };
  };
Gzip = require('node-compress').Gzip;
compiler = require('closure-compiler').compile;
yui_compile = require('yui-compressor').compile;
Buffer = require('buffer').Buffer;
Parallel = require('parallel').Parallel;
fs = require('fs');
path = require('path');
sys = require('sys');
log = function(message) {
  return sys.puts(("[node-asset][" + (new Date().toLocaleTimeString()) + "] " + message));
};
Package = function(output, input, options) {
  var _a, _b, _c;
  this.filename = output;
  this.contents = input;
  this.compress = options.compress === true || !(typeof (_a = options.compress) !== "undefined" && _a !== null) ? true : false;
  this.compile = options.compile === true || !(typeof (_b = options.compile) !== "undefined" && _b !== null) ? true : false;
  options.watch === true || !(typeof (_c = options.watch) !== "undefined" && _c !== null) ? (this.watch = true) : (this.watch = false);
  this.type = options.type ? options.type : 'js';
  return this;
};
Package.prototype.add = function(item) {
  false === this.contents instanceof Array ? (this.contents = []) : null;
  return this.contents.push(item);
};
Package.prototype.serve = function() {
  return resolveContents(this.contents, __bind(function(files, dirs) {
      var contents;
      contents = [];
      files.forEach(__bind(function(asset) {
          if (asset.type === this.type) {
            return contents.push(asset);
          }
        }, this));
      this.contents = contents;
      this.dirs = dirs;
      makePackage(this);
      if (this.watch === true) {
        return watch(this);
      }
    }, this));
};

exports.Package = Package;
makePackage = function(package) {
  var compile, compress, read_task, result, write;
  if (package.contents.length <= 0) {
    return null;
  }
  read_task = new Parallel();
  package.contents.forEach(function(asset) {
    return read_task.add(asset.path, [fs.readFile, asset.path]);
  });
  package.type === 'js' || package.type === 'coffee' ? (compile = function(data) {
    return compiler(data, function(data) {
      if (package.compress) {
        return compress(data);
      } else {
        return write(data);
      }
    });
  }) : null;
  package.type === 'css' ? (compile = function(data) {
    return yui_compile(data, {
      type: 'css'
    }, function(data) {
      if (package.compress) {
        return compress(data);
      } else {
        return write(data);
      }
    });
  }) : null;
  compress = function(data) {
    return compressGzip(data, function(data) {
      return write(data);
    });
  };
  write = function(data) {
    return fs.writeFile(package.filename, data, 'binary', function() {
      return log(("Successfuly made a " + package.type + " package"));
    });
  };
  result = '';
  return read_task.run(function(filename, err, data) {
    if (filename === null) {
      package.type === 'coffee' ? (result = require('coffee-script').compile(result, {
        no_wrap: true
      })) : null;
      if (package.compile) {
        return compile(result);
      } else if (package.compress) {
        return compress(result);
      } else {
        return write(result);
      }
    } else {
      return result += data.toString() + "\n";
    }
  });
};
Asset = function(pathname, dir) {
  if (dir === true) {
    this.dir = true;
    this.path = pathname;
  } else {
    this.dir = false;
    this.path = pathname;
    this.type = path.extname(pathname).slice(1);
  }
  return this;
};

resolveContents = function(input, callback) {
  var lookup_task, results;
  'string' === typeof input ? (input = [input]) : null;
  lookup_task = new Parallel();
  input.forEach(function(pathname) {
    return lookup_task.add(pathname, [fs.stat, pathname]);
  });
  results = [];
  return lookup_task.run(function(name, err, stats) {
    var dirs, files;
    if (name === null) {
      dirs = [];
      files = [];
      results.forEach(function(asset) {
        if (asset.dir === true) {
          return dirs.push(asset);
        } else {
          return files.push(asset);
        }
      });
      if (dirs.length > 0) {
        lookup_task = new Parallel();
        dirs.forEach(function(dir) {
          return lookup_task.add(dir.path, [fs.readdir, dir.path]);
        });
        lookup_task.run(function(dir, err, paths) {
          if (dir === null) {
            callback(files, dirs);
          } else if (err) {
            return null;
          } else {
            paths.forEach(function(pathname) {
              return files.push(new Asset(path.join(dir, pathname)));
            });
          }
        });
      } else {
        callback(files, dirs);
      }
    } else {
      if (err) {
        return null;
      }
      stats.isDirectory() ? results.push(new Asset(name, true)) : results.push(new Asset(name));
    }
  });
};
compressGzip = function(data, callback) {
  var buffer, gzip;
  buffer = new Buffer(Buffer.byteLength(data, 'binary'));
  buffer.write(data, 'binary', 0);
  gzip = new Gzip();
  return gzip.write(buffer, function(err, data) {
    if (err) {
      throw err;
    }
    return gzip.close(function(err, data2) {
      if (err) {
        throw err;
      }
      return callback(data + data2);
    });
  });
};
watch = function(package) {
  return package.contents.forEach(function(asset) {
    return fs.watchFile(asset.path, function(stat, prev) {
      log(("Updating a " + package.type + " package"));
      return makePackage(package);
    });
  });
};