module.exports = function MarkupAttributeNode() {
  this.type = 'VashMarkupAttribute';
  this.name = ''; // Full name, like data-bind or @(whatever.the.expression)?
  this.left = [];
  this.right = [];
  this.rightIsQuoted = false;
  this.startloc = null;
  this.endloc = null;

  this._finishedLeft = false;
  this._expectRight = false;
}