
var visitorKeys = {
  VashProgram: ['body'],
  VashBlock: ['head', 'values', 'tail'],
  VashExplicitExpression: ['values'],
  VashExpression: ['values'],
  VashIndexExpression: ['values'],
  VashMarkup: ['attributes', 'values'],
  VashMarkupAttribute: ['left', 'right'],
  VashMarkupContent: ['values'],
  VashText: []
}

module.exports = function traverse(node, callbacks) {

  (function walk(node, parent) {

    if (!node.parent) {
      node.parent = parent;
    }

    var visitor = callbacks[node.type];

    if (visitor && visitor.enter) {
      visitor.enter(node);
    }

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

    if (visitor && visitor.leave) {
      visitor.leave(node);
    }
  }(node, null));
}