var inherits = require('inherits');

var uuid = require('uuid');

var BaseApi = require('../../lib/engine/api');

var {
  FormData
} = require('../../lib/engine/fetch');

var fs = require('fs');


function id() {
  return uuid.v4();
}


function Api(baseUrl, requestOptions, apiVersion) {

  BaseApi.call(this, baseUrl, requestOptions, apiVersion);

  this.deploy = function(filePath) {

    var xmlStream = fs.createReadStream(filePath);

    var formData = new FormData();

    formData.append('deployment-name', id());
    formData.append('process', xmlStream);

    return this._req('post', '/deployment/create', {
      body: formData
    });
  };

  this.undeploy = function(deployment) {
    return this._req(
      'delete',
      `/deployment/${deployment.id}?cascade=true`,
      { json: true },
      { allowedCodes: [ 404 ] }
    );
  };

  this.startProcessByKey = function(definitionKey, variables) {
    return this._req(
      'post',
      `/process-definition/key/${definitionKey}/start`,
      {
        json: true,
        body: {
          variables: this.serializeVariables(variables || {})
        }
      }
    );
  };

  this.getProcessInstance = function(processInstanceId) {
    return this._req(
      'get',
      `/process-instance/${processInstanceId}`,
      { json: true },
      { allowedCodes: [ 404 ] }
    );
  };

  this.getProcessVariable = function(processInstanceId, name) {
    return this._req(
      'get',
      `/process-instance/${processInstanceId}/variables/${name}?deserializeValue=false`,
      { json: true },
      { allowedCodes: [ 404 ] }
    );
  };

  this.getWorkerLog = function(workerId) {
    return this._req(
      'get',
      `/history/external-task-log?workerId=${workerId}`,
      { json: true }
    );
  };

  this.getActivityInstances = function(processInstanceId) {

    return this._req(
      'get',
      `/process-instance/${processInstanceId}/activity-instances`,
      { json: true }
    );
  };

}

inherits(Api, BaseApi);

module.exports = Api;