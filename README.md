# camunda-worker-node

Implement workers for external tasks in [Camunda BPM](http://camunda.org) in [NodeJS](https://nodejs.org/).

> Alternative Versions: [Java](https://github.com/meyerdan/camunda-worker-java)


## Summary

This tool provides a JavaScript interface to external tasks exposed by the process engine.

```javascript
var engineEndpoint = 'http://localhost:8080/engine-rest';

var workers = Workers(engineEndpoint);

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


## Install the Worker

```
npm i --save camunda-worker-node
```


## Develop

```
npm install
npm test
```


## License

MIT