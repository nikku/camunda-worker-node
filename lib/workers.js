var extend = require('xtend');

var forEach = require('foreach');

var EngineApi = require('./engine/api');

var Emitter = require('events');

var uuid = require('uuid');

var inherits = require('inherits');


var defaultOptions = {
  pollingDelay: 0,
  pollingInterval: 1500,
  lockTimeMs: 4000
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

  function registerWorker(data) {

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

  this.provide = function(topicName, variableNames, fn) {

    var data = {
      topicName: topicName,
      variableNames: variableNames,
      fn: fn
    };

    return registerWorker(data);
  };

  function poll() {

    forEach(workers, function(definition) {

      emit('poll');

      engineApi.poll({
        topicName: definition.topicName,
        consumerId: consumerId,
        lockTimeInSeconds: options.lockTimeMs / 1000,
        variableNames: definition.variableNames,
        maxTasks: 2
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

          workerDefinition.fn(task, function(err, variables) {

            var completionBody = {
              variables: engineApi.serializeVariables(variables || {}),
              consumerId: consumerId
            };

            emit('task.complete', task, variables);

            engineApi.complete(task.id, completionBody, function(err) {
              if (err) {
                return error('failed to complete task', err);
              }
            });

          });

        });
      });
    });
  }

  this.poll = poll;

  this.destroy = function() {
    emit('destroy', consumerId);

    clearInterval(pollingTimer);
  };


  function start() {
    emit('start', consumerId);

    pollingTimer = setInterval(poll, options.pollingInterval);
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