var expect = require('chai').expect;

var extend = require('xtend');

var Workers = require('../');

var Logger = require('../lib/logger');
var Backoff = require('../lib/backoff');

var EngineApi = require('./engine/api');

var debug = require('debug')('workers-spec');

var {
  delay
} = require('./helper');


describe('workers', function() {

  // slow tests...
  this.timeout(12000);


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

  function createWorkers(options = {}) {

    options = extend({
      pollingDelay: 0,
      pollingInterval: 500,
      use: [
        Logger,
        Backoff
      ]
    }, options);

    return Workers(engineUrl, options);
  }


  describe('api', function() {

    it('should define worker with options', function() {

      // given
      workers = Workers(engineUrl);

      // when
      var workerDefinition = workers.registerWorker('worker:Stuff', { lockTime: 3000 }, noop);

      // then
      expect(workerDefinition.variables).not.to.exist;
      expect(workerDefinition.remove).to.exist;

      expect(function() {
        workerDefinition.remove();
      }).not.to.throw;

    });


    it('should define worker with variables', function() {

      // given
      workers = Workers(engineUrl);

      // when
      var workerDefinition = workers.registerWorker('worker:Stuff', [ 'a', 'b' ], noop);

      // then
      expect(workerDefinition.variables).to.eql([ 'a', 'b' ]);

      // default lock time is applied
      expect(workerDefinition.lockTime).to.eql(10000);
    });


    it('should allow single worker per topic name only', function() {

      // given
      workers = Workers(engineUrl);

      // when
      workers.registerWorker('worker:Stuff', [ 'a', 'b' ], noop);

      // then
      expect(function() {
        workers.registerWorker('worker:Stuff', [ 'a', 'b' ], noop);
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
          use: [
            [ Extension, { foo: 'BAR' } ]
          ]
        });

        // then
        expect(called).to.eql([
          workers,
          { foo: 'BAR' }
        ]);
      });


      it('failing on malformed', function() {

        // when
        expect(function() {
          Workers(engineUrl, {
            use: [
              { foo: 'BAR' }
            ]
          });
        }).to.throw('extension must be <function> or <[ function, opts ]>');

      });

    });

  });


  describe('task execution', function() {

    function log(context) {

      return {
        topicName: context.topicName,
        activityId: context.activityId,
        processInstanceId: context.processInstanceId
      };
    }


    it('should provide context', function(done) {

      // given
      engineApi.startProcessByKey('TestProcess', {});

      workers = createWorkers();

      // when
      workers.registerWorker('work:A', async function(context) {

        // then
        expect(context.topicName).to.eql('work:A');
        expect(context.workerId).to.eql(workers.options.workerId);

        expect(context.id).to.exist;
        expect(context.lockExpirationTime).to.exist;
        expect(context.activityId).to.eql('Task_A');
        expect(context.activityInstanceId).to.match(/Task_A/);
        expect(context.processInstanceId).to.exist;
        expect(context.processDefinitionKey).to.eql('TestProcess');

        expect(context.variables).to.eql({});

        done();
      });
    });


    describe('should provide variables', function() {

      it('all (default)', function(done) {

        // given
        var dateVar = new Date('2010-07-06T10:30:10.000Z');

        engineApi.startProcessByKey('TestProcess', {
          numberVar: 1,
          objectVar: {
            name: 'Walter'
          },
          dateVar: dateVar
        });

        workers = createWorkers();

        // when
        workers.registerWorker('work:A', async function(context) {

          // then
          // fetching all variables
          expect(context.variables).to.eql({
            numberVar: 1,
            objectVar: {
              name: 'Walter'
            },
            dateVar: dateVar
          });

          done();
        });
      });


      it('specific', function(done) {

        // given
        engineApi.startProcessByKey('TestProcess', {
          numberVar: 1,
          objectVar: {
            name: 'Walter'
          },
          dateVar: new Date('2010-07-06T10:30:10.000Z')
        });

        workers = createWorkers();

        // when
        workers.registerWorker('work:A', [ 'numberVar' ], async function(context) {

          // then
          // fetching all variables
          expect(context.variables).to.eql({
            numberVar: 1
          });

          done();
        });
      });

    });


    it('should batch execute tasks', async function() {

      // given
      var trace = [];

      workers = createWorkers();

      workers.registerWorker('work:A', async function(context) {
        trace.push('work:A');
      });

      // when
      for (var i = 0; i < 10; i++) {
        await engineApi.startProcessByKey('TestProcess');
      }

      await delay(2);

      // then
      expect(trace).to.eql([
        'work:A',
        'work:A',
        'work:A',
        'work:A',
        'work:A',
        'work:A',
        'work:A',
        'work:A',
        'work:A',
        'work:A'
      ]);
    });


    it('should execute process', async function() {

      // given
      var trace = [];

      var nestedObjectVar = {
        id: '1111',
        aList: [
          'A',
          'B'
        ]
      };

      var dateVar = new Date('2010-07-06T10:30:10.000Z');

      var startVariables = {
        dateVar: dateVar,
        numberVar: 1,
        objectVar: { name: 'Walter' }
      };

      var {
        id
      } = await engineApi.startProcessByKey('TestProcess', startVariables);

      workers = createWorkers();

      // when
      // (1) callback style worker
      workers.registerWorker('work:A', [
        'numberVar',
        'objectVar',
        'dateVar',
        'nonExistingVar'
      ], function(context, callback) {

        trace.push(log(context));

        expect(context.variables).to.eql({
          numberVar: 1,
          objectVar: { name: 'Walter' },
          dateVar: dateVar
        });

        callback(null, {
          variables: {
            stringVar: 'BAR',
            nestedObjectVar: nestedObjectVar
          }
        });
      });

      // (2) promise based worker
      workers.registerWorker('work:B', [
        'stringVar',
        'nestedObjectVar'
      ], function(context) {

        trace.push(log(context));

        expect(context.variables).to.eql({
          stringVar: 'BAR',
          nestedObjectVar: nestedObjectVar
        });

        return new Promise(function(resolve, reject) {
          resolve();
        });
      });

      await delay(3);

      // then
      expect(trace).to.eql([
        {
          topicName: 'work:A',
          activityId: 'Task_A',
          processInstanceId: id
        },
        {
          topicName: 'work:B',
          activityId: 'Task_B',
          processInstanceId: id
        }
      ]);

      expect(
        await engineApi.getProcessInstance(id)
      ).not.to.exist;
    });


    it('should execute process / no backoff', async function() {

      // given
      var trace = [];

      var nestedObjectVar = {
        id: '1111',
        aList: [
          'A',
          'B'
        ]
      };

      var dateVar = new Date('2010-07-06T10:30:10.000Z');

      var startVariables = {
        dateVar: dateVar,
        numberVar: 1,
        objectVar: { name: 'Walter' }
      };

      var {
        id
      } = await engineApi.startProcessByKey('TestProcess', startVariables);

      workers = createWorkers({
        use: [ Logger ]
      });

      // when
      // (1) callback style worker
      workers.registerWorker('work:A', [
        'numberVar',
        'objectVar',
        'dateVar',
        'nonExistingVar'
      ], function(context, callback) {

        trace.push(log(context));

        expect(context.variables).to.eql({
          numberVar: 1,
          objectVar: { name: 'Walter' },
          dateVar: dateVar
        });

        callback(null, {
          variables: {
            stringVar: 'BAR',
            nestedObjectVar: nestedObjectVar
          }
        });
      });

      // (2) promise based worker
      workers.registerWorker('work:B', [
        'stringVar',
        'nestedObjectVar'
      ], function(context) {

        trace.push(log(context));

        expect(context.variables).to.eql({
          stringVar: 'BAR',
          nestedObjectVar: nestedObjectVar
        });

        return new Promise(function(resolve, reject) {
          resolve();
        });
      });

      await delay(3);

      // then
      expect(trace).to.eql([
        {
          topicName: 'work:A',
          activityId: 'Task_A',
          processInstanceId: id
        },
        {
          topicName: 'work:B',
          activityId: 'Task_B',
          processInstanceId: id
        }
      ]);

      expect(
        await engineApi.getProcessInstance(id)
      ).not.to.exist;
    });


    describe('should extend lock', function() {

      it('callback style', function(done) {

        // given
        engineApi.startProcessByKey('TestProcess', {});

        // when
        workers = createWorkers();

        workers.registerWorker('work:A', function(context, callback) {

          // then
          var extendLock = context.extendLock;

          expect(extendLock).to.exist;

          extendLock(5000, function(err) {
            callback();

            done();
          });
        });
      });


      it('promise style', function(done) {

        // given
        engineApi.startProcessByKey('TestProcess', {});

        // when
        workers = createWorkers();

        workers.registerWorker('work:A', [ 'numberVar' ], async function(context) {

          // then
          var extendLock = context.extendLock;

          expect(extendLock).to.exist;

          await extendLock(5000);

          done();
        });
      });

    });


    describe('should handle error', function() {

      it('passed via callback', async function() {

        // given
        await engineApi.startProcessByKey('TestProcess');

        workers = createWorkers();

        // when
        workers.registerWorker('work:A', function(context, callback) {
          callback(new Error('could not execute'));
        });

        await delay(1);

        // then
        var workerId = workers.options.workerId;

        const log = await engineApi.getWorkerLog(workerId);

        expect(log).to.have.length(1);
        expect(log[0].errorMessage).to.eql('could not execute');
      });


      it('promise rejection', async function() {

        // given
        await engineApi.startProcessByKey('TestProcess');

        workers = createWorkers();

        // when
        workers.registerWorker('work:A', function(context) {
          return Promise.reject(
            new Error('could not execute')
          );
        });

        await delay(1);

        // then
        var workerId = workers.options.workerId;

        const log = await engineApi.getWorkerLog(workerId);

        expect(log).to.have.length(1);
        expect(log[0].errorMessage).to.eql('could not execute');
      });


      it('async function throw', async function() {

        // given
        await engineApi.startProcessByKey('TestProcess');

        workers = createWorkers();

        // when
        workers.registerWorker('work:A', async function(context) {
          throw new Error('could not execute');
        });

        await delay(1);

        // then
        var workerId = workers.options.workerId;

        const log = await engineApi.getWorkerLog(workerId);

        expect(log).to.have.length(1);
        expect(log[0].errorMessage).to.eql('could not execute');
      });


      it('synchronously thrown', async function() {

        // given
        await engineApi.startProcessByKey('TestProcess');

        workers = createWorkers();

        // when
        workers.registerWorker('work:A', function(context, callback) {
          throw new Error('could not execute');
        });

        await delay(1);

        // then
        var workerId = workers.options.workerId;

        const log = await engineApi.getWorkerLog(workerId);

        expect(log).to.have.length(1);
        expect(log[0].errorMessage).to.eql('could not execute');
      });

    });


    it('should trigger BPMN error', async function() {

      // given
      const {
        id
      } = await engineApi.startProcessByKey('TestProcess');

      workers = createWorkers();

      // when
      workers.registerWorker('work:A', async function(context) {
        return {
          errorCode: 'some-error'
        };
      });

      await delay(2);

      // then
      const activityInstances = await engineApi.getActivityInstances(id);

      const nestedInstances = activityInstances.childActivityInstances;

      expect(nestedInstances).to.have.length(1);
      expect(nestedInstances[0].activityId).to.eql('Task_C');
    });

  });


  describe('typed', function() {

    it('should preserve Object serialization', async function() {

      // given
      var existingUser = {
        type: 'Object',
        value: {
          name: 'Hugo'
        },
        valueInfo: {
          serializationDataFormat: 'application/json',
          objectTypeName: 'my.example.Customer'
        }
      };

      const {
        id
      } = await engineApi.startProcessByKey(
        'TestProcess',
        { existingUser: existingUser }
      );

      var newUser = {
        type: 'Object',
        value: {
          name: 'Bert',
          age: 50
        },
        valueInfo: {
          serializationDataFormat: 'application/json',
          objectTypeName: 'my.example.Customer'
        }
      };

      workers = Workers(engineUrl);

      // when
      workers.registerWorker('work:A', [ 'existingUser' ], async function(context) {

        var existingUser = context.variables.existingUser;

        // expect deserialized user
        expect(existingUser).to.eql({
          name: 'Hugo'
        });

        // update
        existingUser.age = 31;

        return {
          variables: {
            // updated existing user
            existingUser,
            // serialized new user
            newUser: newUser
          }
        };
      });

      await delay(2);

      const newUserVar = await engineApi.getProcessVariable(id, 'newUser');

      var rawNewUser = extend({}, newUser, {
        value: JSON.stringify(newUser.value)
      });

      // then
      // expect saved new user
      expect(newUserVar).to.eql(rawNewUser);

      var existingUserVar = await engineApi.getProcessVariable(id, 'existingUser');

      var rawExistingUser = extend({}, newUser, {
        value: JSON.stringify({
          name: 'Hugo',
          age: 31
        })
      });

      // expect modified existing user
      expect(existingUserVar).to.eql(rawExistingUser);
    });

  });

});


// helpers ////////////////////

function noop(err) {

  if (err) {
    debug('callback error', err);
  }
}