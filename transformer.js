let request = require('request-promise');

var environment;
var concept;

function Transformer(argv){
  environment = argv.environment;
  concept = argv.concept;
}

Transformer.prototype.getAllContent = function(credentials){
  return request({
    uri: 'https://' + environment + '-up.ft.com/__'+ concept +'-transformer/transformers/' + concept,
    headers: {
      Authorization: 'Basic ' + new Buffer(credentials.user + ':' + credentials.pass).toString('base64')
    },
    json: true
  }).catch(onerror);
}

Transformer.prototype.getCount = function(credentials){
  return request({
    uri: 'https://' + environment + '-up.ft.com/__'+concept+'-transformer/transformers/'+concept+'/__count',
    headers: {
      Authorization: 'Basic ' + new Buffer(credentials.user + ':' + credentials.pass).toString('base64')
    }
  }).catch(onerror);
}

Transformer.prototype.getIds = function(credentials){
  return request({
    uri: 'https://' + environment + '-up.ft.com/__'+concept+'-transformer/transformers/'+concept+'/__ids',
    headers: {
      Authorization: 'Basic ' + new Buffer(credentials.user + ':' + credentials.pass).toString('base64')
    }
  }).catch(onerror);
}

Transformer.prototype.getContent = function(credentials, uuid){
  return request({
    uri: 'https://' + environment + '-up.ft.com/__'+concept+'-transformer/transformers/'+concept+'/' + uuid,
    headers: {
      Authorization: 'Basic ' + new Buffer(credentials.user + ':' + credentials.pass).toString('base64')
    },
    json: true
  }).catch(onerror);
}

function onerror(err){
  console.error(err);
}

module.exports = Transformer
