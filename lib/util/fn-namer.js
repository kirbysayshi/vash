var lg = require('debug')('vash:fn-namer');
var reName = /^function\s+([A-Za-z0-9_]+)\s*\(/;

module.exports = function(fn) {
  if (fn.name) {
    lg('bailing, found .name %s', fn.name);
    return fn;
  }
  var fnstr = fn.toString();
  var match = reName.exec(fnstr);
  if (!match) {
    lg('bailing, could not match within %s', fnstr);
    return fn;
  }
  fn.name = match[1];
  lg('set .name as %s', fn.name);
  return fn;
}