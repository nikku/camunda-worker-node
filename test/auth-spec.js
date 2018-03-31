var expect = require('chai').expect;

var Worker = require('../');

var Auth = require('../lib/auth');


describe('auth', function() {

  var engineUrl = 'http://localhost:8080/engine-rest';

  var worker;


  it('should add requestOptions + Authorization header', function() {

    // given
    worker = Worker(engineUrl, {
      autoPoll: false,
      use: [
        Auth('Bearer', 'TOKEN')
      ]
    });

    // then
    expect(worker.options.requestOptions.headers).to.include({
      Authorization: 'Bearer TOKEN'
    });
  });


  it('should merge in Authorization header', function() {

    // given
    worker = Worker(engineUrl, {
      autoPoll: false,
      use: [
        Auth('Bearer', 'TOKEN')
      ],
      requestOptions: {
        foo: 'BAR'
      }
    });

    // then
    expect(worker.options.requestOptions.headers).to.include({
      Authorization: 'Bearer TOKEN'
    });

    expect(worker.options.requestOptions).to.include({
      foo: 'BAR'
    });
  });

});
