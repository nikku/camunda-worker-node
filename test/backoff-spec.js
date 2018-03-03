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


  describe('task execution', function() {

    it('should work with backoff', async function() {

      // given
      for (var i = 0; i < 3; i++) {
        await engineApi.startProcessByKey('TestProcess');
      }

      var trace = [];

      workers = Workers(engineUrl, {
        pollingDelay: 0,
        pollingInterval: 500,
        use: [
          Logger,
          Backoff
        ]
      });

      workers.registerWorker('work:A', async function(context) {
        // when
        trace.push('work:A');
      });

      await delay(2);

      // then
      expect(trace).to.eql([
        'work:A',
        'work:A',
        'work:A'
      ]);

    });

  });

});
