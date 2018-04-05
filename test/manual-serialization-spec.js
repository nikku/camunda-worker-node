var expect = require('chai').expect;

var ManualSerialization = require('../lib/manual-serialization');

describe('manual-serialization', function() {
    var serialization;

    it('should expose all passed in properties as attributes', function() {
        // given
        serialization = new ManualSerialization({
            value: 'foobar',
            type: 'Object'
        });

        // then
        expect(serialization).to.eql({
            value: 'foobar',
            type: 'Object'
        });
    });

    it('should work if the function is called rather than instantiated', function() {
        // given
        serialization = ManualSerialization({
            value: 'foobar',
            type: 'Object'
        });

        // then
        expect(serialization).to.eql({
            value: 'foobar',
            type: 'Object'
        });
    });
});
