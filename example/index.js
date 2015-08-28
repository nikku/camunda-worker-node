var Workers = require('camunda-worker-node');

var Backoff = require('camunda-worker-node/lib/backoff');

var engineEndpoint = process.env.ENGINE_URL || 'http://localhost:8080/engine-rest';

var uuid = require('uuid');


var workers = new Workers(engineEndpoint);

Backoff(workers);

workers.registerWorker('orderProcess:shipment', [ 'order' ], function(context, callback) {

  var order = context.variables.order;

  // do actual work here, write database, provision goods
  order.shipmentId = uuid.v4();
  order.shipped = true;

  console.log('[workers] [shipment] shipping order #%s via shipment #', order.orderId, order.shipmentId);

  // notify we are done with an updated order variable
  callback(null, {
    variables: {
      order: order
    }
  });

});


workers.on('start', function() {
  console.log('[workers] starting');
});

workers.on('poll', function() {
  console.log('[workers] polling');
});

// handle worker errors
workers.on('error', function(err) {
  console.error('[workers] error: %s', err);
});