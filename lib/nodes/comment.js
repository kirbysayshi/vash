var Node = module.exports = function CommentNode() {
  this.type = 'VashComment';
  this.values = [];
  this.startloc = null;
  this.endloc = null;

  this._waitingForClose = null;
}

Node.prototype.endOk = function() {
  return this._waitingForClose
    ? false
    : true;
}