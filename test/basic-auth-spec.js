var expect = require('chai').expect;

var Worker = require('../');

var BasicAuth = require('../lib/basic-auth');


describe('basic-auth', function() {

  var engineUrl = 'http://localhost:8080/engine-rest';

  var worker;


  it('should add requestOptions + Authorization header', function() {

    // given
    worker = Worker(engineUrl, {
      autoPoll: false,
      use: [
        BasicAuth('Walt', 'SECRET_PASSWORD')
      ]
    });

    // then
    expect(worker.options.requestOptions.headers).to.include({
      Authorization: 'Basic V2FsdDpTRUNSRVRfUEFTU1dPUkQ='
    });
  });


  it('should merge in Authorization header', function() {

    // given
    worker = Worker(engineUrl, {
      autoPoll: false,
      use: [
        BasicAuth('Walt', 'SECRET_PASSWORD')
      ],
      requestOptions: {
        foo: 'BAR'
      }
    });

    // then
    expect(worker.options.requestOptions.headers).to.include({
      Authorization: 'Basic V2FsdDpTRUNSRVRfUEFTU1dPUkQ='
    });

    expect(worker.options.requestOptions).to.include({
      foo: 'BAR'
    });
  });

});
