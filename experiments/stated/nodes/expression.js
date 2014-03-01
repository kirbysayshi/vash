var Node = module.exports = function ExpressionNode() {
  this.type = 'VashExpression';
  this.values = [];
  this.startloc = null;
  this.endloc = null;
}