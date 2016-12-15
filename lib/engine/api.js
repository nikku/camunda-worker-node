var request = require('request');

var extend = require('xtend');

var forEach = require('foreach');


function Api(baseUrl, options) {

  // strip trailing slash
  baseUrl = baseUrl.replace(/\/$/, '');

  function _req(method, path, options, callback) {

    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    var opts = extend({
      method: method,
      uri: baseUrl + path
    }, options);

    return request(opts, callback);
  }

  this._req = _req;

  /**
   * Get serialized type for given value
   */
  function getSerializedType(value, descriptor) {

    if (descriptor) {
      return descriptor.type;
    } else

    if (value instanceof Date) {
      type = 'Date';
    } else

    if (typeof value === 'object') {
      type = 'Json';
    } else

    if (typeof value === 'number') {
      type = 'Double';
    } else {
      type = 'String';
    }

    return type;
  }


  function serializeVariables(variables, variableDescriptors) {

    variableDescriptors = variableDescriptors || {};

    var descriptors = {};

    forEach(variables, function(value, key) {

      var descriptor;

      if (value.valueInfo) {
        descriptor = value;
        value = descriptor.value;
      } else {
        descriptor = variableDescriptors[key];
      }

      var type = getSerializedType(value, descriptor);

      if (type === 'Date') {
        // rest api assumes iso string without timezone
        value = value.toISOString().replace(/\..{4}$/, '');
      } else

      if (type === 'Json' || type === 'Object') {
        value = typeof value !== 'string' ? JSON.stringify(value) : value;
      }


      descriptors[key] = extend({}, descriptor, {
        value: value,
        type: type
      });

    });

    return descriptors;
  }

  this.serializeVariables = serializeVariables;

  function deserializeVariables(descriptors) {

    var variables = {};

    forEach(descriptors, function(descriptor, key) {

      var type = descriptor.type,
          value = descriptor.value,
          valueInfo = descriptor.valueInfo;

      if (type === 'Json') {
        value = JSON.parse(value);
      } else

      if (type === 'Object') {
        if (valueInfo && valueInfo.serializationDataFormat === 'application/json') {
          value = JSON.parse(value);
        }
      } else

      if (type === 'Date') {
        // make iso date
        value = new Date(value);
      }

      variables[key] = value;
    });

    return variables;
  }

  this.deserializeVariables = deserializeVariables;


  this.multiPoll = function(body, callback) {

    _req('post', '/external-task/fetchAndLock', { json: true, body: body }, function(err, response, body) {

      if (err) {
        return callback(err);
      }

      return callback(err, body);
    });

  };

  this.taskCompleted = function(taskId, body, callback) {

    _req('post', '/external-task/' + taskId + '/complete', { json: true, body: body }, function(err, response, body) {

      if (err) {
        return callback(err);
      }

      return callback(err, body);
    });

  };

  this.taskFailed = function(taskId, body, callback) {

    _req('post', '/external-task/' + taskId + '/failure', { json: true, body: body }, function(err, response, body) {

      if (err) {
        return callback(err);
      }

      return callback(err, body);
    });

  };

}


module.exports = Api;
