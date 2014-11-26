var Node = module.exports = function MarkupContentNode() {
  this.type = 'VashMarkupContent';
  this.values = [];
  this.startloc = null;
  this.endloc = null;

  this._waitingForNewline = null;
}

Node.prototype.endOk = function() {
  return this._waitingForNewline
    ? false
    : true;
}