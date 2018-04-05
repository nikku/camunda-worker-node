var expect = require('chai').expect;

var SerializedVariable = require('../lib/serialized-variable');


describe('serialized-variable', function() {

  var value = {
    value: 'foobar',
    type: 'Object',
    valueInfo: {
      foo: 'BAR'
    }
  };


  it('should wrap passed value', function() {
    // given
    var variable = new SerializedVariable(value);

    // then
    expect(variable.serializedValue).to.equal(value);
  });


  it('should allow functional wrapping', function() {
    // given
    var variable = SerializedVariable(value);

    // then
    expect(variable.serializedValue).to.equal(value);

    expect(variable instanceof SerializedVariable).to.be.true;
  });

});
