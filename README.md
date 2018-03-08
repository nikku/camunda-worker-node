# camunda-worker-node

Implement your [external task workers](https://docs.camunda.org/manual/latest/user-guide/process-engine/external-tasks/) for [Camunda](http://camunda.org) in [NodeJS](https://nodejs.org/).

> Compatible with Camunda `>= 7.8`. Requires NodeJS `>= 6.0`.


## Usage

This library exposes a simple API to implement external task workers for [Camunda](http://camunda.org).

```javascript
var Workers = require('camunda-worker-node');
var Backoff = require('camunda-worker-node/lib/backoff');

var engineEndpoint = 'http://localhost:8080/engine-rest';

var workers = Workers(engineEndpoint, {
  workerId: 'some-worker-id',
  use: [
    Backoff
  ]
});

// a worker may access and modify process variables
workers.registerWorker('work:A', [ 'numberVar' ], async function(context) {

  var newNumber = context.variables.numberVar + 1;

  // fail with an error if things go awry
  if (ooops) {
    throw new Error('no work done');
  }

  // complete with update variables
  return {
    variables: {
      numberVar: newNumber
    }
  };
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

* Implement workers [node-style](#workers-node-style) or via [`async` functions](#workers-as-async-functions)
* Complete tasks with updated variables or fail with errors
* Trigger [BPMN errors](#trigger-bpmn-errors)
* [Configure and Extend Task Locks](#task-locks)
* Configure [logging](#logging) and [authentication](#authentication)
* [Configure Task Fetching](#configure-task-fetching)
* [Extend via plugins](#extend-workers)


## Resources

* [Example](./example)
* [Issues](https://github.com/nikku/camunda-worker-node/issues)
* [Changelog](./CHANGELOG.md)


## Implementing Workers

Implement your workers `async`, promise returning functions or pass results via node-style callbacks.


### Workers, Node Style

Use the provided callback to pass task execution errors and data, node-style:

```javascript
// a worker can receive a node-style callback
workers.registerWorker('work:B', function(context, callback) {

  var newNumber = context.variables.numberVar + 1;

  // indicate an error
  callback(
    new Error('no work done');
  );

  // or return actual result
  callback(null, {
    variables: {
      numberVar: newNumber
    }
  });
});
```

### Workers as async Functions

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


## Trigger BPMN Errors

You may indicate BPMN errors to trigger business defined exception handling:

```javascript
workers.registerWorker('work:B', async function(context) {

  // trigger business aka BPMN errors
  return {
    errorCode: 'some-bpmn-error'
  };
});
```


## Task Locks

You may configure the initial lock time (defaults to 10 seconds) on worker registration.

At the same time you may use the method `extendLock`, provided via the task context,
to increase the lock time while the worker is busy.

```javascript
// configure three seconds as initial lock time
workers.registerWorker('work:B', {
  lockTime: 3000,
  variables: [ 'a' ]
}, async function(context) {

  var extendLock = context.extendLock;

  // extend the lock for another five seconds
  await extendLock(5000);

  // complete task
  return {};
});
```

Read more about external task locking in the [Camunda Documentation](https://docs.camunda.org/manual/latest/user-guide/process-engine/external-tasks/).


## Authentication

We provide middlewares for basic auth as well as token based authentication.

### Basic Auth

Provide your client credentials via the [`BasicAuth`](./lib/basic-auth.js) middleware:

```javascript
var workers = Workers(engineEndpoint, {
  use: [
    BasicAuth('walt', 'SECRET_PASSWORD')
  ]
};
```


### Token Authentication

Provide your tokens via the [`Auth`](./lib/auth.js) middleware:

```javascript
var workers = Workers(engineEndpoint, {
  use: [
    Auth('Bearer', 'BEARER_TOKEN')
  ]
};
```


### Custom Made

To support custom authentication options add additional request headers to authenticate your task workers via the `requestOptions` configuration:

```javascript
var workers = Workers(engineEndpoint, {
  requestOptions: {
    headers: {
      Hello: 'Authenticated?'
    }
  }
})
```


## Logging

We employ [debug](https://www.npmjs.com/package/debug) for logging.

Use the [`Logger` extension](./lib/logger.js) in combination with `DEBUG=*` to capture a full trace of what's going on under the hood:

```bash
DEBUG=* node start-workers.js
```


## Configure Task Fetching

Task fetching is controlled by two configuration properties:

* `maxTasks` - maximum number of tasks to be fetched and locked with a single poll
* `pollingInterval` - interval in milliseconds between polls

You may configure both properties on workers creation and at run-time:

```javascript
var workers = Workers(engineEndpoint, {
  maxTasks: 2,
  pollingInterval: 1500
});

// dynamically increase max tasks
workers.configure({
  maxTasks: 5
});
```

This way you can control the task fetching behavior both statically and dynamically.

Roll your own middleware to dynamically configure the workers instance or let
the [`Backoff` middleware](./lib/backoff.js) do the work for you.


## Extend Workers

Workers may be extended via the `use` config parameter.

```javascript
Workers(engineEndpoint, {
  use: [
    Logger,
    Backoff,
    Metrics,
    BasicAuth('Walt', 'SECRET_PASSWORD')
  ]
});
```

#### Existing Extensions

* [`Logger`](./lib/logger.js) - adds verbose logging of what is going on
* [`Backoff`](./lib/backoff.js) - dynamically adjust poll times based on Camunda REST api availability, fetched tasks and poll processing times
* [`Metrics`](./lib/metrics.js) - collect and periodically log utilization metrics
* [`BasicAuth`](./lib/basic-auth.js) - authorize against REST api with username + password
* [`Auth`](./lib/auth.js) - authorize against REST api with arbitrary tokens


## Dynamically Unregister a Worker

It is possible to dynamically unregister a worker any time.

```javascript
var worker = workers.registerWorker('someTopic', async function(context) {
  // do work
  console.log('doing work!');
});

// later
worker.remove();
```


## Installation

```bash
npm i --save camunda-worker-node
```


## Develop

Install dependencies:

```bash
npm install
```

Lint and run all tests:

```bash
DEBUG=worker* npm run all
```

__Note:__ You need a Camunda BPM REST API exposed on `localhost:8080/engine-rest` for the tests to pass. An easy way to get it up running is [via Docker](https://github.com/camunda/docker-camunda-bpm-platform#get-started).


## License

MIT
