var expect = require('chai').expect;

var Worker = require('../');

var Logger = require('../lib/logger');
var Backoff = require('../lib/backoff');

var EngineApi = require('./engine/api');

var {
  delay
} = require('./helper');


describe('backoff', function() {

  // slow tests...
  this.timeout(15000);


  var engineUrl = 'http://localhost:8080/engine-rest';

  var engineApi = new EngineApi(engineUrl);


  var worker, deployment;

  beforeEach(async function() {
    deployment = await engineApi.deploy(__dirname + '/process.bpmn');
  });

  afterEach(async function() {
    if (worker) {
      await worker.stop();

      worker = null;
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

    worker = Worker(engineUrl, {
      autoPoll: true,
      pollingInterval: 500,
      use: [
        Backoff,
        Logger
      ]
    });

    worker.on('backoff:updatePollingInterval', function(newInterval, currentInterval, reason) {

      expect(newInterval).to.exist;
      expect(currentInterval).to.exist;
      expect(reason).to.exist;

      backoffTrace.push([ reason, newInterval > currentInterval ]);
    });

    worker.subscribe('work:A', async function(context) {
      // when
      trace.push('work:A');
    });

    await delay(1);

    await worker.stop();

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

    worker = Worker(engineUrl, {
      autoPoll: true,
      pollingInterval: 500,
      use: [
        [ Backoff, { maxActiveTasks: 1 } ],
        Logger
      ]
    });

    worker.on('backoff:updatePollingInterval', function(newInterval, currentInterval, reason) {

      expect(newInterval).to.exist;
      expect(currentInterval).to.exist;
      expect(reason).to.exist;

      backoffTrace.push([ 'pollingInterval', newInterval, reason ]);
    });


    worker.on('backoff:updateMaxTasks', function(newMaxTasks, currentMaxTasks, reason) {

      expect(newMaxTasks).to.exist;
      expect(currentMaxTasks).to.exist;
      expect(reason).to.exist;

      backoffTrace.push([ 'maxTasks', newMaxTasks, reason ]);
    });

    worker.subscribe('work:A', async function(context) {
      // when
      trace.push('work:A');

      await delay(.5);
    });

    await delay(4);

    await worker.stop();

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
