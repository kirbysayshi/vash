module.exports = function(obj) {
  // extend works from right to left, using first arg as target
  var next, i, p;

  for(i = 1; i < arguments.length; i++){
    next = arguments[i];

    for(p in next){
      obj[p] = next[p];
    }
  }

  return obj;
}