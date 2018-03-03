var debug = require('debug')('workers:backoff');

var extend = require('xtend');

var defaultOptions = {
  maxPollingInterval: 30000,
  stepping: 1.5
};

function parseOptions(options) {
  return extend({}, defaultOptions, options || {});
}

function Backoff(workers, opts) {

  var options = parseOptions(opts);

  var defaultPollingInterval = workers.options.pollingInterval;


  workers.on('fetchTasks:failed', function() {

    var currentPollingInterval = workers.options.pollingInterval;

    if (options.maxPollingInterval <= currentPollingInterval) {
      return;
    }

    currentPollingInterval = Math.min(options.maxPollingInterval, currentPollingInterval * options.stepping);

    debug('increasing pollingInterval to %s', currentPollingInterval);

    workers.options.pollingInterval = currentPollingInterval;
  });


  workers.on('fetchTasks:success', function() {

    var currentPollingInterval = workers.options.pollingInterval;

    if (currentPollingInterval !== defaultPollingInterval) {
      debug('reset pollingInterval to default');
      workers.options.pollingInterval = defaultPollingInterval;
    }
  });

}

module.exports = Backoff;