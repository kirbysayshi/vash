
// Need to handle:
// if (true) /abc/.test()
// if (/abc/.test('what'))
// @(/abc/.exec('abc'))
// @{ var re = /abc/gi; }
// if (a/b) {}
// @(a/=b) // Previous is IDENTIFIER or WHITESPACE

var Node = module.exports = function RegexNode() {
  this.type = 'VashRegex';
  this.values = [];
  this.startloc = null;
  this.endloc = null;

  this._waitingForForwardSlash = null;
  this._waitingForFlags = null;
}

Node.prototype.endOk = function() {
  return this._waitingForForwardSlash || this._waitingForFlags
    ? false
    : true;
}