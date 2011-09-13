task 'build', 'Build node-asset', ->
  main = require('child_process').spawn 'coffee', ['-cb', '-o', 'lib/', 'src/index.coffee']
  main.stdout.pipe process.stdout
  main.stderr.pipe process.stderr
