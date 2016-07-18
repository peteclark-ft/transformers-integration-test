#!/usr/bin/env node

let request = require('request-promise');
let exec = require('child-process-promise').exec;
let sleep = require('sleep-async')();
let sprintf = require('sprintf-js').sprintf;

let argv = require('yargs')
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
    alias: 'c',
    describe: 'Should we also test the concept-publisher?',
    type: 'boolean'
  })
  .alias('v', 'version')
  .version(function() { return require('../package').version; })
  .describe('v', 'show version information')
  .demand('e')
  .alias('h', 'help')
  .help()
  .argv;

function randomlyReduceArray(array, limit){
  var results = [];
  for (var i = 0 ; i < limit ; i++){
    results[i] = array[Math.floor(Math.random() * array.length)];
  }
  return results;
}

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

function getAllContent(credentials){
  return request({
    uri: 'https://' + argv.environment + '-up.ft.com/__alphaville-series-transformer/transformers/alphaville-series',
    headers: {
      Authorization: 'Basic ' + new Buffer(credentials.user + ':' + credentials.pass).toString('base64')
    },
    json: true
  }).catch(onerror);
}

function getCount(credentials){
  return request({
    uri: 'https://' + argv.environment + '-up.ft.com/__alphaville-series-transformer/transformers/alphaville-series/__count',
    headers: {
      Authorization: 'Basic ' + new Buffer(credentials.user + ':' + credentials.pass).toString('base64')
    }
  }).catch(onerror);
}

function getIds(credentials){
  return request({
    uri: 'https://' + argv.environment + '-up.ft.com/__alphaville-series-transformer/transformers/alphaville-series/__ids',
    headers: {
      Authorization: 'Basic ' + new Buffer(credentials.user + ':' + credentials.pass).toString('base64')
    }
  }).catch(onerror);
}

function getContent(credentials, uuid){
  return request({
    uri: 'https://' + argv.environment + '-up.ft.com/__alphaville-series-transformer/transformers/alphaville-series/' + uuid,
    headers: {
      Authorization: 'Basic ' + new Buffer(credentials.user + ':' + credentials.pass).toString('base64')
    },
    json: true
  }).catch(onerror);
}

function createConceptPublisherJob(credentials){
  return request({
    method: 'POST',
    uri: 'https://' + argv.environment + '-up.ft.com/__concept-publisher/jobs',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + new Buffer(credentials.user + ':' + credentials.pass).toString('base64')
    },
    body: {
      concept: "alphaville-series",
      url: "/__alphaville-series-transformer/transformers/alphaville-series/",
      throttle: 100
    },
    json: true
  }).catch(onerror);
}

function getConceptPublisherJob(credentials, id){
  return request({
    uri: 'https://' + argv.environment + '-up.ft.com/__concept-publisher/jobs/' + id,
    headers: {
      Authorization: 'Basic ' + new Buffer(credentials.user + ':' + credentials.pass).toString('base64')
    },
    json: true
  }).catch(onerror);
}

getAuth().then(credentials => {
  var promises = [];
  promises.push(getAllContent(credentials));
  promises.push(getCount(credentials));
  promises.push(getIds(credentials));

  Promise.all(promises).then(results => {
    var allResults = results[0];
    var count = results[1];

    if(allResults.length !== parseInt(count)){
      throw new Error('FAIL: Results and count are not equal!!');
    } else {
      console.log(sprintf('%-100s %-20s %s', 'TEST: The full result set length and the __count are equal.', '', '😊'));
    }

    var ids = results[2].trim().split('\n');
    if (allResults.length !== ids.length){
      throw new Error('FAIL: __count and __ids are not equal!!');
    } else {
      console.log(sprintf('%-100s %-20s %s', 'TEST: The __ids length and the __count are equal.', '', '😊'));
    }

    if (argv.limit){
      ids = randomlyReduceArray(ids, argv.limit);
    }

    var allRequestsPromises = ids.map(JSON.parse)
       .map(id => {
         return getContent(credentials, id.id);
       });

    Promise.all(allRequestsPromises).then(results => {
      var check = results.map(result => {
        var test = result.uuid && result.alternativeIdentifiers && result.prefLabel && result['type'] && result.alternativeIdentifiers.TME && result.alternativeIdentifiers.uuids;
        if (!test){
          console.log('FAIL: The following json object does not appear to be valid!', result);
        }
        return test;
      }).filter(test => {
        return !test;
      });

      if (check.length > 0) {
        throw new Error('FAIL: Not all requests using ids from the __ids call resulted in correctly formatted json in a direct call!!');
      } else {
        console.log(sprintf('%-100s %-20s %s', 'TEST: All __ids that were tested appeared to contain valid data!', '', '😊'));
      }
    });

    if (!argv.concept_publisher){
      return;
    }

    createConceptPublisherJob(credentials).then(result => {
      var check = {
        status: 'In progress'
      };

      sleep.sleepWithCondition(function(){
        if (check.status === 'In progress'){
          getConceptPublisherJob(credentials, result.jobId).then(result => {
            check = result;
          });
          return false;
        }
        return true;
      },
      5000,
      function(){
        if (check.status && check.status === 'Completed'
          && check.concept && check.concept === 'alphaville-series'
          && check.throttle && check.throttle === 100
          && check.count === allResults.length
          && check.done === check.count
        ) {
          console.log(sprintf('%-100s %-20s %s', 'TEST: Concept Publisher job created and completed successfully!', '', '😊'));
        } else {
          console.log(check);
          throw new Error('FAIL: Concept Publisher job failed to complete successfully!')
        }
      });
    });
  }).catch(onerror);
}).catch(onerror);

function onerror(err){
  console.error(err);
}
