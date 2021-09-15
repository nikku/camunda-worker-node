# camunda-worker-node

[![CI](https://github.com/nikku/camunda-worker-node/actions/workflows/CI.yml/badge.svg)](https://github.com/nikku/camunda-worker-node/actions/workflows/CI.yml)

Implement your [external task workers](https://docs.camunda.org/manual/latest/user-guide/process-engine/external-tasks/) for [Camunda](http://camunda.org) in [NodeJS](https://nodejs.org/).

> Compatible with Camunda `>= 7.8`. Requires NodeJS `>= 8.6`.


## Usage

This library exposes a simple API to implement external task workers for [Camunda](http://camunda.org).

```javascript
var Worker = require('camunda-worker-node');
var Backoff = require('camunda-worker-node/lib/backoff');

var engineEndpoint = 'http://localhost:8080/engine-rest';

var worker = Worker(engineEndpoint, {
  workerId: 'some-worker-id',
  use: [
    Backoff
  ]
});

// a work subscription may access and modify process variables
worker.subscribe('work:A', [ 'numberVar' ], async function(context) {

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

// stop the worker instance with the application
worker.stop();
```

Make sure you properly configured the [external tasks](https://docs.camunda.org/manual/latest/user-guide/process-engine/external-tasks/) in your BPMN 2.0 diagram:

```xml
<bpmn:serviceTask
  id="Task_A"
  camunda:type="external"
  camunda:topicName="work:A" />
```


## Features

* Subscribe to work [node-style](#work-node-style) or via [`async` functions](#work-with-async-function)
* Complete tasks with updated variables or fail with errors
* Trigger [BPMN errors](#trigger-bpmn-errors)
* [Configure and extend task locks](#task-locks)
* Configure [logging](#logging) and [authentication](#authentication)
* [Configure task fetching](#task-fetching)
* [Control the worker life-cycle](#worker-life-cycle)
* [Extend via plug-ins](#extend-via-plug-ins)
* [Customize Variable Serialization](#variable-serialization)


## Resources

* [Example](./example)
* [Issues](https://github.com/nikku/camunda-worker-node/issues)
* [Changelog](./CHANGELOG.md)


## Implementing Worker

Implement your workers via `async`, promise returning functions or pass results via node-style callbacks.


### Work, Node Style

Use the provided callback to pass task execution errors and data, node-style:

```javascript
// report work results via a node-style callback
workes.subscribe('work:B', function(context, callback) {

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

### Work with async Function

ES6 style async/await to implement work is fully supported:

```javascript
// implement work via a Promise returning async function
worker.subscribe('work:B', async function(context) {

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
worker.subscribe('work:B', async function(context) {

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
worker.subscribe('work:B', {
  lockDuration: 3000,
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
var worker = Worker(engineEndpoint, {
  use: [
    BasicAuth('walt', 'SECRET_PASSWORD')
  ]
};
```


### Token Authentication

Provide your tokens via the [`Auth`](./lib/auth.js) middleware:

```javascript
var worker = Worker(engineEndpoint, {
  use: [
    Auth('Bearer', 'BEARER_TOKEN')
  ]
};
```


### Custom Made

To support custom authentication options add additional request headers to authenticate your task worker via the `requestOptions` configuration:

```javascript
var worker = Worker(engineEndpoint, {
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


## Task Fetching

Task fetching is controlled by two configuration properties:

* `maxTasks` - maximum number of tasks to be fetched and locked with a single poll
* `pollingInterval` - interval in milliseconds between polls

You may configure both properties on worker creation and at run-time:

```javascript
var worker = Worker(engineEndpoint, {
  maxTasks: 2,
  pollingInterval: 1500
});

// dynamically increase max tasks
worker.configure({
  maxTasks: 5
});
```

This way you can configure the task fetching behavior both statically and dynamically.

Roll your own middleware to dynamically configure the worker instance or let
the [`Backoff` middleware](./lib/backoff.js) take care of it.

As an alternative to configuring these values you may [stop and re-start](#worker-life-cycle)
the Worker instance as needed, too.


## Worker Life-Cycle

Per default the worker instance will start to poll for work immediately.
Configure this behavior via the `autoPoll` option and start, stop and re-start
the instance programatically if you need to:

```javascript
var worker = Worker(engineEndpoint, {
  autoPoll: false
});

// manually start polling
worker.start();

// stop later on
await worker.stop();

// re-start at some point in time
worker.start();
```


## Extend via Plug-ins

A worker may be extended via the `use` config parameter.

```javascript
Worker(engineEndpoint, {
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


## Variable Serialization

Variables, when being read, modified and passed back on taks completion will preserve
their serialized form (indicated via `valueInfo` as documented in the [Camunda REST API documentation](https://docs.camunda.org/manual/latest/reference/rest/external-task/post-complete/)). Newly added variables will be serialized without `valueInfo` using the types `String`, `Date`, `Boolean`, `Json` or `Double` as appropriate.

You may wrap variables with `SerializedVariable` if you would like to take full control over variable serialization:

```javascript
var Serialized = require('camunda-worker-node/lib/serialized-variable');

worker.subscribe('shop:create-customer', async function(context) {

  return {
    variables: {
      // wrap user to indicate it is already serialized
      customer: Serialized({
        type: 'Object',
        value: JSON.stringify({
          name: 'Hugo'
        }),
        valueInfo: {
          serializationDataFormat: 'application/json',
          objectTypeName: 'my.example.Customer'
        }
      })
    }
  };
});
```


## Dynamically Unregister a Work Subscription

It is possible to dynamically unregister a work subscription any time.

```javascript
var subscription = worker.subscribe('someTopic', async function(context) {
  // do work
  console.log('doing work!');
});

// later
subscription.remove();
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


## Related

* [External task documentation](https://docs.camunda.org/manual/latest/user-guide/process-engine/external-tasks/)
* [Official external task client](https://github.com/camunda/camunda-external-task-client-js)

## License

MIT
