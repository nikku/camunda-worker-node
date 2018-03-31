'use strict';

var forEach = require('foreach');

var debug = require('debug')('worker:logger');

/**
 * Enable detailed task worker logging.
 *
 * @example
 *
 * var worker = Worker(engineEndpoint, {
 *   use: [
 *     Logger
 *   ]
 * });
 */
function Logger(worker) {

  forEach([
    'start',
    'stop',
    'reschedule',
    'error',
    'poll',
    'poll:done',
    'poll:error',
    'fetchTasks',
    'fetchTasks:failed',
    'fetchTasks:success',
    'worker:register',
    'worker:remove',
    'executeTask',
    'executeTask:complete',
    'executeTask:complete:sent',
    'executeTask:failed',
    'executeTask:failed:sent',
    'executeTask:done',
    'executeTask:skip',
    'executeTasks',
    'executeTasks:done',
    'extendLock',
    'extendLock:success',
    'extendLock:failed',
  ], function(event) {

    worker.on(event, function(...args) {
      debug(event, ...args);
    });
  });

}

module.exports = Logger;