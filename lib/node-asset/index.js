var Asset, Buffer, Gzip, Package, Parallel, compiler, compressGzip, fs, log, path, resolveContents, sys, watch, yui_compile;
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
  this.mtime = 0;
  this.filename = output;
  this.contents = input;
  this.compress = options.compress === true || !(typeof (_a = options.compress) !== "undefined" && _a !== null) ? true : false;
  this.compile = options.compile === true || !(typeof (_b = options.compile) !== "undefined" && _b !== null) ? true : false;
  this.watch = options.watch === true || !(typeof (_c = options.watch) !== "undefined" && _c !== null) ? true : false;
  this.type = options.type ? options.type : 'js';
  return this;
};
Package.TYPES = {
  'coffee': ['js', 'coffee'],
  'js': ['js'],
  'css': ['css']
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
          if (Package.TYPES[this.type].indexOf(asset.type) > -1) {
            return contents.push(asset);
          }
        }, this));
      this.contents = contents;
      this.dirs = dirs;
      this.make();
      if (this.watch === true) {
        return watch(this);
      }
    }, this));
};
Package.prototype.make = function() {
  var coffee_buffer, compile, compress, read_task, string_buffer, write;
  read_task = new Parallel();
  this.contents.forEach(function(asset) {
    return read_task.add(asset.path, [fs.readFile, asset.path]);
  });
  this.type === 'js' || this.type === 'coffee' ? (compile = __bind(function(data) {
      return compiler(data, __bind(function(data) {
          if (this.compress) {
            return compress(data);
          } else {
            return write(data);
          }
        }, this));
    }, this)) : null;
  this.type === 'css' ? (compile = __bind(function(data) {
      return yui_compile(data, {
        type: 'css'
      }, __bind(function(data) {
          if (this.compress) {
            return compress(data);
          } else {
            return write(data);
          }
        }, this));
    }, this)) : null;
  compress = function(data) {
    data.length <= 0 ? (data = ' ') : null;
    return compressGzip(data, function(data) {
      return write(data);
    });
  };
  write = __bind(function(data) {
      return fs.writeFile(this.filename, data, 'binary', __bind(function() {
          this.mtime = new Date().getTime();
          return log(("Successfuly made a " + this.type + " package"));
        }, this));
    }, this);
  string_buffer = '';
  coffee_buffer = null;
  return read_task.run(__bind(function(filename, err, data) {
      if (filename === null) {
        coffee_buffer ? string_buffer += require('coffee-script').compile(coffee_buffer, {
          no_wrap: true
        }) : null;
        if (this.compile) {
          return compile(string_buffer);
        } else if (this.compress) {
          return compress(string_buffer);
        } else {
          return write(string_buffer);
        }
      } else if ('.coffee' === path.extname(filename)) {
        coffee_buffer = coffee_buffer || '';
        return coffee_buffer += data.toString() + "\n";
      } else {
        return string_buffer += data.toString() + "\n";
      }
    }, this));
};

exports.Package = Package;
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
      return package.make();
    });
  });
};