module.exports = function MarkupContentNode() {
  this.type = 'VashMarkupContent';
  this.values = [];
  this.startloc = null;
  this.endloc = null;

  this._waitingForNewline = null;
}