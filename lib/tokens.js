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

  // A real email address is considerably more complex, and unfortunately
  // this complexity makes it impossible to differentiate between an address
  // and an AT expression.
  //
  // Instead, this regex assumes the only valid characters for the user portion
  // of the address are alphanumeric, period, and %. This means that a complex email like
  // who-something@example.com will be interpreted as an email, but incompletely. `who-`
  // will be content, while `something@example.com` will be the email address.
  //
  // However, this is "Good Enough"© :).
    'EMAIL', (/^([a-zA-Z0-9.%]+@[a-zA-Z0-9.\-]+\.(?:[a-z]{2}|co\.uk|com|edu|net|org))\b/)

  , 'AT_STAR_OPEN', (/^(@\*)/)
  , 'AT_STAR_CLOSE', (/^(\*@)/)


  , 'AT_COLON', (/^(@\:)/)
  , 'AT', (/^(@)/)


  , 'PAREN_OPEN', (/^(\()/)
  , 'PAREN_CLOSE', (/^(\))/)


  , 'HARD_PAREN_OPEN', (/^(\[)/)
  , 'HARD_PAREN_CLOSE', (/^(\])/)


  , 'BRACE_OPEN', (/^(\{)/)
  , 'BRACE_CLOSE', (/^(\})/)


  , 'HTML_TAG_VOID_CLOSE', (/^(\/>)/)
  , 'HTML_TAG_CLOSE', (/^(<\/)/)
  , 'HTML_COMMENT_OPEN', (/^(<!--+)/)
  , 'HTML_COMMENT_CLOSE', (/^(--+>)/)
  , 'LT_SIGN', (/^(<)/)
  , 'GT_SIGN', (/^(>)/)

  , 'ASSIGNMENT_OPERATOR', (/^(\|=|\^=|&=|>>>=|>>=|<<=|-=|\+=|%=|\/=|\*=)\b/) // Also =
  , 'EQUALITY_OPERATOR', (/^(===|==|!==|!=)\b/)
  , 'BITWISE_SHIFT_OPERATOR', (/^(<<|>>>|>>)/)
  , 'UNARY_OPERATOR', (/^(delete\b|typeof\b|void|\+\+|--|\+|-|~|!)/)
  , 'RELATIONAL_OPERATOR', (/^(<=|>=|instanceof|in)\b/) // Also <, >
  , 'BINARY_LOGICAL_OPERATOR', (/^(&&|\|\|)\b/)
  , 'BINARY_BITWISE_OPERATOR', (/^(&|\^|\|)\b/)
  , 'NEW_OPERATOR', (/^(new)\b/)
  , 'COMMA_OPERATOR', (/^(,)/)

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
  , 'WHITESPACE', (/^(\s+)/)
  , 'FUNCTION', (/^(function)(?![\d\w])/)
  , 'BLOCK_KEYWORD', (/^(catch|do|else if|else|finally|for|function|goto|if|switch|try|while|with)(?![\d\w])/)
  , 'KEYWORD', (/^(break|case|continue|instanceof|return|var)(?![\d\w])/)
  , 'IDENTIFIER', (/^([_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*)/)

  , 'DOUBLE_FORWARD_SLASH', (/^(\/\/)/)

  , 'FORWARD_SLASH', (/^(\/)/)

  , 'BACKSLASH', (/^(\\)/)
  , 'EXCLAMATION_POINT', (/^(!)/)
  , 'DOUBLE_QUOTE', (/^(\")/)
  , 'SINGLE_QUOTE', (/^(\')/)

  , 'NUMERAL', (/^([0-9])/)
  , 'CONTENT', (/^([^\s])/)

];

exports.tests = TESTS;

// Export all the tokens as constants.
for(var i = 0; i < TESTS.length; i += 2) {
  exports[TESTS[i]] = TESTS[i];
}