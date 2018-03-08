'use strict';

var auth = require('./auth');

/**
 * Set username + password credentials on Engine API requests.
 *
 * @example
 *
 * Workers(engineEndpoint, {
 *   use: [
 *     BasicAuth('Walt', 'SECRET_PASSWORD')
 *   ]
 * });
 */
function createBasicAuth(username, password) {

  if (!username) {
    throw new Error('<username> required');
  }

  if (typeof password === 'undefined') {
    throw new Error('<password> required');
  }

  const token = base64encode(`${username}:${password}`);

  return auth('Basic', token);
}

module.exports = createBasicAuth;


/* global btoa */

var base64encode = btoa || function(str) {
  return Buffer.from(str).toString('base64');
};