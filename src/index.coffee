Gzip        = require('compress').Gzip
compiler    = require('closure-compiler').compile
yui_compile = require('yui-compressor').compile
Buffer      = require('buffer').Buffer
Task        = require('parallel').Task
fs          = require 'fs'
path        = require 'path'

log = (message) ->
  console.log "[node-asset][#{new Date().toLocaleTimeString()}] #{message}"

class Package
  constructor: (output, input, options) ->
    @mtime = 0
    @filename = output
    @contents = input

    @compress = if options.compress is true then true else false
    @compile  = if options.compile is true then true else false
    @watch    = if options.watch is true then true else false
    @type     = if options.type then options.type else 'js'
    @wrap     = if options.wrap is true or !options.wrap? then true else false

  @TYPES: {
    'coffee': ['js', 'coffee']
    'js': ['js']
    'css': ['css']
  }

  add: (item) ->
    if false is @contents instanceof Array
      @contents = []

    @contents.push item

  serve: ->
    resolveContents @contents, (files) =>
      contents = []
      files.forEach (asset) =>
        if Package.TYPES[@type].indexOf(asset.type) > -1
          contents.push asset

      @contents = contents

      @make()

      if @watch is true
        watch @

  make: ->
    read_task = new Task()
    contents_index = {}
    i = 0
    @contents.forEach (asset) ->
      read_task.add asset.path, [fs.readFile, asset.path]
      contents_index[asset.path] = i++

    if @type is 'js' or @type is 'coffee'
      compile = (data) =>
        compiler data, (data) =>
          if @compress then compress data
          else write data

    if @type is 'css'
      compile = (data) =>
        yui_compile data, { type: 'css' }, (data) =>
          if @compress then compress data
          else write data

    compress = (data) ->
      if data.length <= 0 then data = ' '
      compressGzip data, (data) ->
        write data
    write = (data) =>
      fs.writeFile @filename, data, 'binary', =>
        @mtime = new Date().getTime()
        log "Successfuly made a $@type package"

    string_buffer = []
    coffee_buffer = null
    read_task.run (filename, err, data) =>
      if filename is null
        if string_buffer.length > 0 then string_buffer = string_buffer.join('\n') + '\n'
        else string_buffer = ''
        if coffee_buffer
          try
            string_buffer += require('coffee-script').compile coffee_buffer.join('\n'), {
              noWrap: yes
            }
          catch error
            log error.message
        if @compile then compile string_buffer
        else if @compress then compress string_buffer
        else write string_buffer
      else if err then log err.message
      else if '.coffee' is path.extname filename
        if @wrap
          try
            string_buffer[contents_index[filename]] = require('coffee-script').compile data.toString()
          catch error
            log error.message
        else
          coffee_buffer ||= []
          coffee_buffer[contents_index[filename]] = data.toString()
      else if @wrap and '.js' is path.extname filename
        string_buffer[contents_index[filename]] = '(function () {' +
                                                 data.toString() +
                                                 '\n})();'
      else
        string_buffer[contents_index[filename]] = data.toString()

exports.Package = Package

class Asset
  constructor: (pathname, dir) ->
    if dir is true
      @dir = true
      @path = pathname
    else
      @dir = false
      @path = pathname
      @type = path.extname(pathname).slice 1

resolveContents: (input, callback) ->
  if 'string' is typeof input
    input = [input]

  lookup_task = new Task()

  results = {}

  input.forEach (pathname) ->
    results[pathname] = null
    lookup_task.add pathname, [fs.stat, pathname]

  lookup_task.run (name, err, stats) ->
    if name is null
      dirs = {}
      Object.keys(results).forEach (key) ->
        asset = results[key]
        if asset is null
          delete results[key]
          log "WARNING: Asset $key not found."
        else if asset.dir is true then dirs[key] = asset
        else results[key] = asset

      keys = Object.keys dirs
      if keys.length > 0
        lookup_task = new Task()
        keys.forEach (key) ->
          dir = dirs[key]
          lookup_task.add key, [fs.readdir, dir.path]
        lookup_task.run (key, err, paths) ->
          if key is null
            ret()
          else if err then return
          else
            dir = dirs[key]
            results[key] = []
            paths.forEach (pathname) -> results[key].push new Asset path.join dir.path, pathname
      else
        ret()
    else
      if err then return
      if stats.isDirectory() then results[name] = new Asset name, true
      else results[name] = new Asset name
  ret = ->
    files = []
    Object.keys(results).forEach (key) ->
      asset = results[key]
      if asset instanceof Array
        asset.forEach (file) ->
          files.push file
      else files.push asset
    callback files

compressGzip = (data, callback) ->
  buffer = new Buffer Buffer.byteLength data, 'binary'
  buffer.write data, 'binary', 0

  gzip = new Gzip()
  gzip.write buffer, (err, data) ->
    if err then throw err
    gzip.close (err, data2) ->
      if err then throw err
      callback data + data2

watch = (package) ->
  package.contents.forEach (asset) ->
    fs.watchFile asset.path, (stat, prev) ->
      log "Updating a $package.type package"
      setTimeout ->
        package.make()
      , 1000
