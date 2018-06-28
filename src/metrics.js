'use strict';

var debug = require('debug')('worker:metrics');

/**
 * Periodically log worker utilization metrics.
 *
 * @example
 *
 * worker(engineEndpoint, {
 *   use: [
 *     Metrics
 *   ]
 * });
 */
function Metric(worker) {

  var tasksExecutedCount = 0;
  var pollCount = 0;

  var executionTime = 0;
  var pollTime = 0;
  var idleTime = 0;

  var activeTasks = 0;

  worker.on('executeTask', function() {
    activeTasks++;
  });

  worker.on('executeTask:done', function(task, durationMs) {
    tasksExecutedCount++;
    activeTasks--;
    executionTime += durationMs;
  });

  worker.on('poll', function() {
    pollCount++;
  });

  worker.on('poll:done', function(reason, durationMs) {
    pollTime += durationMs;
  });

  worker.on('reschedule', function(waitMs) {
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

  worker.on('start', () => {
    printStats();

    timer = setInterval(printStats, 5000);
  });

  worker.on('stop', () => {
    if (timer) {
      clearInterval(timer);
    }

    timer = null;
  });
}

module.exports = Metric;