console.log("loading helpers");
var suite = {
  assertEqual: function (message, actual, expected) {
    expect(actual).toEqual(expected);
  },

  assertNotEqual: function (message, actual, expected) {
    expect(actual).not.toEqual(expected);
  },

  assertStrictEqual: function (message, actual, expected) {
    expect(actual).toBe(expected);
  },

  assertNotStrictEqual: function (message, actual, expected) {
    expect(actual).not.toBe(expected);
  },

  assertThrows: function (message, fn) {
    expect(fn).toThrow();
  }
};

// required for node testing but forbidden on browser testing
if (typeof (window) === 'undefined') {
  module.exports = {
    suite: suite
  };
}
