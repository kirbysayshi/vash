var Node = module.exports = function MarkupCommentNode() {
  this.type = 'VashMarkupComment';
  this.values = [];
  this.startloc = null;
  this.endloc = null;

  this._finishedOpen = false
  this._waitingForClose = null;
}

Node.prototype.endOk = function() {
  return this._waitingForClose || this._finishedOpen
    ? false
    : true;
}