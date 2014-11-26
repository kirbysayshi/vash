var Node = module.exports = function BlockNode() {
  this.type = 'VashBlock';
  this.keyword = null;
  this.head = [];
  this.values = [];
  this.tail = [];
  this.hasBraces = null;
  this.startloc = null;
  this.endloc = null;

  this._reachedOpenBrace = false;
  this._reachedCloseBrace = false;
  this._withinCommentLine = false;
  this._waitingForEndQuote = null;
}

Node.prototype.endOk = function() {
  var gradeSchool = this.hasBraces
    && (!this._reachedOpenBrace || !this._reachedCloseBrace);

  return (gradeSchool || this._withinCommentLine || this._waitingForEndQuote)
    ? false
    : true;
}