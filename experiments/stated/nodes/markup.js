var Node = module.exports = function MarkupNode() {
  this.type = 'VashMarkup';
  this.name = null;
  this.expression = null; // or ExpressionNode
  this.attributes = [];
  this.values = [];
  this.isVoid = false;
  this.voidClosed = false;
  this.startloc = null;
  this.endloc = null;

  this._finishedOpen = false;
  // Waiting for the finishing > of the </close>
  this._waitingForFinishedClose = false;
}

var voids = module.exports.voids = [

  // Just a little bit of cheating.
  '!DOCTYPE', '!doctype', 'doctype',

  // From the spec
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
];

Node.isVoid = function(name) {
  return voids.indexOf(name) > -1;
}

Node.prototype.endOk = function() {

  if (
    (this._finishedOpen && !this._waitingForFinishedClose)
    || (this._finishedOpen && Node.isVoid(this.name))
  ) {
    return true;
  }

  return false;
}