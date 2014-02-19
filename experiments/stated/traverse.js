
var visitorKeys = {
  VashProgram: ['body'],
  VashBlock: ['head', 'values', 'tail'],
  VashExplicitExpression: ['values'],
  VashExpression: ['values'],
  VashIndexExpression: ['values'],
  VashMarkup: ['attributes', 'values'],
  VashMarkupAttribute: ['left', 'right'],
  VashText: []
}

module.exports = function traverse(node, callbacks) {

  (function walk(node, parent) {

    if (!node.parent) {
      node.parent = parent;
    }

    var ret = callbacks.enter(node);

    var candidateKeys = visitorKeys[node.type];
    if (candidateKeys) {
      candidateKeys.forEach(function(key) {
        var valueNodes = node[key];
        if (valueNodes && valueNodes.length) {
          valueNodes.forEach(function(child) {
            walk(child, node);
          })
        }
      })
    }

    ret = callbacks.leave(node);
  }(node, null));
}