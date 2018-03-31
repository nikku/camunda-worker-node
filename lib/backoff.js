var debug = require('debug')('worker:backoff');

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
 * A worker extension that adjusts the worker polling delay
 * based on availability of the Camunda REST api, fetched tasks
 * and poll times.
 *
 * @example
 *
 * var worker = Worker(engineEndpoint, {
 *   use: [
 *     [ Backoff, { maxTasks: 40 } ]
 *   ]
 * });
 *
 * @param {Worker} worker
 * @param {Object} options
 * @param {Number} [options.maxPollingInterval=30000] maximum time (ms) to wait between polls
 * @param {Number} [options.minPollingInterval=0] minimum time (ms) to wait between polls
 * @param {Number} [options.maxActiveTasks=-1] maximum amout of active tasks to accept
 * @param {Number} [options.stepping]
 */
function Backoff(worker, options) {

  const {
    maxPollingInterval,
    minPollingInterval,
    maxActiveTasks,
    stepping
  } = parseOptions(options);

  const defaultPollingInterval = worker.options.pollingInterval;
  const defaultMaxTasks = worker.options.maxTasks;

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

    var currentInterval = worker.options.pollingInterval;

    if (Math.abs(currentInterval - newInterval) < 100) {
      return;
    }

    worker.configure({
      pollingInterval: newInterval
    });

    worker.emit(
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

    const currentMaxTasks = worker.options.maxTasks;

    if (newMaxTasks === currentMaxTasks) {
      return;
    }

    worker.configure({
      maxTasks: newMaxTasks
    });

    worker.emit(
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

  worker.on('fetchTasks:failed', function() {

    var currentInterval = worker.options.pollingInterval;

    var newInterval =
      currentInterval === 0
        ? defaultPollingInterval :
        currentInterval * stepping;

    updatePollingInterval(newInterval, 'fetchTasks failed');
  });


  // restore on fetch task success,
  // set to minPollingInterval if maxTasks where fetched

  worker.on('fetchTasks:success', function(tasks) {
    const {
      maxTasks
    } = worker.options;

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


  worker.on('executeTask', function() {

    if (maxActiveTasks === -1) {
      return;
    }

    if ((++activeTasks) === maxActiveTasks) {
      updateMaxTasks(0, 'maxActiveTasks reached');

      const {
        pollingInterval
      } = worker.options;

      if (pollingInterval !== defaultPollingInterval) {
        return updatePollingInterval(defaultPollingInterval, 'maxActiveTasks reached');
      }
    }
  });

  worker.on('executeTask:done', function() {

    if (maxActiveTasks === -1) {
      return;
    }

    if ((activeTasks--) === maxActiveTasks) {
      updateMaxTasks(defaultMaxTasks, 'maxActiveTasks underrun');

      updatePollingInterval(minPollingInterval, 'maxActiveTasks underrun');
    }
  });

  // compensate for long polling times
  worker.on('poll:done', function(reason, pollTime) {

    const {
      pollingInterval
    } = worker.options;

    return updatePollingInterval(
      pollingInterval - pollTime,
      'post poll adjustment'
    );
  });
}

module.exports = Backoff;