// The order of these is important, as it is the order in which
// they are run against the input string.
// They are separated out here to allow for better minification
// with the least amount of effort from me. :)

// Any function instead of regex is called with the lexer as the
// context.

// NOTE: this is an array, not an object literal! The () around
// the regexps are for the sake of the syntax highlighter in my
// editor... sublimetext2

var TESTS = [

    'AT_STAR_OPEN', (/^(@\*)/)
  , 'AT_STAR_CLOSE', (/^(\*@)/)


  , 'AT_COLON', (/^(@\:)/)
  , 'AT', (/^(@)/)


  , 'PAREN_OPEN', (/^(\()/)
  , 'PAREN_CLOSE', (/^(\))/)


  , 'HARD_PAREN_OPEN', (/^(\[)/)
  , 'HARD_PAREN_CLOSE', (/^(\])/)


  , 'BRACE_OPEN', (/^(\{)/)
  , 'BRACE_CLOSE', (/^(\})/)


  , 'TEXT_TAG_OPEN', (/^(<text>)/)
  , 'TEXT_TAG_CLOSE', (/^(<\/text>)/)

  , 'HTML_TAG_VOID_CLOSE', (/^(\/>)/)
  , 'HTML_TAG_CLOSE', (/^(<\/)/)
  , 'LT_SIGN', (/^(<)/)
  , 'GT_SIGN', (/^(>)/)

  , 'EQUAL_SIGN', (/^(=)/)
  , 'PERIOD', (/^(\.)/)
  , 'NEWLINE', function(){
    var token = this.scan(/^(\n)/, exports.NEWLINE);
    if(token){
      this.lineno++;
      this.charno = 0;
    }
    return token;
  }
  , 'WHITESPACE', (/^(\s)/)
  , 'FUNCTION', (/^(function)(?![\d\w])/)
  , 'KEYWORD', (/^(case|catch|do|else|finally|for|function|goto|if|instanceof|return|switch|try|typeof|var|while|with)(?![\d\w])/)
  , 'IDENTIFIER', (/^([_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*)/)

  , 'FORWARD_SLASH', (/^(\/)/)


  , 'ESCAPED_QUOTE', (/^(\\+['"])/)
  , 'BACKSLASH', (/^(\\)/)
  , 'EXCLAMATION_POINT', (/^(!)/)
  , 'DOUBLE_QUOTE', (/^(\")/)
  , 'SINGLE_QUOTE', (/^(\')/)

  , 'CONTENT', (/^([^\s])/)

];

exports.tests = TESTS;

// Export all the tokens as constants.
for(var i = 0; i < TESTS.length; i += 2) {
  exports[TESTS[i]] = TESTS[i];
}