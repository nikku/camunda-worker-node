var debug = require('debug')('workers:backoff');

var extend = require('xtend');

var defaultOptions = {
  maxPollingInterval: 30000,
  minPollingInterval: 0,
  stepping: 1.5
};

function parseOptions(options) {
  return extend({}, defaultOptions, options || {});
}

/**
 * A workers extension that adjusts the worker polling delay
 * based on availability of the Camunda REST api, fetched tasks
 * and poll times.
 *
 * @param {Workers} workers
 * @param {Object} options
 * @param {Number} [options.maxPollingInterval] maximum time (ms) to wait between polls
 * @param {Number} [options.minPollingInterval] minimum time (ms) to wait between polls
 * @param {Number} [options.stepping]
 */
function Backoff(workers, options) {

  const {
    maxPollingInterval,
    minPollingInterval,
    stepping
  } = parseOptions(options);

  const defaultPollingInterval = workers.options.pollingInterval;


  function updatePollingInterval(newInterval, reason) {

    // fence newInterval to [minPollingInterval, maxPollingInteral]
    newInterval = Math.min(
      maxPollingInterval,
      Math.max(
        minPollingInterval,
        newInterval
      )
    );

    var currentInterval = workers.options.pollingInterval;

    if (Math.abs(currentInterval - newInterval) < 100) {
      return;
    }

    workers.options.pollingInterval = newInterval;

    workers.emit(
      'backoff:updatePollingInterval',
      newInterval,
      currentInterval,
      reason
    );

    var mode = 'adjusting';

    if (newInterval === defaultPollingInterval) {
      mode = 'resetting';
    } else
    if (newInterval > currentInterval) {
      mode = 'increasing';
    } else {
      mode = 'decreasing';
    }

    debug(
      '%s pollingInterval [new=%s, old=%s, reason="%s"]',
      mode, newInterval, currentInterval, reason
    );
  }

  // backoff on fetch tasks failure

  workers.on('fetchTasks:failed', function() {

    var currentInterval = workers.options.pollingInterval;

    var newInterval =
      currentInterval === 0
        ? defaultPollingInterval :
        currentInterval * stepping;

    updatePollingInterval(newInterval, 'fetch tasks failed');
  });


  // restore on fetch task success,
  // set to minPollingInterval if maxTasks where fetched

  workers.on('fetchTasks:success', function(tasks) {
    const {
      pollingInterval,
      maxTasks
    } = workers.options;

    if (tasks.length === maxTasks) {
      return updatePollingInterval(minPollingInterval, 'max tasks fetched');
    }

    if (pollingInterval !== defaultPollingInterval) {
      return updatePollingInterval(defaultPollingInterval, 'fetch tasks success');
    }
  });


  // compensate for long execution times during polling
  workers.on('poll:done', function(reason, pollTime) {

    const {
      pollingInterval
    } = workers.options;

    return updatePollingInterval(
      pollingInterval - pollTime,
      'post poll adjustment'
    );
  });
}

module.exports = Backoff;