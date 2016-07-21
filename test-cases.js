let sleep = require('sleep-async')();
let sprintf = require('sprintf-js').sprintf;
let Transformer = require('./transformer');
let ConceptPublisher = require('./concept-publisher')

var transformer;
var conceptPublisher

function randomlyReduceArray(array, limit){
  var results = [];
  for (var i = 0 ; i < limit ; i++){
    results[i] = array[Math.floor(Math.random() * array.length)];
  }
  return results;
}

function collectData(credentials){
  var promises = [];
  promises.push(transformer.getAllContent(credentials));
  promises.push(transformer.getCount(credentials));
  promises.push(transformer.getIds(credentials));
  return Promise.all(promises);
}

function formaliseResults(results){
  return Promise.resolve({
    all: results[0],
    count: results[1],
    ids: results[2].trim().split('\n')
  });
}

function makeRequestsForContent(credentials, ids){
  return Promise.all(ids.map(JSON.parse)
     .map(id => {
       return transformer.getContent(credentials, id.id);
     }));
}

function testAllMatchesCount(results){
  if(results.all.length !== parseInt(results.count)){
    throw new Error('FAIL: Results and count are not equal!!');
  } else {
    console.log(sprintf('%-100s %-20s %s', 'TEST: The full result set length and the __count are equal.', '', '😊'));
  }
}

function testAllMatchesIds(results){
  if (results.all.length !== results.ids.length){
    throw new Error('FAIL: __count and __ids are not equal!!');
  } else {
    console.log(sprintf('%-100s %-20s %s', 'TEST: The __ids length and the __count are equal.', '', '😊'));
  }
}

function testIdsExistAndAreValid(limit, credentials, results){
  var testIds = results.ids;
  if (limit){
    testIds = randomlyReduceArray(results.ids, limit);
  }

  makeRequestsForContent(credentials, testIds).then(records => {
    var check = records.map(checkValid).filter(test => !test);

    if (check.length > 0) {
      throw new Error('FAIL: Not all requests using ids from the __ids call resulted in correctly formatted json in a direct call!!');
    } else {
      console.log(sprintf('%-100s %-20s %s', 'TEST: All __ids that were tested appeared to contain valid data!', '', '😊'));
    }
  });
}

function checkValid(record){
  var test = record.uuid && record.alternativeIdentifiers && record.prefLabel && record['type'] && record.alternativeIdentifiers.TME && record.alternativeIdentifiers.uuids;
  if (!test){
    console.log('FAIL: The following json object does not appear to be valid!', record);
  }
  return test;
}

function testConceptPublish(concept, credentials, results){
  conceptPublisher.createConceptPublisherJob(credentials).then(job => {
    var check = {
      status: 'In progress'
    };

    sleep.sleepWithCondition(function(){
        if (check.status === 'In progress'){
          conceptPublisher.getConceptPublisherJob(credentials, job.jobId).then(result => {
            check = result;
          });
          return false;
        }
        return true;
      },
      5000,
      function(){
        if (check.status && check.status === 'Completed'
          && check.concept && check.concept === concept
          && check.throttle && check.throttle === 100
          && check.count === results.all.length
          && check.done === check.count
        ) {
          console.log(sprintf('%-100s %-20s %s', 'TEST: Concept Publisher job created and completed successfully!', '', '😊'));
        } else {
          console.log(check);
          throw new Error('FAIL: Concept Publisher job failed to complete successfully!')
        }
      });
  });
}

function onerror(err){
  console.error(err);
}

function testTransformer(argv, credentials){
  transformer = new Transformer(argv);
  conceptPublisher = new ConceptPublisher(argv);

  collectData(credentials).then(formaliseResults)
    .then(results => {
      testAllMatchesCount(results);
      testAllMatchesIds(results);
      testIdsExistAndAreValid(argv.limit, credentials, results);

      if (!argv.concept_publisher){
        return;
      }

      testConceptPublish(argv.concept, credentials, results);
    }).catch(onerror);
}

module.exports = {
  run: testTransformer
}
