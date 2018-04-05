function ManualSerialization(params) {
    if (!(this instanceof ManualSerialization)) {
        return new ManualSerialization(params);
    }

    Object.assign(this, params);
}

module.exports = ManualSerialization;
