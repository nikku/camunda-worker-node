/**
 * A wrapper for pre-serialized variables
 * that are being passed on worker completion as-is.
 *
 * @param {Object} value
 */
function SerializedVariable(value) {
  if (!(this instanceof SerializedVariable)) {
    return new SerializedVariable(value);
  }

  this.serializedValue = value;
}

module.exports = SerializedVariable;