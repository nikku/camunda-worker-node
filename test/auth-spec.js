var expect = require('chai').expect;

var Workers = require('../');

var Auth = require('../lib/auth');


describe('auth', function() {

  var engineUrl = 'http://localhost:8080/engine-rest';

  var workers;


  it('should add requestOptions + Authorization header', function() {

    // given
    workers = Workers(engineUrl, {
      autoPoll: false,
      use: [
        Auth('Bearer', 'TOKEN')
      ]
    });

    // then
    expect(workers.options.requestOptions.headers).to.include({
      Authorization: 'Bearer TOKEN'
    });
  });


  it('should merge in Authorization header', function() {

    // given
    workers = Workers(engineUrl, {
      autoPoll: false,
      use: [
        Auth('Bearer', 'TOKEN')
      ],
      requestOptions: {
        foo: 'BAR'
      }
    });

    // then
    expect(workers.options.requestOptions.headers).to.include({
      Authorization: 'Bearer TOKEN'
    });

    expect(workers.options.requestOptions).to.include({
      foo: 'BAR'
    });
  });

});
