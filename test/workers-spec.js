var expect = require('chai').expect;

var extend = require('xtend');

var Worker = require('../');

var Logger = require('../lib/logger');
var Backoff = require('../lib/backoff');
var ManualSerialization = require('../lib/manual-serialization');

var EngineApi = require('./engine/api');

var debug = require('debug')('worker-spec');

var {
  delay
} = require('./helper');


describe('worker', function() {

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


  function createWorker(options = {}) {

    options = Object.assign({
      autoPoll: false,
      pollingInterval: 500,
      use: [
        Logger,
        Backoff
      ]
    }, options || {});

    return Worker(engineUrl, options);
  }


  describe('configuration', function() {

    it('should fail configuring pollingDelay', function() {

      // when
      function create() {
        Worker(engineUrl, {
          pollingDelay: -1
        });
      }

      // then
      expect(create).to.throw;
    });


    it('should configure workerId', function() {

      // given
      worker = createWorker({
        workerId: 'FOO'
      });

      // then
      expect(worker.options.workerId).to.eql('FOO');
    });


    it('should re-configure via #configure', function() {

      // given
      worker = createWorker();

      // when
      worker.configure({ maxTasks: 1000 });

      // then
      expect(worker.options.maxTasks).to.eql(1000);
    });


    describe('should extend via [use]', function() {

      it('without options', function() {

        // given
        var called;

        function Extension(worker, opts) {
          called = [ worker, opts ];
        }

        // when
        worker = Worker(engineUrl, {
          use: [ Extension ]
        });

        // then
        expect(called).to.eql([ worker, {} ]);
      });


      it('with options', function() {

        // given
        var called;

        function Extension(worker, opts) {
          called = [ worker, opts ];
        }

        // when
        worker = Worker(engineUrl, {
          use: [
            [ Extension, { foo: 'BAR' } ]
          ]
        });

        // then
        expect(called).to.eql([
          worker,
          { foo: 'BAR' }
        ]);
      });


      it('failing on malformed', function() {

        // when
        expect(function() {
          Worker(engineUrl, {
            use: [
              { foo: 'BAR' }
            ]
          });
        }).to.throw('extension must be <function> or <[ function, opts ]>');

      });

    });

  });


  describe('work subscription', function() {

    it('should subscribe with default options', function() {

      // given
      worker = createWorker();

      // when
      var workerDefinition = worker.subscribe('worker:Stuff', noop);

      // then
      expect(workerDefinition.variables).not.to.exist;
      expect(workerDefinition.lockDuration).to.eql(10000);
    });


    it('should fail subscribeing with lockTime option', function() {

      // given
      worker = createWorker();

      // when
      function subscribe() {
        worker.subscribe('worker:Stuff', { lockTime: 1000 }, noop);
      }

      // then
      expect(subscribe).to.throw;
    });


    it('should subscribe with global lockDuration', function() {

      // given
      worker = createWorker({
        lockDuration: 3000
      });

      // when
      var workerDefinition = worker.subscribe('worker:Stuff', noop);

      // then
      expect(workerDefinition.lockDuration).to.eql(3000);
    });


    it('should subscribe with local options', function() {

      // given
      worker = createWorker();

      // when
      var workerDefinition = worker.subscribe('worker:Stuff', {
        lockDuration: 3000,
        variables: [ 'foo' ]
      }, noop);

      // then
      expect(workerDefinition.variables).to.eql([ 'foo' ]);
      expect(workerDefinition.lockDuration).to.eql(3000);

      expect(function() {
        workerDefinition.remove();
      }).not.to.throw;

    });


    it('should subscribe with variables', function() {

      // given
      worker = createWorker();

      // when
      var workerDefinition = worker.subscribe('worker:Stuff', [ 'a', 'b' ], noop);

      // then
      expect(workerDefinition.variables).to.eql([ 'a', 'b' ]);
      expect(workerDefinition.lockDuration).to.eql(10000);
    });


    it('should allow single worker per topic name only', function() {

      // given
      worker = createWorker();

      worker.subscribe('worker:Stuff', [ 'a', 'b' ], noop);

      // then
      expect(function() {
        // when
        worker.subscribe('worker:Stuff', [ 'a', 'b' ], noop);
      }).to.throw('subscription for <worker:Stuff> already registered');
    });


    it('should subscribe via legacy API', function() {

      // given
      worker = createWorker();

      // when
      // calling
      var workerDefinition = worker.registerWorker('worker:Stuff', noop);

      // then
      expect(workerDefinition.variables).not.to.exist;
      expect(workerDefinition.lockDuration).to.eql(10000);
    });

  });


  describe('worker removal', function() {

    it('should remove worker', function() {

      // given
      worker = createWorker();

      // when
      var workerDefinition = worker.subscribe('worker:Stuff', [ 'a', 'b' ], noop);

      // then
      expect(workerDefinition.remove).to.exist;

      expect(function() {
        workerDefinition.remove();
      }).not.to.throw;
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

      worker = createWorker({
        autoPoll: true
      });

      // when
      worker.subscribe('work:A', async function(context) {

        // then
        expect(context.topicName).to.eql('work:A');
        expect(context.workerId).to.eql(worker.options.workerId);

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
          booleanVar: true,
          dateVar: dateVar
        });

        worker = createWorker({
          autoPoll: true
        });

        // when
        worker.subscribe('work:A', async function(context) {

          // then
          // fetching all variables
          expect(context.variables).to.eql({
            numberVar: 1,
            objectVar: {
              name: 'Walter'
            },
            booleanVar: true,
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

        worker = createWorker({
          autoPoll: true
        });

        // when
        worker.subscribe('work:A', [ 'numberVar' ], async function(context) {

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

      worker = createWorker({
        autoPoll: true
      });

      worker.subscribe('work:A', async function(context) {
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

      worker = createWorker({
        autoPoll: true
      });

      // when
      // (1) callback style worker
      worker.subscribe('work:A', [
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
            booleanVar: false,
            stringVar: 'BAR',
            nestedObjectVar: nestedObjectVar
          }
        });
      });

      // (2) promise based worker
      worker.subscribe('work:B', [
        'booleanVar',
        'nestedObjectVar',
        'stringVar'
      ], function(context) {

        trace.push(log(context));

        expect(context.variables).to.eql({
          booleanVar: false,
          nestedObjectVar: nestedObjectVar,
          stringVar: 'BAR'
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

      worker = createWorker({
        autoPoll: true,
        use: [ Logger ]
      });

      // when
      // (1) callback style worker
      worker.subscribe('work:A', [
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
      worker.subscribe('work:B', [
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


    it('should NOT block polling', async function() {

      // given
      var pollTrace = [];

      worker = createWorker({
        autoPoll: true
      });

      worker.on('poll', function() {
        pollTrace.push(true);
      });

      worker.subscribe('work:A', async function(context) {
        pollTrace.push('work:A');

        await delay(2);
      });

      // when
      await engineApi.startProcessByKey('TestProcess');

      await delay(2);

      // then
      expect(pollTrace.length).to.be.above(1);
    });


    describe('should extend lock', function() {

      it('callback style', function(done) {

        // given
        engineApi.startProcessByKey('TestProcess', {});

        // when
        worker = createWorker({
          autoPoll: true
        });

        worker.subscribe('work:A', function(context, callback) {

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
        worker = createWorker({
          autoPoll: true
        });

        worker.subscribe('work:A', [ 'numberVar' ], async function(context) {

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

        worker = createWorker({
          autoPoll: true
        });

        // when
        worker.subscribe('work:A', function(context, callback) {
          callback(new Error('could not execute'));
        });

        await delay(1);

        // then
        var workerId = worker.options.workerId;

        const log = await engineApi.getWorkerLog(workerId);

        expect(log).to.have.length(1);
        expect(log[0].errorMessage).to.eql('could not execute');
      });


      it('promise rejection', async function() {

        // given
        await engineApi.startProcessByKey('TestProcess');

        worker = createWorker({
          autoPoll: true
        });

        // when
        worker.subscribe('work:A', function(context) {
          return Promise.reject(
            new Error('could not execute')
          );
        });

        await delay(1);

        // then
        var workerId = worker.options.workerId;

        const log = await engineApi.getWorkerLog(workerId);

        expect(log).to.have.length(1);
        expect(log[0].errorMessage).to.eql('could not execute');
      });


      it('async function throw', async function() {

        // given
        await engineApi.startProcessByKey('TestProcess');

        worker = createWorker({
          autoPoll: true
        });

        // when
        worker.subscribe('work:A', async function(context) {
          throw new Error('could not execute');
        });

        await delay(1);

        // then
        var workerId = worker.options.workerId;

        const log = await engineApi.getWorkerLog(workerId);

        expect(log).to.have.length(1);
        expect(log[0].errorMessage).to.eql('could not execute');
      });


      it('synchronously thrown', async function() {

        // given
        await engineApi.startProcessByKey('TestProcess');

        worker = createWorker({
          autoPoll: true
        });

        // when
        worker.subscribe('work:A', function(context, callback) {
          throw new Error('could not execute');
        });

        await delay(1);

        // then
        var workerId = worker.options.workerId;

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

      worker = createWorker({
        autoPoll: true
      });

      // when
      worker.subscribe('work:A', async function(context) {
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


  describe('variable serialization', function() {

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

      worker = createWorker({
        autoPoll: true
      });

      // when
      worker.subscribe('work:A', [ 'existingUser' ], async function(context) {

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

    it('should allow custom serialization options', async function() {
      const {
        id
      } = await engineApi.startProcessByKey(
        'TestProcess'
      );

      // given
      var newUser = {
        type: 'Object',
        value: '"hello world"',
        valueInfo: {
          serializationDataFormat: 'application/json',
          objectTypeName: 'java.lang.String'
        }
      };

      worker = createWorker({
        autoPoll: true
      });

      // when
      worker.subscribe('work:A', [], async function(context) {

        return {
          variables: {
            // newly serialized user
            newUser: new ManualSerialization(newUser)
          }
        };
      });

      await delay(2);

      const newUserVar = await engineApi.getProcessVariable(id, 'newUser');

      // then
      // expect saved new user
      expect(newUserVar).to.eql({
        type: 'Object',
        value: '"hello world"',
        valueInfo: {
          serializationDataFormat: 'application/json',
          objectTypeName: 'java.lang.String'
        }
      });
    });

  });


  describe('polling', function() {

    it('should not fetch tasks if maxTasks === 0', async function() {

      // given
      worker = createWorker({
        autoPoll: false,
        maxTasks: 0
      });

      worker.subscribe('topic:A', () => { });

      // protect multi-poll API
      worker.engineApi.multiPoll = async function() {
        throw new Error('unexpected call');
      };

      worker.on('poll:done', function(reason) {

        // then
        expect(reason).to.eql('no-tasks');
      });

      // when
      await worker.poll();
    });

  });


  describe('life-cycle', function() {

    it('should start/stop manually', async function() {

      var pollTrace = [];

      // when
      // create with autoPoll=false
      worker = createWorker({
        autoPoll: false
      });

      worker.poll = function() {
        pollTrace.push('POLL');

        return Promise.resolve();
      };

      await delay(.5);

      // then
      expect(pollTrace).to.be.empty;

      // when
      // starting worker instance
      worker.start();

      await delay(.5);

      // then
      expect(pollTrace).to.have.length(1);

      // when
      // stopping worker instance
      worker.stop();

      // ...should be indempotent
      worker.stop();


      await delay(.5);

      // then
      expect(pollTrace).to.have.length(1);

      // when
      // re-starting worker instance
      worker.start();

      // ...should be indempotent
      worker.start();

      await delay(.5);

      // then
      // only one additional poll got scheduled
      expect(pollTrace).to.have.length(2);
    });


    it('should throw on #shutdown', async function() {

      // given
      worker = createWorker({
        autoPoll: false
      });

      let err;

      // when
      try {
        await worker.shutdown();
      } catch (e) {
        err = e;
      }

      // then
      expect(err).to.exist;
    });

  });

});


// helpers ////////////////////

function noop(err) {

  if (err) {
    debug('callback error', err);
  }
}