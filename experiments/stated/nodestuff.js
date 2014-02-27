function clean(node) {
  return Object.keys(node).reduce(function(out, key) {
    var value = node[key];
    if (key[0] !== '_' && typeof value !== 'function') {
      if (Array.isArray(value)) {
        out[key] = value.map(clean);
      } else {
        out[key] = value;
      }
    }
    return out;
  }, {});
}

exports.clean = clean;
