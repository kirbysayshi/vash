var Node = module.exports = function ExplicitExpressionNode() {
  this.type = 'VashExplicitExpression';
  this.values = [];
  this.startloc = null;
  this.endloc = null;

  this._waitingForParenClose = null;
  this._waitingForEndQuote = null;
}

Node.prototype.endOk = function() {
  return this._waitingForEndQuote || this._waitingForParenClose
    ? false
    : true;
}