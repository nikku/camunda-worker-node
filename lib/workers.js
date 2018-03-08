var extend = require('xtend');

var forEach = require('foreach');

var EngineApi = require('./engine/api');

var Emitter = require('events');

var uuid = require('uuid');

var debug = require('debug')('workers');

var inherits = require('inherits');

var STATE_NEW = 'NEW';
var STATE_RUNNING = 'RUNNING';
var STATE_STOPPED = 'STOPPED';

var defaultOptions = {
  pollingDelay: 500,
  pollingInterval: 1500,
  maxTasks: 2
};

var defaultWorkerOptions = {
  lockTime: 10000
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
function Workers(baseUrl, opts) {

  if (!(this instanceof Workers)) {
    return new Workers(baseUrl, opts);
  }

  // inheritance
  Emitter.call(this);

  this.options = parseOptions(opts);

  this.workers = {};

  this.state = STATE_NEW;

  // apply extensions
  if (this.options.use) {
    this.extend(this.options.use);
  }

  // local variables
  this.engineApi = new EngineApi(
    baseUrl,
    this.options.requestOptions,
    this.options.apiVersion
  );

  // start
  if (this.options.pollingDelay !== -1) {
    this.start();
  }
}

inherits(Workers, Emitter);

module.exports = Workers;


/**
 * Extend workers with additional functionality.
 *
 * Each extension is a function that is called
 * with the worker instance + its own (optional)
 * parameters.
 *
 * Specify extensions when instantiating the
 * workers instance via the `use` config entry:
 *
 * ```javascript
 * Workers(..., {
 *   use: [
 *     Logging,
 *     [Backoff, backoffConfig ]
 *   ]
 * });
 * ```
 *
 * @param  {Array<Function|Array>} extensions
 */
Workers.prototype.extend = function(extensions) {

  extensions = extensions || [];

  forEach(extensions, (extension) => {

    var opts = {},
        fn = extension;

    if (Array.isArray(extension)) {
      fn = extension[0];
      opts = extension[1];
    }

    if (typeof fn !== 'function') {
      throw new Error('extension must be <function> or <[ function, opts ]>');
    }

    fn(this, opts);
  });
};


/**
 * Propagate an error
 *
 * @param  {String} msg
 * @param  {Error} err
 */
Workers.prototype.error = function(msg, err) {
  debug('error %s', msg, err);

  this.emit('error', msg, err);
};

/**
 * Add worker
 *
 * @param {Object} data
 */
Workers.prototype.addWorker = function(data) {

  var topicName = data.topicName;

  if (this.workers[topicName]) {
    throw new Error(`worker for <${topicName}> already registered`);
  }

  var worker = extend(new WorkerRegistration(), data);

  debug('add worker [topicName=%s]', topicName);

  this.emit('worker:register', worker);

  this.workers[topicName] = worker;

  /**
   * Remove the worker worker
   */
  worker.remove = () => {
    this.removeWorker(worker);
  };

  return worker;
};

Workers.prototype.removeWorker = function(worker) {

  const topicName = worker.topicName;

  if (this.workers[topicName] !== worker) {
    return;
  }

  debug('remove worker [topicName=%s]', topicName);

  this.emit('worker:remove', worker);

  delete this.workers[topicName];
};

/**
 * Register a new worker for the given topic name.
 *
 * @param {String} topicName
 * @param {Object|Array<String>} options
 * @param {Function} fn
 *
 * @return {WorkerRegistration}
 */
Workers.prototype.registerWorker = function(topicName, options, fn) {

  if (typeof options === 'function') {
    fn = options;
    options = {};
  }

  if (options.length) {
    options = {
      variables: options
    };
  }

  var data = extend({}, defaultWorkerOptions, options, {
    topicName: topicName,
    fn: wrapFn(fn)
  });

  return this.addWorker(data);
};


/**
 * Poll to see if new work needs to be done.
 */
Workers.prototype.poll = async function() {

  const t = now();

  this.emit('poll');

  try {
    var topics = map(this.workers, function(definition) {
      return {
        topicName: definition.topicName,
        variables: definition.variables,
        lockDuration: definition.lockTime
      };
    });

    if (!topics.length) {
      this.emit('poll:done', 'no-topics', now() - t);

      return;
    }

    let tasks = await this.fetchTasks(topics);

    if (!tasks.length) {
      this.emit('poll:done', 'no-tasks', now() - t);

      return;
    }

    // execute task asynchronously
    this.executeTasks(tasks);

  } catch (err) {
    this.emit('poll:error', err);
  }

  this.emit('poll:done', 'processed', now() - t);
};

Workers.prototype.fetchTasks = async function(topics) {

  var {
    workerId,
    maxTasks
  } = this.options;

  if (maxTasks < 1) {
    this.emit('fetchTasks:skip', 'maxTasks == 0');

    return [];
  }

  this.emit('fetchTasks', topics);

  let tasks = [];

  try {
    tasks = await this.engineApi.multiPoll({
      workerId,
      maxTasks,
      topics
    });

    this.emit('fetchTasks:success', tasks);
  } catch (err) {
    this.emit('fetchTasks:failed', err);
  }

  return tasks;
};


Workers.prototype.executeTasks = async function(tasks) {

  var t = now();

  this.emit('executeTasks');

  await Promise.all(
    tasks.map(
      task => this.executeTask(task)
    )
  );

  this.emit('executeTasks:done', now() - t);
};

/**
 * Execute a task
 *
 * @param {Object} task
 */
Workers.prototype.executeTask = async function(task) {

  var workerDefinition = this.workers[task.topicName];

  // may have been removed in the mean time;
  // simply let the execution time out
  if (!workerDefinition) {
    this.emit('executeTask:skip', task, 'missing-worker');

    // TODO(nikku): mark fetched task as failed
    // if respective worker does not exist anymore
    return;
  }

  var workerId = this.options.workerId;
  var taskId = task.id;

  var taskContext = this.createTaskContext(task);

  var t = now();

  this.emit('executeTask', task);

  try {

    const newContext = await workerDefinition.fn(taskContext);

    try {
      this.emit('executeTask:complete', task, newContext);

      await this.completeTask(task, newContext);

      this.emit('executeTask:complete:sent', task);
    } catch (err) {
      this.error('failed to mark task as completed', err);
    }
  } catch (err) {
    this.emit('executeTask:failed', task, err);

    try {
      await this.engineApi.taskFailed(taskId, {
        workerId,
        errorMessage: err.message
      });

      this.emit('executeTask:failed:sent', task);
    } catch (err) {
      this.error('failed to mark task as failed', err);
    }
  }

  this.emit('executeTask:done', task, now() - t);
};

Workers.prototype.createTaskContext = function(task) {

  var taskVariables = task.variables || {};

  var deserializedVariables = this.engineApi.deserializeVariables(
    taskVariables
  );

  var extendLock = (newDuration, callback) => {

    var promise = this.extendLock(task, newDuration);

    if (isFunction(callback)) {
      // callback style invocation
      return promise.then(
        r => callback(null, r),
        callback
      );
    } else {
      // promise based invocation
      return promise;
    }
  };

  return extend({}, task, {
    variables: deserializedVariables,
    extendLock
  });
};

/**
 * Notify completion of the given task.
 *
 * @param {Task} task
 * @param {Object} newContext
 *
 * @return {Promise<Void>}
 */
Workers.prototype.completeTask = async function(task, newContext = {}) {

  const taskId = task.id;
  const workerId = this.options.workerId;

  const newVariables = newContext.variables || {};
  const errorCode = newContext.errorCode;

  if (errorCode) {
    await this.engineApi.bpmnError(taskId, {
      workerId,
      errorCode
    });
  } else {
    await this.engineApi.taskCompleted(taskId, {
      workerId,
      variables: this.engineApi.serializeVariables(
        newVariables,
        task.variables
      )
    });
  }
};


/**
 * Reconfigure the instance with the given options.
 *
 * @param {Object} newOptions to be merged with existing ones
 */
Workers.prototype.configure = function(newOptions) {

  this.options = {
    ...this.options,
    ...newOptions
  };
};


/**
 * Gracefully shut down the workers instance,
 * stopping continuous polling.
 *
 * @return {Promise}
 */
Workers.prototype.shutdown = async function() {

  // not running; ignore
  if (this.state !== STATE_RUNNING) {
    return;
  }

  var workerId = this.options.workerId;

  this.state = STATE_STOPPED;

  debug('shutdown [workerId=%s]', workerId);

  this.emit('shutdown', workerId);
};

/**
 * Start workers instance.
 */
Workers.prototype.start = function() {

  if (this.state === STATE_RUNNING) {
    throw new Error('already started');
  }

  var {
    workerId,
    pollingDelay
  } = this.options;

  var schedulePoll = () => {

    var {
      pollingInterval
    } = this.options;

    this.reschedule(pollingInterval);
  };

  var stopPolling = () => {
    this.removeListener('poll:done', schedulePoll);
  };

  this.on('shutdown', stopPolling);
  this.on('poll:done', schedulePoll);

  this.state = STATE_RUNNING;

  this.emit('start', workerId);

  debug('start [workerId=%s]', workerId);

  this.reschedule(pollingDelay);
};

/**
 * Extend lock on the given task.
 *
 * @param {Object} task
 * @param {Number} newDuration
 *
 * @return {Promise<Void>}
 */
Workers.prototype.extendLock = async function(task, newDuration) {
  this.emit('extendLock', task, newDuration);

  try {
    await this.engineApi.extendLock(task.id, {
      workerId: this.options.workerId,
      newDuration: newDuration
    });

    this.emit('extendLock:success', task, newDuration);
  } catch (err) {
    this.emit('extendLock:failed', task, newDuration, err);
    throw err;
  }
};

/**
 * Reschedule polling after a given delay.
 *
 * @param {Number} waitMs
 *
 * @return {Promise<Void>}
 */
Workers.prototype.reschedule = async function(waitMs) {

  this.emit('reschedule', waitMs);

  await delay(waitMs);

  if (this.status !== STATE_STOPPED) {
    this.poll();
  }
};


// helpers ///////////////////////

function wrapFn(fn) {

  var argCount = fn.length;

  if (argCount === 1) {
    // promise style worker
    return async function(context) {
      return await fn(context);
    };
  }

  if (argCount === 2) {
    // callback style worker
    return function(context) {

      return new Promise(function(resolve, reject) {
        try {
          fn(context, function(err, data) {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          });
        } catch (err) {
          reject(err);
        }
      });

    };
  }

  throw new Error('expected Promise or callback style fn');
}

function isFunction(o) {
  return typeof o === 'function';
}

function delay(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

function parseOptions(options) {
  return extend({ workerId: uuid.v4() }, defaultOptions, options || {});
}

function now() {
  return new Date().getTime();
}

function map(obj, fn) {
  var results = [];

  forEach(obj, function(val, key) {
    results.push(fn(val, key));
  });

  return results;
}