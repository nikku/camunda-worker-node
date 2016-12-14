var fs = require('fs');

var extend = require('xtend');

var Workers = require('../');
var Logger = require('../lib/logger');

var EngineApi = require('./engine/api');


function delay(seconds, fn) {
  return setTimeout(fn, seconds * 1000);
}

function log(worker, context) {

  return {
    worker: worker,
    context: {
      topicName: context.topicName,
      activityId: context.activityId,
      processInstanceId: context.processInstanceId
    }
  };
}


describe('workers', function() {

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


  describe('api', function() {

    function emptyCallback() {}

    it('should define worker with options', function() {

      // given
      workers = Workers(engineUrl);

      // when
      var workerDefinition = workers.registerWorker('worker:Stuff', { lockTime: 3000 }, emptyCallback);

      // then
      expect(workerDefinition.variables).to.be.undefined;
      expect(workerDefinition.remove).to.exist;

      expect(function() {
        workerDefinition.remove();
      }).not.to.throw;

    });


    it('should define worker with variables', function() {

      // given
      workers = Workers(engineUrl);

      // when
      var workerDefinition = workers.registerWorker('worker:Stuff', [ 'a', 'b' ], emptyCallback);

      // then
      expect(workerDefinition.variables).to.eql([ 'a', 'b' ]);

      // default lock time is applied
      expect(workerDefinition.lockTime).to.eql(10000);
    });


    it('should allow single worker per topic name only', function() {

      // given
      workers = Workers(engineUrl);

      // when
      workers.registerWorker('worker:Stuff', [ 'a', 'b' ], emptyCallback);

      // then
      expect(function() {
        workers.registerWorker('worker:Stuff', [ 'a', 'b' ], emptyCallback);
      }).to.throw('worker for <worker:Stuff> already registered');
    });


    it('should configure Workers with workerId', function() {

      // given
      workers = Workers(engineUrl, { workerId: 'FOO' });

      // then
      expect(workers.options.workerId).to.eql('FOO');
    });


    describe('should extend via [use]', function() {

      it('without options', function() {

        // given
        var called;

        function Extension(workers, opts) {
          called = [ workers, opts ];
        }

        // when
        workers = Workers(engineUrl, {
          use: [ Extension ]
        });

        // then
        expect(called).to.eql([ workers, {} ]);
      });


      it('with options', function() {

        // given
        var called;

        function Extension(workers, opts) {
          called = [ workers, opts ];
        }

        // when
        workers = Workers(engineUrl, {
          use: [ [ Extension, { foo: 'BAR' } ] ]
        });

        // then
        expect(called).to.eql([ workers, { foo: 'BAR' } ]);
      });


      it('failing on malformed', function() {

        // when
        expect(function() {
          Workers(engineUrl, {
            use: [ { foo: 'BAR' } ]
          });
        }).to.throw('extension must be <function> or <[ function, opts ]>');

      });

    });

  });


  describe('task execution', function() {

    it('should handle multiple', function(done) {

      var trace = [];

      var idx = 0;

      workers = Workers(engineUrl, {
        workerId: 'test-worker',
        use: [ Logger ]
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


    it('should execute process', function(done) {

      var trace = [];

      var nestedObjectVar = { id: '1111', aList: [ 'A', 'B' ] };

      var dateVar = new Date('2010-07-06T10:30:10.000Z');

      var startVariables = {
        dateVar: dateVar,
        numberVar: 1,
        objectVar: { name: 'Walter' }
      };

      workers = Workers(engineUrl, {
        workerId: 'test-worker',
        use: [ Logger ]
      });

      workers.registerWorker('work:A', [ 'numberVar', 'objectVar', 'dateVar', 'nonExistingVar' ], function(context, callback) {
        expect(context.id).to.exist;
        expect(context.topicName).to.exist;
        expect(context.lockExpirationTime).to.exist;
        expect(context.activityId).to.exist;
        expect(context.activityInstanceId).to.exist;
        expect(context.processInstanceId).to.exist;

        expect(context.variables.numberVar).to.eql(1);
        expect(context.variables.objectVar).to.eql({ name: 'Walter' });
        expect(context.variables.dateVar).to.eql(dateVar);
        expect(context.variables.nonExistingVar).to.be.undefined;

        callback(null, {
          variables: {
            stringVar: 'BAR',
            nestedObjectVar: nestedObjectVar
          }
        });

        trace.push(log('work:A', context));
      });


      workers.registerWorker('work:B', [ 'stringVar', 'nestedObjectVar' ], function(context, callback) {

        expect(context.variables.stringVar).to.eql('BAR');
        expect(context.variables.nestedObjectVar).to.eql(nestedObjectVar);

        trace.push(log('work:B', context));

        callback(null);
      });


      engineApi.startProcessByKey('TestProcess', startVariables, function(err, processInstance) {

        if (err) {
          return done(err);
        }

        delay(4, function() {

          expect(trace).to.eql([
            {
              worker: 'work:A',
              context: {
                topicName: 'work:A',
                activityId: 'Task_A',
                processInstanceId: processInstance.id
              }
            },
            {
              worker: 'work:B',
              context: {
                topicName: 'work:B',
                activityId: 'Task_B',
                processInstanceId: processInstance.id
              }
            }
          ]);

          engineApi.getProcessInstance(processInstance.id, function(err, processInstance) {

            if (err) {
              return done(err);
            }

            expect(processInstance).not.to.exist;

            done();
          });

        });

      });
    });

  });


  describe('typed', function() {

    it('should preserve Object serialization', function(done) {

      var existingUser = {
        type: 'Object',
        value: { name: 'Hugo' },
        valueInfo: {
          serializationDataFormat: 'application/json',
          objectTypeName: 'my.example.Customer'
        }
      };

      var newUser = {
        type: 'Object',
        value: { name: 'Bert', age: 50 },
        valueInfo: {
          serializationDataFormat: 'application/json',
          objectTypeName: 'my.example.Customer'
        }
      };

      workers = Workers(engineUrl);

      workers.registerWorker('work:A', [ 'existingUser' ], function(context, callback) {

        var existingUser = context.variables.existingUser;

        // expect deserialized user
        expect(existingUser).to.eql({ name: 'Hugo' });

        // update
        existingUser.age = 31;

        callback(null, {
          variables: {
            existingUser: existingUser,
            // pass serialized new user
            newUser: newUser
          }
        });
      });


      engineApi.startProcessByKey('TestProcess', { existingUser: existingUser }, function(err, processInstance) {

        delay(3, function() {

          engineApi.getProcessVariable(processInstance.id, 'newUser', function(err, variable) {

            var rawNewUser = extend({}, newUser, { value: JSON.stringify(newUser.value) });

            // expect saved new user
            expect(variable).to.eql(rawNewUser);

            engineApi.getProcessVariable(processInstance.id, 'existingUser', function(err, variable) {

              var rawExistingUser = extend({}, newUser, { value: JSON.stringify({ name: 'Hugo', age: 31 }) });

              // expect modified existing user
              expect(variable).to.eql(rawExistingUser);

              done(err);
            });

          });

        });

      });

    });

  });

});
