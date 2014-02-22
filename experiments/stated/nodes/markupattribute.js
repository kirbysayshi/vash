module.exports = function MarkupAttributeNode() {
  this.type = 'VashMarkupAttribute';
  this.left = [];
  this.right = [];
  this.rightIsQuoted = false;
  this.startloc = null;
  this.endloc = null;

  this._finishedLeft = false;
  this._expectRight = false;
}