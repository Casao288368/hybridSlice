'use strict';

var isObject = require('is-plain-object');

module.exports = function extend(o, objects) {
  if (!o || !objects) { return o || {}; }

  var len = arguments.length - 1;
  for (var i = 0; i < len; i++) {
    var obj = arguments[i + 1];

    if (isObject(obj)) {
      for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
          o[key] = obj[key];
        }
      }
    }
  }
  return o;
};
