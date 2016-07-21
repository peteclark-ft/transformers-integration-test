#!/usr/bin/env node

let exec = require('child-process-promise').exec;
let tests = require('./test-cases');

let argv = require('yargs')
  .option('concept', {
    alias: 'c',
    describe: 'The type of concept you wish to test.',
    type: 'string'
  })
  .option('environment', {
    alias: 'e',
    describe: 'The environment shortname (the environment is assumed to follow the standard url naming for tunnel and api urls!)',
    type: 'string'
  })
  .option('limit', {
    alias: 'l',
    describe: 'The number of ids to test.',
    type: 'integer'
  })
  .option('concept_publisher', {
    alias: 'p',
    describe: 'Should we also test the concept-publisher?',
    type: 'boolean',
    'default': true
  })
  .alias('v', 'version')
  .version(function() { return require('../package').version; })
  .describe('v', 'show version information')
  .demand('e')
  .alias('h', 'help')
  .help()
  .argv;

function getAuth(){
  return exec("ssh -t "+ argv.environment +"-tunnel-up.ft.com 'fleetctl ssh deployer etcdctl get /ft/_credentials/varnish/htpasswd' 2> /dev/null | sed -n 1'p' | tr ',' '\\n' | head -1")
    .then(function(result){
      var credentials = result.stdout.split(':');
      return Promise.resolve({
        user: credentials[0].trim(),
        pass: credentials[1].trim()
      });
    });
}

getAuth().then(credentials => {
  tests.run(argv, credentials);
}).catch(err => {
  console.error(err);
});
