
var debug = require('debug');

// The basic tokens, defined as constants
var  AT = 'AT'
  ,ASSIGN_OPERATOR = 'ASSIGN_OPERATOR'
  ,AT_COLON = 'AT_COLON'
  ,AT_STAR_CLOSE = 'AT_STAR_CLOSE'
  ,AT_STAR_OPEN = 'AT_STAR_OPEN'
  ,BACKSLASH = 'BACKSLASH'
  ,BRACE_CLOSE = 'BRACE_CLOSE'
  ,BRACE_OPEN = 'BRACE_OPEN'
  ,CONTENT = 'CONTENT'
  ,DOUBLE_QUOTE = 'DOUBLE_QUOTE'
  ,EXCLAMATION_POINT = 'EXCLAMATION_POINT'
  ,EQUAL_SIGN = 'EQUAL_SIGN'
  ,EMAIL = 'EMAIL'
  ,ESCAPED_QUOTE = 'ESCAPED_QUOTE'
  ,FORWARD_SLASH = 'FORWARD_SLASH'
  ,FUNCTION = 'FUNCTION'
  ,GT_SIGN = 'GT_SIGN'
  ,HARD_PAREN_CLOSE = 'HARD_PAREN_CLOSE'
  ,HARD_PAREN_OPEN = 'HARD_PAREN_OPEN'
  ,HTML_TAG_CLOSE = 'HTML_TAG_CLOSE'
  ,HTML_TAG_OPEN = 'HTML_TAG_OPEN'
  ,HTML_TAG_VOID_OPEN = 'HTML_TAG_VOID_OPEN'
  ,HTML_TAG_VOID_CLOSE = 'HTML_TAG_VOID_CLOSE'
  ,IDENTIFIER = 'IDENTIFIER'
  ,KEYWORD = 'KEYWORD'
  ,LOGICAL = 'LOGICAL'
  ,LT_SIGN = 'LT_SIGN'
  ,NEWLINE = 'NEWLINE'
  ,NUMERIC_CONTENT = 'NUMERIC_CONTENT'
  ,OPERATOR = 'OPERATOR'
  ,PAREN_CLOSE = 'PAREN_CLOSE'
  ,PAREN_OPEN = 'PAREN_OPEN'
  ,PERIOD = 'PERIOD'
  ,SINGLE_QUOTE = 'SINGLE_QUOTE'
  ,TEXT_TAG_CLOSE = 'TEXT_TAG_CLOSE'
  ,TEXT_TAG_OPEN = 'TEXT_TAG_OPEN'
  ,WHITESPACE = 'WHITESPACE';


// The order of these is important, as it is the order in which
// they are run against the input string.
// They are separated out here to allow for better minification
// with the least amount of effort from me. :)

// NOTE: this is an array, not an object literal! The () around
// the regexps are for the sake of the syntax highlighter in my
// editor... sublimetext2

var TESTS = [

   AT_STAR_OPEN, (/^(@\*)/)
  ,AT_STAR_CLOSE, (/^(\*@)/)


  ,AT_COLON, (/^(@\:)/)
  ,AT, (/^(@)/)


  ,PAREN_OPEN, (/^(\()/)
  ,PAREN_CLOSE, (/^(\))/)


  ,HARD_PAREN_OPEN, (/^(\[)/)
  ,HARD_PAREN_CLOSE, (/^(\])/)


  ,BRACE_OPEN, (/^(\{)/)
  ,BRACE_CLOSE, (/^(\})/)


  ,TEXT_TAG_OPEN, (/^(<text>)/)
  ,TEXT_TAG_CLOSE, (/^(<\/text>)/)

  ,HTML_TAG_VOID_CLOSE, (/^(\/>)/)
  ,HTML_TAG_CLOSE, (/^(<\/)/)
  ,LT_SIGN, (/^(<)/)
  ,GT_SIGN, (/^(>)/)

  ,EQUAL_SIGN, (/^(=)/)
  ,PERIOD, (/^(\.)/)
  ,NEWLINE, function(){
    var token = this.scan(/^(\n)/, NEWLINE);
    if(token){
      this.lineno++;
      this.charno = 0;
    }
    return token;
  }
  ,WHITESPACE, (/^(\s)/)
  ,FUNCTION, (/^(function)(?![\d\w])/)
  ,KEYWORD, (/^(case|catch|do|else|finally|for|function|goto|if|instanceof|return|switch|try|typeof|var|while|with)(?![\d\w])/)
  ,IDENTIFIER, (/^([_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*)/)

  ,FORWARD_SLASH, (/^(\/)/)


  ,ESCAPED_QUOTE, (/^(\\+['"])/)
  ,BACKSLASH, (/^(\\)/)
  ,EXCLAMATION_POINT, (/^(!)/)
  ,DOUBLE_QUOTE, (/^(\")/)
  ,SINGLE_QUOTE, (/^(\')/)

  ,CONTENT, (/^([^\s])/)

];



// This pattern and basic lexer code were originally from the
// Jade lexer, but have been modified:
// https://github.com/visionmedia/jade/blob/master/lib/lexer.js

function VLexer(str){
  this.lg = debug('vash:lexer');
  this.input = '';
  this.originalInput = '';
  this.lineno = 1;
  this.charno = 0;
}

module.exports = VLexer;
// Export all the tokens for use in the parser.
for(var i = 0; i < TESTS.length; i += 2) {
  module.exports[TESTS[i]] = TESTS[i];
}

VLexer.prototype = {

  write: function(input) {
    var normalized = input.replace(/\r\n|\r/g, '\n');
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
          result.type, result.line, result.chr, result.val);
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
            + this.val + ']';
        }
      };

      this.charno += captures[0].length;
      return token;
    }
  }

  ,advance: function() {

    var i, name, test, result;

    for(i = 0; i < TESTS.length; i += 2){
      test = TESTS[i+1];
      test.displayName = TESTS[i];

      if(typeof test === 'function'){
        // assume complex callback
        result = test.call(this);
      }

      if(typeof test.exec === 'function'){
        // assume regex
        result = this.scan(test, TESTS[i]);
      }

      if( result ){
        return result;
      }
    }
  }
}
