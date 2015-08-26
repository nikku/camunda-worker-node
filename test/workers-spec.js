var fs = require('fs');

var Workers = require('../');

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

  var engineUrl = 'http://localhost:8080/engine-rest';

  var engineApi = new EngineApi(engineUrl);


  var workers, deployment;

  before(function(done) {

    var inputStream = fs.createReadStream(__dirname + '/process.bpmn');

    engineApi.deploy(inputStream, function(err, newDeployment) {

      if (err) {
        return done(err);
      }

      deployment = newDeployment;

      done();
    });

  });


  after(function(done) {

    if (workers) {
      workers.destroy();
    }

    if (deployment) {
      engineApi.undeploy(deployment, done);
    }
  });


  it('should execute worker provided tasks', function(done) {

    // jop, slow test...
    this.timeout(5000);

    var trace = [];


    workers = Workers(engineUrl);

    workers.provide('work:A', [ 'foo', 'bar' ], function(context, callback) {

      expect(context.id).to.exist;
      expect(context.topicName).to.exist;
      expect(context.lockTime).to.exist;
      expect(context.activityId).to.exist;
      expect(context.activityInstanceId).to.exist;
      expect(context.processInstanceId).to.exist;

//      expect(context.variables.other).not.to.exist;
//      expect(context.variables.foo).to.eql(1);
//      expect(context.variables.bar).to.eql({ name: 'Walter' });

      callback(null, {
        variables: {
          'newFoo': 'BAR'
        }
      });

      trace.push(log('work:A', context));
    });


    workers.provide('work:B', [ 'newFoo' ], function(context, callback) {
//      expect(context.variables.newFoo).to.eql('BAR');

      trace.push(log('work:B', context));

      callback(null);
    });


    var startVariables = {
      foo: 1,
      bar: { name: 'Walter' }
    };


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