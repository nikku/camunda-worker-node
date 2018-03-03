const {
  fetch
} = require('camunda-worker-node/lib/engine/fetch');

const engineEndpoint = process.env.ENGINE_URL || 'http://localhost:8080/engine-rest';

const goods = [
  { name: 'Apple', amount: 5 },
  { name: 'Banana', amount: 1 }
];

fetch(engineEndpoint + '/process-definition/key/orderProcess/start', {
  method: 'POST',
  body: JSON.stringify({
    variables: {
      goods: {
        value: JSON.stringify(goods),
        type: 'Json'
      }
    }
  }),
  headers: {
    'Content-Type': 'application/json'
  }
}).then(function(response) {

  var status = response.status;

  if (status === 200) {
    console.log('started orderProcess');
  } else {
    console.error('failed to start orderProcess (status=%s)', status);

    response.json().then(function(json) {
      console.log(json);
    });
  }
});