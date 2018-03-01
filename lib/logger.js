'use strict';

var debug = require('debug')('workers:logger');

/**
 * Enable detailed task worker logging.
 */
function Logger(workers) {

  workers.on('start', function(consumerId) {
    debug('starting', consumerId);
  });

  workers.on('err', function(error) {
    console.error('[workers] error', error);
  });

  workers.on('poll', function(topics) {
    debug('polling', topics);
  });

  workers.on('poll:error', function(error) {
    debug('polling error', error);
  });

  workers.on('poll:success', function(tasks) {
    debug('polling success', tasks);
  });

  workers.on('poll:complete', function() {
    debug('polling complete');
  });

  workers.on('worker:register', function(worker) {
    debug('registered worker', worker);
  });

  workers.on('worker:remove', function(worker) {
    debug('removed worker', worker);
  });

  workers.on('task:failed', function(task, err) {
    debug('task failed', task, err);
  });

  workers.on('task:failed:sent', function(task) {
    debug('task failed sent', task);
  });

  workers.on('task:complete', function(task, newVariables) {
    debug('task complete', task, newVariables);
  });

  workers.on('task:complete:sent', function(task) {
    debug('task complete sent', task);
  });

}

module.exports = Logger;