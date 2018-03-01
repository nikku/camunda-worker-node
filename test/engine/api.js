var inherits = require('inherits');

var uuid = require('uuid');

var BaseApi = require('../../lib/engine/api');


function id() {
  return uuid.v4();
}


function Api(baseUrl, options) {

  BaseApi.call(this, baseUrl);

  var _req = this._req;

  var serializeVariables = this.serializeVariables;


  this.deploy = function(xmlStream, callback) {

    _req('post', '/deployment/create', {
      formData: {
        'deployment-name': id(),
        'process': xmlStream
      }
    }, function(err, response, body) {

      if (err) {
        return callback(err);
      }

      var deployment = JSON.parse(body);

      return callback(null, deployment);
    });
  };

  this.undeploy = function(deployment, callback) {
    _req('delete', '/deployment/' + deployment.id + '?cascade=true', function(err, response, body) {

      if (err) {
        return callback(err);
      }

      callback(err, response, body);
    });

  };

  this.startProcessByKey = function(definitionKey, variables, callback) {

    if (typeof variables === 'function') {
      callback = variables;
      variables = {};
    }

    _req('post', '/process-definition/key/' + definitionKey + '/start', {
      json: true,
      body: {
        variables: serializeVariables(variables)
      }
    }, function(err, response, body) {

      if (err) {
        return callback(err);
      }

      return callback(null, body);
    });
  };

  this.getProcessInstance = function(processInstanceId, callback) {

    _req('get', '/process-instance/' + processInstanceId, { json: true }, function(err, response, body) {

      if (response && response.statusCode === 404) {
        return callback();
      }

      if (err) {
        return callback(err);
      }

      return callback(null, body);
    });

  };

  this.getProcessVariable = function(processInstanceId, name, callback) {

    _req('get', '/process-instance/' + processInstanceId + '/variables/' + name + '?deserializeValue=false', { json: true }, function(err, response, body) {

      if (response && response.statusCode === 404) {
        return callback();
      }

      if (err) {
        return callback(err);
      }

      return callback(null, body);
    });
  };

}

inherits(Api, BaseApi);

module.exports = Api;