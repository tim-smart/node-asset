var Asset, Buffer, Gzip, Package, Task, compiler, compressGzip, fs, log, path, watch, yui_compile;
var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
Gzip = require('compress').Gzip;
compiler = require('closure-compiler').compile;
yui_compile = require('yui-compressor').compile;
Buffer = require('buffer').Buffer;
Task = require('parallel').Task;
fs = require('fs');
path = require('path');
log = function(message) {
  return console.log("[node-asset][" + (new Date().toLocaleTimeString()) + "] " + message);
};
Package = (function() {
  function Package(output, input, options) {
    this.mtime = 0;
    this.filename = output;
    this.contents = input;
    this.compress = options.compress === true ? true : false;
    this.compile = options.compile === true ? true : false;
    this.watch = options.watch === true ? true : false;
    this.type = options.type ? options.type : 'js';
    this.wrap = options.wrap === true || !(options.wrap != null) ? true : false;
  }
  Package.TYPES = {
    'coffee': ['js', 'coffee'],
    'js': ['js'],
    'css': ['css']
  };
  Package.prototype.add = function(item) {
    if (false === this.contents instanceof Array) {
      this.contents = [];
    }
    return this.contents.push(item);
  };
  Package.prototype.serve = function() {
    return resolveContents(this.contents, __bind(function(files) {
      var contents;
      contents = [];
      files.forEach(__bind(function(asset) {
        if (Package.TYPES[this.type].indexOf(asset.type) > -1) {
          return contents.push(asset);
        }
      }, this));
      this.contents = contents;
      this.make();
      if (this.watch === true) {
        return watch(this);
      }
    }, this));
  };
  Package.prototype.make = function() {
    var coffee_buffer, compile, compress, contents_index, i, read_task, string_buffer, write;
    read_task = new Task();
    contents_index = {};
    i = 0;
    this.contents.forEach(function(asset) {
      read_task.add(asset.path, [fs.readFile, asset.path]);
      return contents_index[asset.path] = i++;
    });
    if (this.type === 'js' || this.type === 'coffee') {
      compile = __bind(function(data) {
        return compiler(data, __bind(function(data) {
          if (this.compress) {
            return compress(data);
          } else {
            return write(data);
          }
        }, this));
      }, this);
    }
    if (this.type === 'css') {
      compile = __bind(function(data) {
        return yui_compile(data, {
          type: 'css'
        }, __bind(function(data) {
          if (this.compress) {
            return compress(data);
          } else {
            return write(data);
          }
        }, this));
      }, this);
    }
    compress = function(data) {
      if (data.length <= 0) {
        data = ' ';
      }
      return compressGzip(data, function(data) {
        return write(data);
      });
    };
    write = __bind(function(data) {
      return fs.writeFile(this.filename, data, 'binary', __bind(function() {
        this.mtime = new Date().getTime();
        return log("Successfuly made a " + this.type + " package");
      }, this));
    }, this);
    string_buffer = [];
    coffee_buffer = null;
    return read_task.run(__bind(function(filename, err, data) {
      if (filename === null) {
        if (string_buffer.length > 0) {
          string_buffer = string_buffer.join('\n') + '\n';
        } else {
          string_buffer = '';
        }
        if (coffee_buffer) {
          try {
            string_buffer += require('coffee-script').compile(coffee_buffer.join('\n'), {
              noWrap: true
            });
          } catch (error) {
            log(error.message);
          }
        }
        if (this.compile) {
          return compile(string_buffer);
        } else if (this.compress) {
          return compress(string_buffer);
        } else {
          return write(string_buffer);
        }
      } else if (err) {
        return log(err.message);
      } else if ('.coffee' === path.extname(filename)) {
        if (this.wrap) {
          try {
            return string_buffer[contents_index[filename]] = require('coffee-script').compile(data.toString());
          } catch (error) {
            return log(error.message);
          }
        } else {
          coffee_buffer || (coffee_buffer = []);
          return coffee_buffer[contents_index[filename]] = data.toString();
        }
      } else if (this.wrap && '.js' === path.extname(filename)) {
        return string_buffer[contents_index[filename]] = '(function () {' + data.toString() + '\n})();';
      } else {
        return string_buffer[contents_index[filename]] = data.toString();
      }
    }, this));
  };
  return Package;
})();
exports.Package = Package;
Asset = (function() {
  function Asset(pathname, dir) {
    if (dir === true) {
      this.dir = true;
      this.path = pathname;
    } else {
      this.dir = false;
      this.path = pathname;
      this.type = path.extname(pathname).slice(1);
    }
  }
  return Asset;
})();
({
  resolveContents: function(input, callback) {
    var lookup_task, results, ret;
    if ('string' === typeof input) {
      input = [input];
    }
    lookup_task = new Task();
    results = {};
    input.forEach(function(pathname) {
      results[pathname] = null;
      return lookup_task.add(pathname, [fs.stat, pathname]);
    });
    lookup_task.run(function(name, err, stats) {
      var dirs, keys;
      if (name === null) {
        dirs = {};
        Object.keys(results).forEach(function(key) {
          var asset;
          asset = results[key];
          if (asset === null) {
            delete results[key];
            return log("WARNING: Asset " + key + " not found.");
          } else if (asset.dir === true) {
            return dirs[key] = asset;
          } else {
            return results[key] = asset;
          }
        });
        keys = Object.keys(dirs);
        if (keys.length > 0) {
          lookup_task = new Task();
          keys.forEach(function(key) {
            var dir;
            dir = dirs[key];
            return lookup_task.add(key, [fs.readdir, dir.path]);
          });
          return lookup_task.run(function(key, err, paths) {
            var dir;
            if (key === null) {
              return ret();
            } else if (err) {} else {
              dir = dirs[key];
              results[key] = [];
              return paths.forEach(function(pathname) {
                return results[key].push(new Asset(path.join(dir.path, pathname)));
              });
            }
          });
        } else {
          return ret();
        }
      } else {
        if (err) {
          return;
        }
        if (stats.isDirectory()) {
          return results[name] = new Asset(name, true);
        } else {
          return results[name] = new Asset(name);
        }
      }
    });
    return ret = function() {
      var files;
      files = [];
      Object.keys(results).forEach(function(key) {
        var asset;
        asset = results[key];
        if (asset instanceof Array) {
          return asset.forEach(function(file) {
            return files.push(file);
          });
        } else {
          return files.push(asset);
        }
      });
      return callback(files);
    };
  }
});
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
      if ((stat.mtime - prev.mtime) === 0) {
        return;
      }
      log("Updating a " + package.type + " package");
      return package.make();
    });
  });
};