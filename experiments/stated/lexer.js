var debug = require('debug');
var tokens = require('./tokens');

// This pattern and basic lexer code were originally from the
// Jade lexer, but have been modified:
// https://github.com/visionmedia/jade/blob/master/lib/lexer.js

function VLexer(){
  this.lg = debug('vash:lexer');
  this.input = '';
  this.originalInput = '';
  this.lineno = 1;
  this.charno = 0;
}

module.exports = VLexer;

VLexer.prototype = {

  write: function(input) {
    var normalized = input.replace(/\r\n|\r/g, '\n');

    // Kill BOM if this is the first chunk.
    if (this.originalInput.length == 0) {
      normalized = normalized.replace(/^\uFEFF/, '');
    }

    this.input += normalized;
    this.originalInput += normalized;
    return true;
  },

  read: function() {
    var out = []
      , result;
    while(this.input.length) {
      result = this.advance();
      if (result) {
        out.push(result);
        this.lg('Read %s at line %d, column %d with content %s',
          result.type, result.line, result.chr, result.val.replace(/(\n)/, '\\n'));
      }
    }
    return out;
  },

  scan: function(regexp, type){
    var captures, token;
    if (captures = regexp.exec(this.input)) {
      this.input = this.input.substr((captures[1].length));

      token = {
        type: type
        ,line: this.lineno
        ,chr: this.charno
        ,val: captures[1] || ''
        ,toString: function(){
          return '[' + this.type
            + ' (' + this.line + ',' + this.chr + '): '
            + this.val.replace(/(\n)/, '\\n') + ']';
        }
      };

      this.charno += captures[0].length;
      return token;
    }
  }

  ,advance: function() {

    var i, name, test, result;

    for(i = 0; i < tokens.tests.length; i += 2){
      test = tokens.tests[i+1];
      test.displayName = tokens.tests[i];

      if(typeof test === 'function'){
        // assume complex callback
        result = test.call(this);
      }

      if(typeof test.exec === 'function'){
        // assume regex
        result = this.scan(test, tokens.tests[i]);
      }

      if( result ){
        return result;
      }
    }
  }
}
