/*jshint strict:false, asi:true, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

// The basic tokens, defined as constants
exports.AT = 'AT';
exports.ASSIGN_OPERATOR = 'ASSIGN_OPERATOR';
exports.AT_COLON = 'AT_COLON';
exports.AT_STAR_CLOSE = 'AT_STAR_CLOSE';
exports.AT_STAR_OPEN = 'AT_STAR_OPEN';
exports.BACKSLASH = 'BACKSLASH';
exports.BRACE_CLOSE = 'BRACE_CLOSE';
exports.BRACE_OPEN = 'BRACE_OPEN';
exports.CONTENT = 'CONTENT';
exports.DOUBLE_QUOTE = 'DOUBLE_QUOTE';
exports.EMAIL = 'EMAIL';
exports.ESCAPED_QUOTE = 'ESCAPED_QUOTE';
exports.FORWARD_SLASH = 'FORWARD_SLASH';
exports.FUNCTION = 'FUNCTION';
exports.HARD_PAREN_CLOSE = 'HARD_PAREN_CLOSE';
exports.HARD_PAREN_OPEN = 'HARD_PAREN_OPEN';
exports.HTML_TAG_CLOSE = 'HTML_TAG_CLOSE';
exports.HTML_TAG_OPEN = 'HTML_TAG_OPEN';
exports.HTML_TAG_VOID_OPEN = 'HTML_TAG_VOID_OPEN';
exports.HTML_TAG_VOID_CLOSE = 'HTML_TAG_VOID_CLOSE';
exports.IDENTIFIER = 'IDENTIFIER';
exports.KEYWORD = 'KEYWORD';
exports.LOGICAL = 'LOGICAL';
exports.NEWLINE = 'NEWLINE';
exports.NUMERIC_CONTENT = 'NUMERIC_CONTENT';
exports.OPERATOR = 'OPERATOR';
exports.PAREN_CLOSE = 'PAREN_CLOSE';
exports.PAREN_OPEN = 'PAREN_OPEN';
exports.PERIOD = 'PERIOD';
exports.SINGLE_QUOTE = 'SINGLE_QUOTE';
exports.TEXT_TAG_CLOSE = 'TEXT_TAG_CLOSE';
exports.TEXT_TAG_OPEN = 'TEXT_TAG_OPEN';
exports.WHITESPACE = 'WHITESPACE';

var PAIRS = exports.PAIRS = {};

// defined through indexing to help minification
PAIRS[exports.AT_STAR_OPEN] = exports.AT_STAR_CLOSE;
PAIRS[exports.BRACE_OPEN] = exports.BRACE_CLOSE;
PAIRS[exports.DOUBLE_QUOTE] = exports.DOUBLE_QUOTE;
PAIRS[exports.HARD_PAREN_OPEN] = exports.HARD_PAREN_CLOSE;
PAIRS[exports.PAREN_OPEN] = exports.PAREN_CLOSE;
PAIRS[exports.SINGLE_QUOTE] = exports.SINGLE_QUOTE;
PAIRS[exports.AT_COLON] = exports.NEWLINE;
PAIRS[exports.FORWARD_SLASH] = exports.FORWARD_SLASH; // regex



// The order of these is important, as it is the order in which
// they are run against the input string.
// They are separated out here to allow for better minification
// with the least amount of effort from me. :)

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
	exports.EMAIL, (/^([a-zA-Z0-9.%]+@[a-zA-Z0-9.\-]+\.(?:ca|co\.uk|com|edu|net|org))\b/)


	,exports.AT_STAR_OPEN, (/^(@\*)/)
	,exports.AT_STAR_CLOSE, (/^(\*@)/)


	,exports.AT_COLON, (/^(@\:)/)
	,exports.AT, (/^(@)/)


	,exports.PAREN_OPEN, (/^(\()/)
	,exports.PAREN_CLOSE, (/^(\))/)


	,exports.HARD_PAREN_OPEN, (/^(\[)/)
	,exports.HARD_PAREN_CLOSE, (/^(\])/)


	,exports.BRACE_OPEN, (/^(\{)/)
	,exports.BRACE_CLOSE, (/^(\})/)


	,exports.TEXT_TAG_OPEN, (/^(<text>)/)
	,exports.TEXT_TAG_CLOSE, (/^(<\/text>)/)


	,exports.HTML_TAG_OPEN, function(){
		var  reHtml = /^(<[a-zA-Z@]+?[^>]*?>)/
			,reEmail = /([a-zA-Z0-9.%]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,4})\b/
			,reSelfClosing = /^(<[a-zA-Z@]+[^>]*?\s*\/\s*>)/

		var tok = this.scan( reSelfClosing, exports.HTML_TAG_VOID_OPEN )
			|| this.scan( reHtml, exports.HTML_TAG_OPEN );

		if( tok ){
			this.spewIf( tok, reEmail );
			this.spewIf( tok, /(@)/ );
			this.spewIf( tok, /(\/\s*>)/ );
		}

		return tok;
	}
	,exports.HTML_TAG_CLOSE, (/^(<\/[^>@\b]+?>)/)
	,exports.HTML_TAG_VOID_CLOSE, (/^(\/\s*>)/)


	,exports.PERIOD, (/^(\.)/)
	,exports.NEWLINE, function(){
		var token = this.scan(/^(\n)/, exports.NEWLINE);
		if(token){
			this.lineno++;
			this.charno = 0;
		}
		return token;
	}
	,exports.WHITESPACE, (/^(\s)/)
	,exports.FUNCTION, (/^(function)(?![\d\w])/)
	,exports.KEYWORD, (/^(case|catch|do|else|finally|for|function|goto|if|instanceof|return|switch|try|typeof|var|while|with)(?![\d\w])/)
	,exports.IDENTIFIER, (/^([_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*)/)

	,exports.FORWARD_SLASH, (/^(\/)/)

	,exports.OPERATOR, (/^(===|!==|==|!==|>>>|<<|>>|>=|<=|>|<|\+|-|\/|\*|\^|%|\:|\?)/)
	,exports.ASSIGN_OPERATOR, (/^(\|=|\^=|&=|>>>=|>>=|<<=|-=|\+=|%=|\/=|\*=|=)/)
	,exports.LOGICAL, (/^(&&|\|\||&|\||\^)/)


	,exports.ESCAPED_QUOTE, (/^(\\+['"])/)
	,exports.BACKSLASH, (/^(\\)/)
	,exports.DOUBLE_QUOTE, (/^(\")/)
	,exports.SINGLE_QUOTE, (/^(\')/)


	,exports.NUMERIC_CONTENT, (/^([0-9]+)/)
	,exports.CONTENT, (/^([^\s})@.]+?)/)

];

// This pattern and basic lexer code were originally from the
// Jade lexer, but have been modified:
// https://github.com/visionmedia/jade/blob/master/lib/lexer.js

function VLexer(str){
	this.input = this.originalInput = str.replace(/\r\n|\r/g, '\n');
	this.lineno = 1;
	this.charno = 0;
}

VLexer.prototype = {

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

	,spewIf: function( tok, re ){
		var result, index, spew

		if( tok ){
			result = re.exec( tok.val );

			if( result ){
				index = tok.val.indexOf( result[1] );
				spew = tok.val.substring( index );
				this.input = spew + this.input;
				this.charno -= spew.length;
				tok.val = tok.val.substring( 0, index );
			}
		}

		return tok;
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

exports.VLexer = VLexer;