'use strict';

/**
 * Set arbitrary authorization tokens on Engine API requests.
 *
 * @example
 *
 * Worker(engineEndpoint, {
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
  return function(worker) {

    const workerOptions = worker.options;
    const requestOptions = workerOptions.requestOptions || {};
    const headers = requestOptions.headers || {};

    worker.options = {
      ...workerOptions,
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