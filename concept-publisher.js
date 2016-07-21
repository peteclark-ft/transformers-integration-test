let request = require('request-promise');

var environment;
var concept;

function ConceptPublisher(argv){
  environment = argv.environment
  concept = argv.concept
}

ConceptPublisher.prototype.createConceptPublisherJob = function(credentials){
  return request({
    method: 'POST',
    uri: 'https://' + environment + '-up.ft.com/__concept-publisher/jobs',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + new Buffer(credentials.user + ':' + credentials.pass).toString('base64')
    },
    body: {
      concept: concept,
      url: '/__'+concept+'-transformer/transformers/'+concept+'/',
      throttle: 100
    },
    json: true
  }).catch(onerror);
}

ConceptPublisher.prototype.getConceptPublisherJob = function(credentials, id){
  return request({
    uri: 'https://' + environment + '-up.ft.com/__concept-publisher/jobs/' + id,
    headers: {
      Authorization: 'Basic ' + new Buffer(credentials.user + ':' + credentials.pass).toString('base64')
    },
    json: true
  }).catch(onerror);
}

function onerror(err){
  console.error(err);
}

module.exports = ConceptPublisher;
