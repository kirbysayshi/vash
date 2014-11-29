var helpers = require('../../runtime').helpers;

// Trim whitespace from the start and end of a string
helpers.trim = function(val){
  return val.replace(/^\s*|\s*$/g, '');
}