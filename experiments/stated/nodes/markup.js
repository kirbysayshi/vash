module.exports = function MarkupNode() {
  this.type = 'VashMarkup';
  this.name = null;
  this.expression = null; // or ExpressionNode
  this.attributes = [];
  this.values = [];
  this.startloc = null;
  this.endloc = null;

  this._finishedOpen = false;
}