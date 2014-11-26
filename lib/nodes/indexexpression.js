var Node = module.exports = function IndexExpressionNode() {
  this.type = 'VashIndexExpression';
  this.values = [];
  this.startloc = null;
  this.endloc = null;

  this._waitingForEndQuote = null;
  this._waitingForHardParenClose = null;
}

Node.prototype.endOk = function() {
  return (this._waitingForEndQuote || this._waitingForHardParenClose)
    ? false
    : true;
}