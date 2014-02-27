module.exports = function IndexExpressionNode() {
  this.type = 'VashIndexExpression';
  this.values = [];
  this.startloc = null;
  this.endloc = null;

  this._waitingForEndQuote = null;
}