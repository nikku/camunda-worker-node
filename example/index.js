var Workers = require('camunda-worker-node');

var Backoff = require('camunda-worker-node/lib/backoff');
var Metrics = require('camunda-worker-node/lib/metrics');

var engineEndpoint = process.env.ENGINE_URL || 'http://localhost:8080/engine-rest';

var uuid = require('uuid');


var debugWorkers = require('debug')('orderProcess:workers');

var debugShipment = require('debug')('orderProcess:worker:shipment');
var debugCheckout = require('debug')('orderProcess:worker:checkout');

var workers = new Workers(engineEndpoint, {
  use: [
    Backoff,
    Metrics
  ]
});


function shipOrder(context, callback) {

  const {
    variables
  } = context;

  var order = variables.order;

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
}

async function checkout(context) {

  const {
    variables,
    extendLock
  } = context;

  const goods = variables.goods;

  if (!goods || goods.length === 0) {
    throw new Error('no goods in basket');
  }

  // do actual work here, write database, reserve goods
  const order = {
    orderId: uuid.v4(),
    goods
  };

  debugCheckout(
    'created order[orderId=%s] with %s goods',
    order.orderId,
    order.goods.length
  );

  if (Math.random() > 0.6) {
    debugCheckout('delayed order[orderId=%s]', order.orderId);

    await extendLock(5000);

    await delay(Math.trunc(Math.random() * 5));
  }

  // notify we are done with a new order variable
  return {
    variables: {
      order: order
    }
  };
}

workers.registerWorker('orderProcess:shipment', [ 'order' ], shipOrder);

workers.registerWorker('orderProcess:checkout', [ 'goods' ], checkout);


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


// helpers ////////////////////

function delay(seconds) {

  return new Promise(function(resolve) {
    setTimeout(resolve, seconds * 1000);
  });

}