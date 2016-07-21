#!/bin/bash

function create_consumer {
  curl -X POST -H 'Content-Type: application/vnd.kafka.v1+json' -H'host:kafka' --data '{"format": "binary", "auto.offset.reset": "smallest"}' localhost:8080/consumers/pete-consumer
}

function get_consumer_uri {
  create_consumer | jq .base_uri -r
}

function delete_consumer {
  curl -X DELETE ${consumer_uri}
}

function consume {
  consumer_uri=$(get_consumer_uri)
  curl -X GET -H'Accept: application/vnd.kafka.binary.v1+json' -H'host:kafka' ${consumer_uri}/topics/NativeCmsMetadataPublicationEvents
}

function process_consumed {
  consume > ./consumed.msg
  for c in {0..20}; do
    cat ./consumed.msg | jq -r .[${c}].value | base64 -d  | tail -1 | jq -r .value | base64 -d > ${c}.msg
  done

  delete_consumer
}

function produce {
  curl -X POST -H'Content-Type: application/vnd.kafka.binary.v1+json' -H'host:kafka' --data '' localhost:8080/topics/NativeCmsMetadataPublicationEvents
}

if [[ -z $1 ]]; then
  echo "Usage: ./consume-msgs.sh -[cp]"
fi

if [ "$1" == "-p" ]; then
  produce
fi

if [ "$1" == "-c" ]; then
  process_consumed
fi
