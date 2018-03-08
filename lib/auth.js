'use strict';

/**
 * Set arbitrary authorization tokens on Engine API requests.
 *
 * @example
 *
 * Workers(engineEndpoint, {
 *   use: [
 *     Auth('Bearer', 'BEARER_TOKEN')
 *   ]
 * });
 */
function createAuth(type, token) {

  if (!type) {
    throw new Error('<type> required');
  }

  if (!token) {
    throw new Error('<token> required');
  }

  /**
   * Actual middleware that appends a `Authorization: "${type} ${token}"`
   * header to the request options.
   */
  return function(workers) {

    const workersOptions = workers.options;
    const requestOptions = workersOptions.requestOptions || {};
    const headers = requestOptions.headers || {};

    workers.options = {
      ...workersOptions,
      requestOptions: {
        ...requestOptions,
        headers: {
          ...headers,
          Authorization: `${type} ${token}`
        }
      }
    };
  };
}

module.exports = createAuth;