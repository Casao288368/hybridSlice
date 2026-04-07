'use strict';

var isObject = require('is-extendable');

module.exports = function extend(o, objects) {
  if (!isObject(o)) {o = {};}
  var len = arguments.length;

  for (var i = 1; i < len; i++) {
    var obj = arguments[i];
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
