module.exports = function CommentNode() {
  this.type = 'VashComment';
  this.values = [];
  this.startloc = null;
  this.endloc = null;

  this._waitingForClose = null;
}