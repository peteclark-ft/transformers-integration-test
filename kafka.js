let request = require('request-promise');
let exec = require('child-process-promise').exec;

let sprintf = require('sprintf-js').sprintf;
let fs = require('fs');
let exampleMsg = fs.readFileSync('./example.msg', 'utf8');

function getAuth(env){
  return exec("ssh -t " + env + "-tunnel-up.ft.com 'fleetctl ssh deployer etcdctl get /ft/_credentials/varnish/htpasswd' 2> /dev/null | sed -n 1'p' | tr ',' '\\n' | head -1")
    .then(function(result){
      var credentials = result.stdout.split(':');
      return Promise.resolve({
        user: credentials[0].trim(),
        pass: credentials[1].trim()
      });
    });
};

function createKafkaConsumer(env, credentials){
  console.log('Creating new consumer in group!', 'tmp-integration-test-consumer');
  return request({
    method: 'POST',
    uri: 'https://'+ env +'-up.ft.com/__kafka-rest-proxy/consumers/tmp-integration-test-consumer',
    headers: {
      'Content-Type': 'application/vnd.kafka.v1+json',
      Authorization: 'Basic ' + new Buffer(credentials.user + ':' + credentials.pass).toString('base64')
    },
    body: {
      format: 'binary',
      'auto.offset.reset': 'smallest',
      'auto.commit.enable': 'true'
    },
    json: true
  });
};

function deleteKafkaConsumer(env, credentials, consumer){
  console.log('Deleting consumer!', consumer);
  return request({
    method: 'DELETE',
    uri: format(env, consumer.base_uri),
    headers: {
      Authorization: 'Basic ' + new Buffer(credentials.user + ':' + credentials.pass).toString('base64')
    }
  });
};

function consumeTopic(env, credentials, consumer, topic){
  return request({
    uri: format(env, consumer.base_uri) + '/topics/' + topic,
    headers: {
      Accept: 'application/vnd.kafka.binary.v1+json',
      Authorization: 'Basic ' + new Buffer(credentials.user + ':' + credentials.pass).toString('base64')
    },
    json: true
  });
};

function sendMessage(env, credentials, topic, msg){
  return request({
    method: 'POST',
    uri: 'https://'+ env +'-up.ft.com/__kafka-rest-proxy/topics/' + topic,
    headers: {
      'Content-Type': 'application/vnd.kafka.binary.v1+json',
      Authorization: 'Basic ' + new Buffer(credentials.user + ':' + credentials.pass).toString('base64')
    },
    body: {
      records:[
        {
          value: new Buffer(msg).toString('base64')
        }
      ]
    },
    json: true
  });
};

function format(env, uri){
  var stripped = uri.replace('http://', '');
  return 'https://'+env+'-up.ft.com/__kafka-rest-proxy' + stripped.substr(stripped.indexOf('/'));
}

function parseMessage(msg){
  var split = msg.split('\n');
  var result = {
    meta: [],
    headers: {}
  };

  for (var i in split){
    try {
      result.data = JSON.parse(split[i]);
    } catch(err){
      if (split[i].indexOf(':') === -1){
        result.meta.push(split[i].trim());
      } else {
        var header = split[i].split(': ');
        result.headers[header[0]] = header[1].trim();
      }
    }
  }
  return result;
}

function onerror(err){
  console.error(err);
}

let argv = require('yargs')
  .command('send', 'Send a test message to NativeCmsMetadataPublicationEvents.', yargs => {}, function(argv){
    getAuth(argv.env).then(credentials => {
      sendMessage(argv.env, credentials, 'NativeCmsMetadataPublicationEvents', exampleMsg).then(sendResponse => {
        console.log(sendResponse);
      });
    });
  })
  .command('test <env> <topic>', 'Consume the messages off the provided topic, and check for the test message.', yargs => {}, function(argv){
    getAuth(argv.env).then(credentials => {
      createKafkaConsumer(argv.env, credentials).then(consumer => {
        consumeTopic(argv.env, credentials, consumer, argv.topic).then(msgs => {
          if (!msgs || !msgs.length || msgs.length === 0){
            console.log(sprintf('%-100s', 'FAIL: No messages to consume!'));
            deleteKafkaConsumer(argv.env, credentials, consumer).then(d => {});
            return;
          }

          var testResults = msgs.map(msg => {
              var base64Msg = msg.value;
              var decoded = Buffer.from(base64Msg, 'base64').toString('utf8');
              return parseMessage(decoded);
            }).filter(parsed => {
              return parsed.data.uuid === 'c4db4106-00b2-11e6-99cb-83242733f755';
            });

          if (testResults.length === 0){
            console.log('FAIL: No matching messages found!');
          }

          testResults.forEach(parsed => {
            var filtered = parsed.data.suggestions.filter(suggestion => {
              return suggestion.thing.types.indexOf('http://www.ft.com/ontology/AlphavilleSeries') !== -1;
            });

            if (filtered.length !== 1){
              throw new Error("FAIL: The test message doesn't contain an Alphaville Series suggestion, or contains more than we're expecting!");
            }

            var thing = filtered[0].thing;
            if (!thing.prefLabel || thing.prefLabel !== '3D printing' || !thing.predicate || thing.predicate !== 'isClassifiedBy'){
              console.log(JSON.stringify(filtered[0], null, ' '));
              throw new Error("FAIL: The test message Alphaville Series suggestion contains unexpected data!");
            }

            console.log(sprintf('%-100s %-20s %s', 'TEST: Alphaville Series suggestion found and is valid!', '', '😊'));
          });

          deleteKafkaConsumer(argv.env, credentials, consumer).then(d => {});
        });
      });
    });
  })
  .argv;
