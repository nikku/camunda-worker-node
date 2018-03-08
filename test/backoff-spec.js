var expect = require('chai').expect;

var Workers = require('../');

var Logger = require('../lib/logger');
var Backoff = require('../lib/backoff');

var EngineApi = require('./engine/api');

var {
  delay
} = require('./helper');


describe('backoff', function() {

  // slow tests...
  this.timeout(10000);


  var engineUrl = 'http://localhost:8080/engine-rest';

  var engineApi = new EngineApi(engineUrl);


  var workers, deployment;

  beforeEach(async function() {
    deployment = await engineApi.deploy(__dirname + '/process.bpmn');
  });

  afterEach(async function() {
    if (workers) {
      await workers.shutdown();

      workers = null;
    }

    if (deployment) {
      await delay(1);

      await engineApi.undeploy(deployment);

      deployment = null;
    }
  });


  it('should adjust pollingInterval', async function() {

    // given
    for (var i = 0; i < 3; i++) {
      await engineApi.startProcessByKey('TestProcess');
    }

    var trace = [];

    var backoffTrace = [];

    workers = Workers(engineUrl, {
      pollingDelay: 0,
      pollingInterval: 500,
      use: [
        Backoff,
        Logger
      ]
    });

    workers.on('backoff:updatePollingInterval', function(newInterval, currentInterval, reason) {

      expect(newInterval).to.exist;
      expect(currentInterval).to.exist;
      expect(reason).to.exist;

      backoffTrace.push([ reason, newInterval > currentInterval ]);
    });

    workers.registerWorker('work:A', async function(context) {
      // when
      trace.push('work:A');
    });

    await delay(1);

    await workers.shutdown();

    // then
    expect(trace).to.eql([
      'work:A',
      'work:A',
      'work:A'
    ]);

    expect(backoffTrace).to.eql([
      [ 'max tasks fetched', false ],
      [ 'fetch tasks success', true ]
    ]);
  });


  it('should adjust maxTasks', async function() {

    // given
    for (var i = 0; i < 4; i++) {
      await engineApi.startProcessByKey('TestProcess');
    }

    var trace = [];

    var backoffTrace = [];

    workers = Workers(engineUrl, {
      pollingDelay: 0,
      pollingInterval: 500,
      use: [
        [ Backoff, { maxActiveTasks: 1 } ],
        Logger
      ]
    });

    workers.on('backoff:updatePollingInterval', function(newInterval, currentInterval, reason) {

      expect(newInterval).to.exist;
      expect(currentInterval).to.exist;
      expect(reason).to.exist;

      backoffTrace.push([ reason, newInterval ]);
    });


    workers.on('backoff:updateMaxTasks', function(newMaxTasks, currentMaxTasks, reason) {

      expect(newMaxTasks).to.exist;
      expect(currentMaxTasks).to.exist;
      expect(reason).to.exist;

      backoffTrace.push([ reason, newMaxTasks ]);
    });

    workers.registerWorker('work:A', async function(context) {
      // when
      trace.push('work:A');

      await delay(.5);
    });

    await delay(4);

    await workers.shutdown();

    // then
    expect(trace).to.eql([
      'work:A',
      'work:A',
      'work:A',
      'work:A'
    ]);

    expect(backoffTrace).to.eql([
      [ 'max tasks fetched', 0 ],
      [ 'task started', 0 ],
      [ 'max tasks reached', 500 ],
      [ 'task started', 0 ],
      [ 'task completed', 2 ],
      [ 'max tasks fetched', 0 ],
      [ 'task started', 0 ],
      [ 'max tasks reached', 500 ],
      [ 'task started', 0 ],
      [ 'task completed', 2 ]
    ]);

  });

});
