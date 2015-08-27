var extend = require('xtend');

var forEach = require('foreach');

var EngineApi = require('./engine/api');

var Emitter = require('events');

var uuid = require('uuid');

var inherits = require('inherits');


var defaultOptions = {
  pollingDelay: 500,
  pollingInterval: 1500
};

var defaultWorkerOptions = {
  lockTime: 10000,
  variableNames: []
};


/**
 * A worker registration instance.
 *
 * Use `workerRegistration.remove()` to remove it.
 */
function WorkerRegistration() { }


/**
 * Create a workers implementation.
 *
 * @param {String} baseUrl
 */
function Workers(baseUrl, options) {

  if (!(this instanceof Workers)) {
    return new Workers(baseUrl);
  }

  // inheritance
  Emitter.call(this);


  options = extend({}, defaultOptions, options || {});

  var engineApi = new EngineApi(baseUrl);

  var pollingTimer;

  var consumerId = options.consumerId || uuid.v4();

  var workers = {};

  var emit = this.emit.bind(this);

  function error(msg, err) {
    emit('error', msg, err);
  }

  function addWorker(data) {

    var registration = extend(new WorkerRegistration(), data);

    var topicName = data.topicName;

    emit('worker.register', this);

    workers[topicName] = registration;

    /**
     * Remove the worker registration
     */
    registration.remove = function() {
      if (workers[topicName] === this) {
        emit('worker.remove', this);

        delete workers[topicName];
      }
    };

    return registration;
  }

  /**
   * Register a new worker for the given topic name.
   *
   * @param {String} topicName
   * @param {Object|Array<String>} options
   * @param {Function} fn
   *
   * @return {WorkerDefinition}
   */
  this.registerWorker = function(topicName, options, fn) {

    if (typeof options === 'function') {
      fn = options;
      options = {};
    }

    if (options.length) {
      options = {
        variableNames: options
      };
    }

    var data = extend({}, defaultWorkerOptions, options, {
      topicName: topicName,
      fn: fn
    });

    return addWorker(data);
  };

  function poll() {

    var topics = [];

    forEach(workers, function(definition) {

      topics.push({
        topicName: definition.topicName,
        variableNames: definition.variableNames,
        lockTimeInSeconds: definition.lockTime / 1000
     });
    });

    if (!topics.length) {
      return;
    }

    emit('poll', topics);

    engineApi.multiPoll({
      consumerId: consumerId,
      maxTasks: 2,
      topics: topics
    }, function(err, result) {

      if (err) {
        return error('failed to poll', err);
      }


      result.tasks.forEach(function(task) {

        var workerDefinition = workers[task.topicName];

        // may have been removed in the mean time;
        // simply let the execution time out
        if (!workerDefinition) {
          return;
        }

        var variables = task.variables;

        var deserializedVariables = engineApi.deserializeVariables(variables);

        var taskContext = extend({}, task, { variables: deserializedVariables });


        workerDefinition.fn(taskContext, function(err, newContext) {

          var newVariables = newContext && newContext.variables || {};

          var body;

          if (err) {

            emit('task.failed', task, err);

            body = {
              consumerId: consumerId,
              errorMessage: err.message
            };

            engineApi.taskFailed(task.id, body, function(err) {
              if (err) {
                return error('failed to mark task as failed', err);
              }
            });
          } else {

            emit('task.completed', task, newVariables);

            body = {
              consumerId: consumerId,
              variables: engineApi.serializeVariables(newVariables, variables)
            };

            engineApi.taskCompleted(task.id, body, function(err) {
              if (err) {
                return error('failed to mark task as completed', err);
              }
            });

          }

        });

      });

    });

  }

  this.poll = poll;

  /**
   * Gracefully shut down the workers instance,
   * stopping continuous polling.
   *
   * @param {Function} [callback]
   */
  this.shutdown = function(callback) {
    emit('shutdown', consumerId);

    clearInterval(pollingTimer);

    if (callback) {
      callback();
    }
  };


  function start() {
    emit('start', consumerId);

    pollingTimer = setInterval(poll, options.pollingInterval);

    poll();
  }

  this.start = start;

  // disable auto-start by setting polling delay to -1
  if (options.pollingDelay !== -1) {
    // delay start by pollingDelay + random value
    setTimeout(start, options.pollingDelay + (options.pollingDelay * Math.random()));
  }
}

inherits(Workers, Emitter);

module.exports = Workers;