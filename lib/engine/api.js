var {
  fetch
} = require('./fetch');

var ManualSerialization = require('../manual-serialization')

var extend = require('xtend');

var forEach = require('foreach');

var HEADER_CONTENT_TYPE = 'Content-Type';
var HEADER_ACCEPT = 'Accept';

var APPLICATION_JSON = 'application/json';

var VERSION_7_5 = '7.5';


function Api(baseUrl, defaultRequestOptions, apiVersion) {

  // strip trailing slash
  baseUrl = baseUrl.replace(/\/$/, '');

  this._req = async function(method, path, requestOptions, responseOptions) {

    responseOptions = responseOptions || {};

    var opts = extend(
      { method },
      defaultRequestOptions,
      requestOptions || {}
    );

    if (opts.json) {
      opts.body = opts.body && JSON.stringify(opts.body);

      // don't monkey-patch existing headers
      opts.headers = extend({}, opts.headers);

      opts.headers[HEADER_ACCEPT] = APPLICATION_JSON;
      opts.headers[HEADER_CONTENT_TYPE] = APPLICATION_JSON;
    }

    const response = await fetch(baseUrl + path, opts);

    const {
      headers,
      status
    } = response;

    var body;

    if (headers.get(HEADER_CONTENT_TYPE) === APPLICATION_JSON) {
      body = await response.json();
    }

    const allowedCodes = responseOptions.allowedCodes || [];

    // treat server and client error codes
    // as actual errors
    if (status >= 300) {
      if (allowedCodes.indexOf(status) === -1) {
        throw ResponseError(
          'status=' + status + ', ' +
          'payload=' + JSON.stringify(body)
        );
      }

      // don't return response payload
      return null;
    }

    return body;
  };

  /**
   * Get serialized type for given value
   */
  function getSerializedType(value, descriptor) {

    var type;

    if (descriptor) {
      return descriptor.type;
    } else

    if (value instanceof Date) {
      type = 'Date';
    } else

    if (value instanceof ManualSerialization) {
      type = 'ManualSerialization';
    } else

    if (typeof value === 'object') {
      type = 'Json';
    } else

    if (typeof value === 'boolean') {
      type = 'Boolean';
    } else

    if (typeof value === 'number') {
      type = 'Double';
    } else {
      type = 'String';
    }

    return type;
  }

  this.serializeVariables = function(variables, variableDescriptors) {

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

        if (apiVersion === VERSION_7_5) {
          // this is compatible with Camunda < 7.8
          // rest api assumes iso string without timezone
          value = value.toISOString().replace(/\..{4}$/, '');
        } else {
          // this is compatible with Camunda >= 7.8
          // rest api does not support Z as a shortcut for UTC+00:00
          value = value.toISOString().replace(/Z$/, 'UTC+00:00');
        }
      } else

      if (type === 'Json' || type === 'Object') {
        value = typeof value !== 'string' ? JSON.stringify(value) : value;
      } else

      if(type === 'ManualSerialization'){
        descriptor[key] = value;
        return;
      }


      descriptors[key] = extend({}, descriptor, {
        value: value,
        type: type
      });

    });

    return descriptors;
  };

  this.deserializeVariables = function(descriptors) {

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
  };

  this.multiPoll = function(body) {
    return this._req('post', '/external-task/fetchAndLock', {
      json: true,
      body
    });
  };

  this.extendLock = function(taskId, body) {
    return this._req('post', `/external-task/${taskId}/extendLock`, {
      json: true,
      body
    });
  };

  this.bpmnError = function(taskId, body) {
    return this._req('post', `/external-task/${taskId}/bpmnError`, {
      json: true,
      body
    });
  };

  this.taskCompleted = function(taskId, body) {
    return this._req('post', `/external-task/${taskId}/complete`, {
      json: true,
      body
    });
  };

  this.taskFailed = function(taskId, body) {
    return this._req('post', `/external-task/${taskId}/failure`, {
      json: true,
      body
    });
  };

}


module.exports = Api;


// helpers ///////////////////////

function ResponseError(message) {

  var err = new Error(message);

  err.name = 'ResponseError';

  return err;
}
