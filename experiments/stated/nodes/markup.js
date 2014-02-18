module.exports = function MarkupNode() {
  this.type = 'VashMarkup';
  this.name = null;
  this.expression = null; // or ExpressionNode
  this.attributes = [];
  this.values = [];
  this.startloc = null;
  this.endloc = null;

  this._finishedOpen = false;
  this._waitingForFinishedClose = false;
}

var voids = module.exports.voids = [

  // Just a little bit of cheating.
  '!DOCTYPE', '!doctype', 'doctype',

  // From the spec
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
];

module.exports.isVoid = function(name) {
  return voids.indexOf(name) > -1;
}