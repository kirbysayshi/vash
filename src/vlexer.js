/*jshint strict:false, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

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
	,EMAIL = 'EMAIL'
	,FAT_ARROW = 'FAT_ARROW'
	,FUNCTION = 'FUNCTION'
	,HARD_PAREN_CLOSE = 'HARD_PAREN_CLOSE'
	,HARD_PAREN_OPEN = 'HARD_PAREN_OPEN'
	,HTML_RAW = 'HTML_RAW'
	,HTML_TAG_CLOSE = 'HTML_TAG_CLOSE'
	,HTML_TAG_OPEN = 'HTML_TAG_OPEN'
	,HTML_TAG_SELFCLOSE = 'HTML_TAG_SELFCLOSE'
	,IDENTIFIER = 'IDENTIFIER'
	,KEYWORD = 'KEYWORD'
	,LOGICAL = 'LOGICAL'
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

var PAIRS = {};

// defined as such to help minification
PAIRS[AT_STAR_OPEN] = AT_STAR_CLOSE;
PAIRS[BRACE_OPEN] = BRACE_CLOSE;
PAIRS[DOUBLE_QUOTE] = DOUBLE_QUOTE;
PAIRS[HARD_PAREN_OPEN] = HARD_PAREN_CLOSE;
PAIRS[PAREN_OPEN] = PAREN_CLOSE;
PAIRS[SINGLE_QUOTE] = SINGLE_QUOTE;


// The order of these is important, as it is the order in which
// they are run against the input string.
// They are separated out here to allow for better minification
// with the least amount of effort from me. :)

// NOTE: this is an array, not an object literal!

var TESTS = [

	EMAIL, function(){
		return this.scan(/^([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})\b/, EMAIL);
	}


	,AT_STAR_OPEN, function(){
		return this.scan(/^(@\*)/, AT_STAR_OPEN);
	}
	,AT_STAR_CLOSE, function(){
		return this.scan(/^(\*@)/, AT_STAR_CLOSE);
	}


	,AT_COLON, function(){
		return this.scan(/^@\:/, AT_COLON);
	}
	,AT, function(){
		return this.scan(/^(@)/, AT);
	}


	,FAT_ARROW, function(){
		return this.scan(/^(\(.*?\)?\s*?=>)/, FAT_ARROW);
	}


	,PAREN_OPEN, function(){
		return this.scan(/^(\()/, PAREN_OPEN);
	}
	,PAREN_CLOSE, function(){
		return this.scan(/^(\))/, PAREN_CLOSE);
	}


	,HARD_PAREN_OPEN, function(){
		return this.scan(/^(\[)/, HARD_PAREN_OPEN);
	}
	,HARD_PAREN_CLOSE, function(){
		return this.scan(/^(\])/, HARD_PAREN_CLOSE);
	}


	,BRACE_OPEN, function(){
		return this.scan(/^(\{)/, BRACE_OPEN);
	}
	,BRACE_CLOSE, function(){
		return this.scan(/^(\})/, BRACE_CLOSE);
	}


	,TEXT_TAG_OPEN, function(){
		return this.scan(/^(<text>)/, TEXT_TAG_OPEN);
	}
	,TEXT_TAG_CLOSE, function(){
		return this.scan(/^(<\/text>)/, TEXT_TAG_CLOSE);
	}


	,HTML_TAG_SELFCLOSE, function(){
		return this.spewIf(this.scan(/^(<[^>]+?\/>)/, HTML_TAG_SELFCLOSE), '@');
	}
	,HTML_TAG_OPEN, function(){
		return this.spewIf(this.scan(/^(<[^\/ >]+?[^>]*?>)/, HTML_TAG_OPEN), '@');
	}
	,HTML_TAG_CLOSE, function(){
		return this.spewIf(this.scan(/^(<\/[^>\b]+?>)/, HTML_TAG_CLOSE), '@');
	}


	,PERIOD, function(){
		return this.scan(/^(\.)/, PERIOD);
	}
	,NEWLINE, function(){
		var token = this.scan(/^(\n)/, NEWLINE);
		if(token){
			this.lineno++;
			this.charno = 0;
		}
		return token;
	}
	,WHITESPACE, function(){
		return this.scan(/^(\s)/, WHITESPACE);
	}
	,FUNCTION, function(){
		return this.scan(/^(function)(?![\d\w])/, FUNCTION);
	}
	,KEYWORD, function(){
		return this.scan(/^(case|catch|do|else|finally|for|function|goto|if|instanceof|return|switch|try|typeof|var|while|with)(?![\d\w])/, KEYWORD);
	}
	,HTML_RAW, function(){
		return this.scan(/^(vash\.raw)(?![\d\w])/, HTML_RAW);
	}
	,IDENTIFIER, function(){
		return this.scan(/^([_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*)/, IDENTIFIER);
	}


	,OPERATOR, function(){
		return this.scan(/^(===|!==|==|!==|>>>|<<|>>|>=|<=|>|<|\+|-|\/|\*|\^|%|\:|\?)/, OPERATOR);
	}
	,ASSIGN_OPERATOR, function(){
		return this.scan(/^(\|=|\^=|&=|>>>=|>>=|<<=|-=|\+=|%=|\/=|\*=|=)/, ASSIGN_OPERATOR);
	}
	,LOGICAL, function(){
		return this.scan(/^(&&|\|\||&|\||\^)/, LOGICAL);
	}


	,BACKSLASH, function(){
		return this.scan(/^(\\)/, BACKSLASH);
	}
	,DOUBLE_QUOTE, function(){
		return this.scan(/^(")/, DOUBLE_QUOTE);
	}
	,SINGLE_QUOTE, function(){
		return this.scan(/^(')/, SINGLE_QUOTE);
	}


	,NUMERIC_CONTENT, function(){
		return this.scan(/^([0-9]+)/, NUMERIC_CONTENT);
	}
	,CONTENT, function(){
		return this.scan(/^([^\s})@.]+?)/, CONTENT);
	}

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
	
	tok: function(type, val){
		return {
			type: type
			,line: this.lineno
			,chr: this.charno
			,val: val
			,toString: function(){
				return '[' + this.type + ' (' + this.line + ',' + this.chr + '): ' + this.val + ']';
			}
		};
	}
	
	,scan: function(regexp, type){
		var captures, token;
		if (captures = regexp.exec(this.input)) {
			this.consume(captures[0].length);
			
			token = this.tok(type, captures[1]);
			this.charno += captures[0].length;
			return token;
		}
	}
	
	,spew: function(str){
		this.input = str + this.input;
		this.charno -= str.length;
	}

	,consume: function(len){
		this.input = this.input.substr(len);
	}

	,spewIf: function(tok, ifStr){
		var parts;

		if(tok){
			parts = tok.val.split(ifStr);

			if(parts.length > 1){
				tok.val = parts.shift();
				this.spew(ifStr + parts.join(ifStr));
			}
		}
		
		return tok;
	}

	,advance: function(){
		return this.next();
	}

	,next: function() {

		var i, name, test, result;

		for(i = 0; i < TESTS.length; i += 2){
			test = TESTS[i+1];
			test.displayName = TESTS[i];

			if(typeof test === 'function'){
				// assume complex callback
				result = test.call(this);
			}

			if(typeof test.test === 'function'){
				// assume regex
				result = this.scan(test, TESTS[i]);
			}

			if( result ){
				return result;
			}
		}
	}
}



