var fs = require('fs');

var expect = require('chai').expect;

var Workers = require('../');

var Logger = require('../lib/logger');
var Backoff = require('../lib/backoff');

var EngineApi = require('./engine/api');


function delay(seconds, fn) {
  return setTimeout(fn, seconds * 1000);
}


describe('backoff', function() {

  // slow tests...
  this.timeout(10000);


  var engineUrl = 'http://localhost:8080/engine-rest';

  var engineApi = new EngineApi(engineUrl);


  var workers, deployment;

  beforeEach(function(done) {

    var inputStream = fs.createReadStream(__dirname + '/process.bpmn');

    engineApi.deploy(inputStream, function(err, newDeployment) {

      if (err) {
        return done(err);
      }

      deployment = newDeployment;

      done();
    });

  });

  afterEach(function(done) {
    if (workers) {

      workers.shutdown(function() {
        var registeredWorkers = workers.workers;

        Object.keys(registeredWorkers).forEach(function(topic) {
          registeredWorkers[topic].remove();
        });
      });
    }

    if (deployment) {
      engineApi.undeploy(deployment, done);
    }
  });


  describe('task execution', function() {

    it('should work with backoff', function(done) {

      var trace = [];

      workers = Workers(engineUrl, {
        workerId: 'test-worker',
        use: [ Logger, Backoff ]
      });

      workers.registerWorker('work:A', function(context, callback) {
        trace.push('work:A');

        callback(null);
      });


      for (var i = 0; i < 3; i++) {
        engineApi.startProcessByKey('TestProcess', function() { });
      }

      delay(3, function() {

        expect(trace).to.eql([
          'work:A',
          'work:A',
          'work:A'
        ]);

        done();
      });

    });

  });

});
