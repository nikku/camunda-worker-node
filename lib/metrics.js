'use strict';

var debug = require('debug')('workers:metrics');

/**
 * Periodically log workers utilization metrics.
 *
 * @example
 *
 * Workers(engineEndpoint, {
 *   use: [
 *     Metrics
 *   ]
 * });
 */
function Metric(workers) {

  var tasksExecutedCount = 0;
  var pollCount = 0;

  var executionTime = 0;
  var pollTime = 0;
  var idleTime = 0;

  var activeTasks = 0;

  workers.on('executeTask', function() {
    activeTasks++;
  });

  workers.on('executeTask:done', function(task, durationMs) {
    tasksExecutedCount++;
    activeTasks--;
    executionTime += durationMs;
  });

  workers.on('poll', function() {
    pollCount++;
  });

  workers.on('poll:done', function(reason, durationMs) {
    pollTime += durationMs;
  });

  workers.on('reschedule', function(waitMs) {
    idleTime += waitMs;
  });


  function printStats() {
    debug('stats', {
      executionTime,
      pollTime,
      idleTime,
      pollCount,
      tasksExecutedCount,
      activeTasks
    });

    executionTime = 0;
    pollTime = 0;
    idleTime = 0;
    pollCount = 0;
    tasksExecutedCount = 0;
  }

  var timer;

  workers.on('start', () => {
    printStats();

    timer = setInterval(printStats, 5000);
  });

  workers.on('stop', () => {
    if (timer) {
      clearInterval(timer);
    }

    timer = null;
  });
}

module.exports = Metric;