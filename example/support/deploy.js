const {
  fetch,
  FormData
} = require('camunda-worker-node/lib/engine/fetch');

const fs = require('fs');
const path = require('path');

const engineEndpoint = process.env.ENGINE_URL || 'http://localhost:8080/engine-rest';


var diagramPath = path.join(__dirname, '../orderProcess.bpmn');

var xmlStream = fs.createReadStream(diagramPath);

var formData = new FormData();

formData.append('deployment-name', 'orderProcessDeployment');
formData.append('process', xmlStream);

fetch(engineEndpoint + '/deployment/create', {
  method: 'POST',
  body: formData
}).then(function(response) {

  var status = response.status;

  if (status === 200) {
    console.log('deployed orderProcess');
  } else {
    console.error('failed to deploy orderProcess (status=%s)', status);
  }
});