var expect = require('chai').expect;

var Workers = require('../');

var BasicAuth = require('../lib/basic-auth');


describe('basic-auth', function() {

  var engineUrl = 'http://localhost:8080/engine-rest';

  var workers;


  it('should add requestOptions + Authorization header', function() {

    // given
    workers = Workers(engineUrl, {
      pollingDelay: -1,
      use: [
        BasicAuth('Walt', 'SECRET_PASSWORD')
      ]
    });

    // then
    expect(workers.options.requestOptions.headers).to.include({
      Authorization: 'Basic V2FsdDpTRUNSRVRfUEFTU1dPUkQ='
    });
  });


  it('should merge in Authorization header', function() {

    // given
    workers = Workers(engineUrl, {
      pollingDelay: -1,
      use: [
        BasicAuth('Walt', 'SECRET_PASSWORD')
      ],
      requestOptions: {
        foo: 'BAR'
      }
    });

    // then
    expect(workers.options.requestOptions.headers).to.include({
      Authorization: 'Basic V2FsdDpTRUNSRVRfUEFTU1dPUkQ='
    });

    expect(workers.options.requestOptions).to.include({
      foo: 'BAR'
    });
  });

});
