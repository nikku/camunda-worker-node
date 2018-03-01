# camunda-worker-node

Implement [external task](https://docs.camunda.org/manual/latest/user-guide/process-engine/external-tasks/) workers for [Camunda BPM](http://camunda.org) in [NodeJS](https://nodejs.org/).

Compatible with __Camunda BPM 7.8+__.


## Summary

This library provides you with a simple API to implement external tasks for the [Camunda process engine](http://camunda.org) with NodeJS.

```javascript
var Workers = require('camunda-worker-node');

var engineEndpoint = 'http://localhost:8080/engine-rest';

var workers = Workers(engineEndpoint, {
  workerId: 'some-worker-id'
});

// a worker may access request, access and modify process variables
workers.registerWorker('work:A', [ 'numberVar' ], function(context, callback) {

  var newNumber = context.variables.numberVar + 1;

  // node style callback (err, result)
  callback(null, {
    variables: {
      numberVar: newNumber
    }
  });
});

// a worker can handle errors, too
workers.registerWorker('work:B', function(context, callback) {

  // report an error, if things go awry
  callback(new Error('no work done'));
});


// shutdown the workers instance with the application
workers.shutdown();
```

Make sure you defined the external tasks in the process diagram before:

```xml
<bpmn:serviceTask
        id="Task_A"
        camunda:type="external"
        camunda:topicName="work:A" />
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

```
npm install
npm test
```

__Hint:__ You need a Camunda BPM REST API exposed on `localhost:8080/engine-rest` for the tests to pass. An easy way to get it up running is [via Docker](https://github.com/camunda/docker-camunda-bpm-platform#get-started).


## License

MIT
