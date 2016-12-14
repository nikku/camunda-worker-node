var extend = require('xtend');

var forEach = require('foreach');

var EngineApi = require('./engine/api');

var Emitter = require('events');

var uuid = require('uuid');

var inherits = require('inherits');

/**
 * Defer stuff
 */
function defer(seconds, fn, context) {
  return setTimeout(fn.bind(context), seconds);
}

/**
 * Option parsing
 */
function parseOptions(options) {
  return extend({ workerId: uuid.v4() }, defaultOptions, options || {});
}


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

  // local variables
  this.engineApi = new EngineApi(baseUrl);

  this.workers = {};

  this.options = parseOptions(opts);

  // start

  var pollingDelay = this.options.pollingDelay;

  // disable auto-start by setting polling delay to -1
  // otherwise delay start by pollingDelay + random value
  if (pollingDelay > -1) {
    defer(pollingDelay + pollingDelay * Math.random(), this.start, this);
  }

  this.extend(opts && opts.use);
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

  var self = this;

  forEach(extensions, function(extension) {

    var opts = {},
        fn = extension;

    if (Array.isArray(extension)) {
      fn = extension[0];
      opts = extension[1];
    }

    if (typeof fn !== 'function') {
      throw new Error('extension must be <function> or <[ function, opts ]>');
    }

    fn(self, opts);
  });
};


/**
 * Propagate an error
 *
 * @param  {String} msg
 * @param  {Error} err
 */
Workers.prototype.error = function(msg, err) {
  this.emit('err', msg, err);
};

/**
 * Add worker
 *
 * @param {Object} data
 */
Workers.prototype.addWorker = function(data) {

  var self = this;

  var topicName = data.topicName;

  if (this.workers[topicName]) {
    throw new Error('worker for <' + topicName + '> already registered');
  }

  var worker = extend(new WorkerRegistration(), data);

  this.emit('worker:register', worker);

  this.workers[topicName] = worker;

  /**
   * Remove the worker worker
   */
  worker.remove = function() {
    if (self.workers[topicName] === this) {
      self.emit('worker:remove', worker);

      delete self.workers[topicName];
    }
  };

  return worker;
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
    fn: fn
  });

  return this.addWorker(data);
};


/**
 * Poll to see if new work needs to be done.
 */
Workers.prototype.poll = function() {

  var self = this;

  var topics = [];

  forEach(this.workers, function(definition) {
    topics.push({
      topicName: definition.topicName,
      variables: definition.variables,
      lockDuration: definition.lockTime
    });
  });

  if (!topics.length) {
    return;
  }

  self.emit('poll', topics);

  this.engineApi.multiPoll({
    workerId: self.options.workerId,
    maxTasks: self.options.maxTasks,
    topics: topics
  }, function(err, result) {
    if (err) {
      self.emit('poll:error', err);
      self.error('failed to poll', err);
    } else {
      self.emit('poll:success', result);

      result.forEach(self.executeTask, self);
    }

    self.emit('poll:complete');
  });
};

/**
 * Execute a task
 *
 * @param {Object} task
 */
Workers.prototype.executeTask = function(task) {

  var self = this;

  var workerDefinition = this.workers[task.topicName];

  // may have been removed in the mean time;
  // simply let the execution time out
  if (!workerDefinition) {
    return;
  }

  var variables = task.variables;

  var deserializedVariables = self.engineApi.deserializeVariables(variables);

  var taskContext = extend({}, task, { variables: deserializedVariables });


  workerDefinition.fn(taskContext, function(err, newContext) {

    var newVariables = newContext && newContext.variables || {};

    var body;

    if (err) {

      self.emit('task:failed', task, err);

      body = {
        workerId: self.options.workerId,
        errorMessage: err.message
      };

      self.engineApi.taskFailed(task.id, body, function(err) {
        if (err) {
          return self.error('failed to mark task as failed', err);
        }

        self.emit('task:failed:sent', task);
      });
    } else {

      self.emit('task:complete', task, newVariables);

      body = {
        workerId: self.options.workerId,
        variables: self.engineApi.serializeVariables(newVariables, variables)
      };

      self.engineApi.taskCompleted(task.id, body, function(err) {
        if (err) {
          return self.error('failed to mark task as completed', err);
        }

        self.emit('task:complete:sent', task);
      });
    }
  });
};

/**
 * Gracefully shut down the workers instance,
 * stopping continuous polling.
 *
 * @param {Function} [callback]
 */
Workers.prototype.shutdown = function(callback) {
  this.emit('shutdown', this.options.workerId);

  if (callback) {
    callback();
  }
};

Workers.prototype.start = function start() {
  this.emit('start', this.options.workerId);

  var schedulePoll = this.reschedule.bind(this);

  var stopPolling = function() {
    this.removeListener('poll:complete', schedulePoll);
  }.bind(this);

  this.on('shutdown', stopPolling)

  this.on('poll:complete', schedulePoll);

  this.poll();
};

Workers.prototype.reschedule = function() {
  defer(this.options.pollingDelay, this.poll, this);
};
