var Node = module.exports = function MarkupAttributeNode() {
  this.type = 'VashMarkupAttribute';
  this.left = [];
  this.right = [];
  this.rightIsQuoted = false;
  this.startloc = null;
  this.endloc = null;

  this._finishedLeft = false;
  this._expectRight = false;
}

Node.prototype.endOk = function() {
  // TODO: this should include expecting right + found quotes or not.
  return this._finishedLeft
    ? true
    : false;
}