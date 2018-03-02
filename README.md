# camunda-worker-node

Implement your [external task workers](https://docs.camunda.org/manual/latest/user-guide/process-engine/external-tasks/) for [Camunda](http://camunda.org) in [NodeJS](https://nodejs.org/).

> Compatible with Camunda `>= 7.8`.


## Usage

This library exposes a simple API to implement external task workers for [Camunda](http://camunda.org).

```javascript
var Workers = require('camunda-worker-node');

var engineEndpoint = 'http://localhost:8080/engine-rest';

var workers = Workers(engineEndpoint, {
  workerId: 'some-worker-id'
});

// a worker may access and modify process variables
workers.registerWorker('work:A', [ 'numberVar' ], function(context, callback) {

  var newNumber = context.variables.numberVar + 1;

  // complete with update variables
  callback(null, {
    variables: {
      numberVar: newNumber
    }
  });

  // fail with an error if things go awry
  callback(new Error('no work done'));
});

// shutdown the workers instance with the application
workers.shutdown();
```

Make sure you properly configured the [external tasks](https://docs.camunda.org/manual/latest/user-guide/process-engine/external-tasks/) in your BPMN 2.0 diagram:

```xml
<bpmn:serviceTask
        id="Task_A"
        camunda:type="external"
        camunda:topicName="work:A" />
```


## Features

* Implement workers with node-style callbacks or [`async` functions](#workers-as-async-functions)
* Complete tasks with updated variables or fail with errors
* Trigger [BPMN errors](#trigger-bpmn-error)
* [Extend via plugins](#extend-workers)
* Configure [logging](#logging) or [authentication](#authentication)


## Workers as async Functions

ES6 style async/await to implement workers is fully supported:

```javascript
// a worker can be an async function
workers.registerWorker('work:B', async function(context) {

  // await async increment
  var newNumber = await increment(context.variables.numberVar);

  // indicate an error
  throw new Error('no work done');

  // or return actual result
  return {
    variables: {
      numberVar: newNumber
    }
  };
});
```


## Authentication

Provide additional request headers to authenticate your task workers via the `requestOptions` configuration:

```javascript
var workers = Workers(engineEndpoint, {
  requestOptions: {
    headers: {
      Authorization: 'Bearer ...'
    }
  }
})
```


## Logging

We employ [debug](https://www.npmjs.com/package/debug) for logging.

Use the [`Logger` extension](./lib/logger.js) in combination with `DEBUG=*` to capture a full trace of what's going on under the hood:

```
DEBUG=* node start-workers.js
```


## Trigger BPMN Errors

You may indicate BPMN errors to trigger business defined exception handling:

```javascript
workers.registerWorker('work:B', function(context, callback) {
  // trigger business aka BPMN errors
  callback(null, {
    errorCode: 'some-bpmn-error'
  });
});
```


## Extend Workers

Workers may be extended via the `use` config parameter.

```javascript
Workers(engineEndpoint, {
  use: [
    Logger,
    Backoff
  ]
});
```

#### Existing Extensions

* [`Logger`](./lib/logger.js) - adds verbose logging of what is going on
* [`Backoff`](./lib/backoff.js) - increase polling intervals if the engine endpoint is temporarily unavailable


## Dynamically Unregister a Worker

It is possible to dynamically unregister a worker any time.

```javascript
var worker = workers.registerWorker('someTopic', function(context, callback) {
  // do work
  callback(null);
});

// later
worker.remove();
```


## Installation

```
npm i --save camunda-worker-node
```


## Develop

Install dependencies:

```
npm install
```

Lint and run all tests:

```
DEBUG=worker* npm run all
```

__Note:__ You need a Camunda BPM REST API exposed on `localhost:8080/engine-rest` for the tests to pass. An easy way to get it up running is [via Docker](https://github.com/camunda/docker-camunda-bpm-platform#get-started).


## License

MIT
