var Workers = require('camunda-worker-node');

var Backoff = require('camunda-worker-node/lib/backoff');

var engineEndpoint = process.env.ENGINE_URL || 'http://localhost:8080/engine-rest';

var uuid = require('uuid');


var debugWorkers = require('debug')('workers');

var debugShipment = require('debug')('worker:shipment');

var workers = new Workers(engineEndpoint, {
  use: [
    Backoff
  ]
});


workers.registerWorker('orderProcess:shipment', [ 'order' ], function(context, callback) {

  var order = context.variables.order;

  if (Math.random() > 0.8) {
    debugShipment('failed to ship order[id=%s]', order.orderId);

    return callback(new Error('failed to process shipment: RANDOM STUFF'));
  }

  // do actual work here, write database, provision goods
  order.shipmentId = uuid.v4();
  order.shipped = true;

  debugShipment('shipping order[id=%s] with shipmentId=%s', order.orderId, order.shipmentId);

  // notify we are done with an updated order variable
  callback(null, {
    variables: {
      order: order
    }
  });

});


workers.on('start', function() {
  debugWorkers('starting');
});

workers.on('poll', function() {
  debugWorkers('polling');
});

// handle worker errors
workers.on('error', function(err) {
  debugWorkers('error: %s', err);
});