var debug = require('debug')('workers:backoff');

var extend = require('xtend');

var defaultOptions = {
  maxPollingInterval: 30000,
  minPollingInterval: 0,
  maxActiveTasks: -1,
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
 * @example
 *
 * var workers = Workers(engineEndpoint, {
 *   use: [
 *     [ Backoff, { maxTasks: 40 } ]
 *   ]
 * });
 *
 * @param {Workers} workers
 * @param {Object} options
 * @param {Number} [options.maxPollingInterval=30000] maximum time (ms) to wait between polls
 * @param {Number} [options.minPollingInterval=0] minimum time (ms) to wait between polls
 * @param {Number} [options.maxActiveTasks=-1] maximum amout of active tasks to accept
 * @param {Number} [options.stepping]
 */
function Backoff(workers, options) {

  const {
    maxPollingInterval,
    minPollingInterval,
    maxActiveTasks,
    stepping
  } = parseOptions(options);

  const defaultPollingInterval = workers.options.pollingInterval;
  const defaultMaxTasks = workers.options.maxTasks;

  let activeTasks = 0;


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

    workers.configure({
      pollingInterval: newInterval
    });

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


  function updateMaxTasks(newMaxTasks, reason) {

    const currentMaxTasks = workers.options.maxTasks;

    if (newMaxTasks === currentMaxTasks) {
      return;
    }

    workers.configure({
      maxTasks: newMaxTasks
    });

    workers.emit(
      'backoff:updateMaxTasks',
      newMaxTasks,
      currentMaxTasks,
      reason
    );

    debug(
      'setting maxTasks [new=%s, old=%s, active=%s, reason="%s"]',
      newMaxTasks, currentMaxTasks, activeTasks, reason
    );
  }

  // backoff on fetch tasks failure

  workers.on('fetchTasks:failed', function() {

    var currentInterval = workers.options.pollingInterval;

    var newInterval =
      currentInterval === 0
        ? defaultPollingInterval :
        currentInterval * stepping;

    updatePollingInterval(newInterval, 'fetchTasks failed');
  });


  // restore on fetch task success,
  // set to minPollingInterval if maxTasks where fetched

  workers.on('fetchTasks:success', function(tasks) {
    const {
      maxTasks
    } = workers.options;

    if (maxTasks !== 0) {

      if (tasks.length >= maxTasks) {
        // not all tasks have been fetched, retry ASAP
        return updatePollingInterval(minPollingInterval, 'maxTasks fetched');
      } else {
        // all available tasks got fetched; retry with defaul interval
        return updatePollingInterval(defaultPollingInterval, 'less than maxTasks fetched');
      }
    }
  });


  workers.on('executeTask', function() {

    if (maxActiveTasks === -1) {
      return;
    }

    if ((++activeTasks) === maxActiveTasks) {
      updateMaxTasks(0, 'maxActiveTasks reached');

      const {
        pollingInterval
      } = workers.options;

      if (pollingInterval !== defaultPollingInterval) {
        return updatePollingInterval(defaultPollingInterval, 'maxActiveTasks reached');
      }
    }
  });

  workers.on('executeTask:done', function() {

    if (maxActiveTasks === -1) {
      return;
    }

    if ((activeTasks--) === maxActiveTasks) {
      updateMaxTasks(defaultMaxTasks, 'maxActiveTasks underrun');

      updatePollingInterval(minPollingInterval, 'maxActiveTasks underrun');
    }
  });

  // compensate for long polling times
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