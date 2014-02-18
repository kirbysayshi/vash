module.exports = function ExplicitExpressionNode() {
  this.type = 'VashExplicitExpression';
  this.values = [];
  this.startloc = null;
  this.endloc = null;

  this._waitingForEndQuote = null;
}