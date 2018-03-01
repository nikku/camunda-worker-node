var debug = require('debug')('workers:backoff');

var extend = require('xtend');

var defaultOptions = {
  maxPollingDelay: 30000,
  stepping: 1.5
};

function parseOptions(options) {
  return extend({}, defaultOptions, options || {});
}

function Backoff(workers, opts) {

  var options = parseOptions(opts);

  var defaultPollingDelay = workers.options.pollingDelay;


  workers.on('poll:error', function() {

    var currentPollingDelay = workers.options.pollingDelay;

    if (options.maxPollingDelay <= currentPollingDelay) {
      return;
    }

    currentPollingDelay = Math.min(options.maxPollingDelay, currentPollingDelay * options.stepping);

    debug('increasing pollingDelay to %s', currentPollingDelay);

    workers.options.pollingDelay = currentPollingDelay;
  });


  workers.on('poll:success', function() {

    var currentPollingDelay = workers.options.pollingDelay;

    if (currentPollingDelay !== defaultPollingDelay) {
      debug('reset pollingDelay to default');
      workers.options.pollingDelay = defaultPollingDelay;
    }
  });

}

module.exports = Backoff;