
/**
 * Enable detailed task worker logging.
 */
function Logger(workers) {

  workers.on('start', function(consumerId) {
    console.log('[workers] starting', consumerId);
  });

  workers.on('err', function(error) {
    console.error('[workers] error', error);
  });

  workers.on('poll', function(topics) {
    console.log('[workers] polling', topics);
  });

  workers.on('poll:error', function(error) {
    console.log('[workers] polling error', error);
  });

  workers.on('poll:success', function(tasks) {
    console.log('[workers] polling success', tasks);
  });

  workers.on('poll:complete', function() {
    console.log('[workers] polling complete');
  });

  workers.on('worker:register', function(worker) {
    console.log('[workers] register', worker);
  });

  workers.on('worker:remove', function(worker) {
    console.log('[workers] removing', worker);
  });

  workers.on('task:failed', function(task, err) {
    console.log('[workers] task failed', task, err);
  });

  workers.on('task:failed:sent', function(task) {
    console.log('[workers] task failed sent', task);
  });

  workers.on('task:complete', function(task, newVariables) {
    console.log('[workers] task complete', task, newVariables);
  });

  workers.on('task:complete:sent', function(task) {
    console.log('[workers] task complete sent', task);
  });

}

module.exports = Logger;