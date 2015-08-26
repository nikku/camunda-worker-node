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


  function serializeVariables(object) {

    var descriptors = {};

    forEach(object, function(value, key) {

      var type;

      if (typeof value === 'object') {
        type = 'json';
        value = JSON.stringify(value);
      } else

      if (typeof value === 'number') {
        type = 'double';
      } else

      if (value instanceof Date) {
        type = 'date';
        // rest api broken
        value = value.toISOString().replace(/\..{4}$/, '');
      }

      descriptors[key] = {
        value: value,
        type: type
      };

    });

    return descriptors;
  }

  this.serializeVariables = serializeVariables;



  this.poll = function(body, callback) {

    _req('post', '/external-task/poll', { json: true, body: body }, function(err, response, body) {

      if (err) {
        return callback(err);
      }

      return callback(err, body);
    });

  };


  this.complete = function(taskId, body, callback) {

    _req('post', '/external-task/' + taskId + '/complete', { json: true, body: body }, function(err, response, body) {

      if (err) {
        return callback(err);
      }

      return callback(err, body);
    });

  };

}


module.exports = Api;