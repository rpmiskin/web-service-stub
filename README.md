# web-service-stub

Recently I've been working on system testing some [node.js](http://nodejs.org) microservices, by spinning them up in a Swarm of [Docker](https://www.docker.com) containers and then driving them from a [Jest](https://facebook.github.io/jest) test script.

I've been using [Canned](https://www.npmjs.com/package/canned) to stub other systems that are called but I've come across two problems:

1.  Test config is spread between my test scripts and my canned configuration.
2.  I cannot make assertions on the calls that have been made to Canned.

To that end, I've created web-service-stub which allows new endpoints to be spun up, with defined behaviours **and** records all of the calls that have been made for later assertion.

## Setup

By default the service starts up on port 3000 and can be called on path `/stub` e.g. http://localhost:3000/stub

To change the port use the `PORT` environment variable and to change the path use the `STUB_PATH` environment variable. For example:

    PORT=1234 STUB_PATH=/not/stub/path npm start

## Configuring endpoints

POST JSON configuration e.g.

    curl -XPOST --header "Content-Type: application/json" -d @input.json http://localhost:3000/stub

The following JSON will set up the /bar endpoint to receive GET calls. All calls to GET with receive the specified response.

    {
      "path": "/bar",
      "method": "GET",
      "response":
        {
          "status": 200,
          "type": "json",
          "headers": {
            "header1": "value1",
            "header2": "value2"
          },
          "body": "{\"a\":\"b\"}"
        }
      ]
    }

In the following example the response element has been defined as an array. In this case the first call will get the response[0], then response[1] etc until the array is empty at which point empty 404 responses will be returned

    {
      "path": "/bar",
      "method": "GET",
      "response": [
        {
          "status": 200,
          "type": "json",
          "headers": {
            "header1": "value1",
            "header2": "value2"
          },
          "body": "{\"a\":\"b\"}"
        },
        {
          "status": 500
        }
      ]
    }

Attempting to configure an endpoint that has already been configured (and not clea)

## Checking calls

Use HTTP GET e.g.

     curl -XGET http://localhost:3000/stub

This will return a JSON object as follows:

    {
      "/foo": {
        "GET": [
          {
            "body": {},
            "headers": {
              "host": "localhost:3000",
              "user-agent": "curl/7.54.0",
              "accept": "*/*"
            },
            "query": { "re": "" },
            "params": {}
          },
          {
            "body": {},
            "headers": {
              "host": "localhost:3000",
              "user-agent": "curl/7.54.0",
              "accept": "*/*"
            },
            "query": { "re": "" },
            "params": {}
          }
        ]
      }
    }

Each path and HTTP method that has been invoked has an array of objects showing the request body, headers, query and params. The order of elements in the array reflects the order of the calls.

## Clearing configuration

The stub configuration and request history can be cleared by issuing a HTTP DELETE e.g.

    curl -XDELETE http://localhost:3000/stub

Running this within a `beforeEach()` block in a test script will ensure that the stub is cleared down between tests.
