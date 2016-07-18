#!/usr/bin/env node

let request = require('request-promise');
let exec = require('child-process-promise').exec;
let argv = require('yargs')
  .option('environment', {
    alias: 'e',
    describe: 'The environment shortname (the environment is assumed to follow the standard url naming for tunnel and api urls!)'
  })
  .option('limit', {
    alias: 'l',
    describe: 'The number of ids to test.'
  })
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
      console.log('TEST: The full result set length and the __count are equal 😊');
    }

    var ids = results[2].trim().split('\n');
    if (allResults.length !== ids.length){
      throw new Error('FAIL: __count and __ids are not equal!!');
    } else {
      console.log('TEST: The __ids length and the __count are equal 😊');
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
        console.log('TEST: All __ids that were tested appeared to contain valid data! 😊');
      }
    });
  }).catch(onerror);
}).catch(onerror);

function onerror(err){
  console.error(err);
}
