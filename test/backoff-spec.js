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
  this.timeout(30000);


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
      [ 'maxTasks fetched', false ],
      [ 'less than maxTasks fetched', true ]
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

      backoffTrace.push([ 'pollingInterval', newInterval, reason ]);
    });


    workers.on('backoff:updateMaxTasks', function(newMaxTasks, currentMaxTasks, reason) {

      expect(newMaxTasks).to.exist;
      expect(currentMaxTasks).to.exist;
      expect(reason).to.exist;

      backoffTrace.push([ 'maxTasks', newMaxTasks, reason ]);
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
      [ 'pollingInterval', 0, 'maxTasks fetched' ],
      [ 'maxTasks', 0, 'maxActiveTasks reached' ],
      [ 'pollingInterval', 500, 'maxActiveTasks reached' ],
      [ 'maxTasks', 2, 'maxActiveTasks underrun' ],
      [ 'pollingInterval', 0, 'maxActiveTasks underrun' ],
      [ 'maxTasks', 0, 'maxActiveTasks reached' ],
      [ 'pollingInterval', 500, 'maxActiveTasks reached' ],
      [ 'maxTasks', 2, 'maxActiveTasks underrun' ],
      [ 'pollingInterval', 0, 'maxActiveTasks underrun' ],
      [ 'pollingInterval', 500, 'less than maxTasks fetched' ]
    ]);

  });

});
