/*jshint strict:false, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

// This pattern and basic lexer code are taken from the Jade lexer:
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
		return this.EMAIL()
			|| this.AT_STAR_OPEN()
			|| this.AT_STAR_CLOSE()

			|| this.AT_COLON()
			|| this.AT()
			
			|| this.FAT_ARROW()
			|| this.PAREN_OPEN()
			|| this.PAREN_CLOSE()
			
			|| this.HARD_PAREN_OPEN()
			|| this.HARD_PAREN_CLOSE()
			
			|| this.BRACE_OPEN()
			|| this.BRACE_CLOSE()
			
			|| this.TEXT_TAG_OPEN()
			|| this.TEXT_TAG_CLOSE()
			
			|| this.HTML_TAG_SELFCLOSE()
			|| this.HTML_TAG_OPEN()
			|| this.HTML_TAG_CLOSE()
			
			|| this.PERIOD()
			|| this.NEWLINE()
			|| this.WHITESPACE()
			|| this.FUNCTION()
			|| this.KEYWORD()
			|| this.HTML_RAW()
			|| this.IDENTIFIER()

			|| this.OPERATOR()
			|| this.ASSIGN_OPERATOR()
			|| this.LOGICAL()

			|| this.BACKSLASH()
			|| this.DOUBLE_QUOTE()
			|| this.SINGLE_QUOTE()

			|| this.NUMERIC_CONTENT()
			|| this.CONTENT();
	}

	
	,AT: function(){
		return this.scan(/^(@)/, AT);
	}
	,AT_COLON: function(){
		return this.scan(/^@\:/, AT_COLON);
	}
	,AT_STAR_OPEN: function(){
		return this.scan(/^(@\*)/, AT_STAR_OPEN);
	}
	,AT_STAR_CLOSE: function(){
		return this.scan(/^(\*@)/, AT_STAR_CLOSE);
	}
	,PAREN_OPEN: function(){
		return this.scan(/^(\()/, PAREN_OPEN);
	}
	,PAREN_CLOSE: function(){
		return this.scan(/^(\))/, PAREN_CLOSE);
	}
	,BRACE_OPEN: function(){
		return this.scan(/^(\{)/, BRACE_OPEN);
	}
	,BRACE_CLOSE: function(){
		return this.scan(/^(\})/, BRACE_CLOSE);
	}
	,HARD_PAREN_OPEN: function(){
		return this.scan(/^(\[)/, HARD_PAREN_OPEN);
	}
	,HARD_PAREN_CLOSE: function(){
		return this.scan(/^(\])/, HARD_PAREN_CLOSE);
	}
	,TEXT_TAG_OPEN: function(){
		return this.scan(/^(<text>)/, TEXT_TAG_OPEN);
	}
	,TEXT_TAG_CLOSE: function(){
		return this.scan(/^(<\/text>)/, TEXT_TAG_CLOSE);
	}
	,HTML_TAG_SELFCLOSE: function(){
		return this.spewIf(this.scan(/^(<[^>]+?\/>)/, HTML_TAG_SELFCLOSE), '@');
	}
	,HTML_TAG_OPEN: function(){
		return this.spewIf(this.scan(/^(<[^\/ >]+?[^>]*?>)/, HTML_TAG_OPEN), '@');
	}
	,HTML_TAG_CLOSE: function(){
		return this.spewIf(this.scan(/^(<\/[^>\b]+?>)/, HTML_TAG_CLOSE), '@');
	}
	,FAT_ARROW: function(){
		return this.scan(/^(\(.*?\)?\s*?=>)/, FAT_ARROW);
	}
	,FUNCTION: function(){
		return this.scan(/^(function)(?![\d\w])/, FUNCTION);
	}
	,KEYWORD: function(){
		return this.scan(/^(case|catch|do|else|finally|for|function|goto|if|instanceof|return|switch|try|typeof|var|while|with)(?![\d\w])/, KEYWORD);
	}
	,IDENTIFIER: function(){
		return this.scan(/^([_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*)/, IDENTIFIER);
	}
	,HTML_RAW: function(){
		return this.scan(/^(vash\.raw)(?![\d\w])/, HTML_RAW);
	}
	,PERIOD: function(){
		return this.scan(/^(\.)/, PERIOD);
	}
	,EMAIL: function(){
		return this.scan(/^([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})\b/, EMAIL);
	}
	,ASSIGN_OPERATOR: function(){
		return this.scan(/^(\|=|\^=|&=|>>>=|>>=|<<=|-=|\+=|%=|\/=|\*=|=)/, ASSIGN_OPERATOR);
	}
	,OPERATOR: function(){
		return this.scan(/^(===|!==|==|!==|>>>|<<|>>|>=|<=|>|<|\+|-|\/|\*|\^|%|\:|\?)/, OPERATOR);
	}
	,LOGICAL: function(){
		return this.scan(/^(&&|\|\||&|\||\^)/, LOGICAL);
	}
	,SINGLE_QUOTE: function(){
		return this.scan(/^(')/, SINGLE_QUOTE)
	}
	,DOUBLE_QUOTE: function(){
		return this.scan(/^(")/, DOUBLE_QUOTE)
	}
	,BACKSLASH: function(){
		return this.scan(/^(\\)/, BACKSLASH)
	}
	,NUMERIC_CONTENT: function(){
		return this.scan(/^([0-9]+)/, NUMERIC_CONTENT);
	}
	,CONTENT: function(){
		return this.scan(/^([^\s})@.]+?)/, CONTENT);
	}
	,WHITESPACE: function(){
		return this.scan(/^(\s)/, WHITESPACE);
	}
	,NEWLINE: function(){
		var token = this.scan(/^(\n)/, NEWLINE);
		if(token){
			this.lineno++;
			this.charno = 0;
		}
		return token;
	}
	,EOF: function(){
		return this.scan(/^$/, EOF);
	}
}

var  AT = 'AT'
	,AT_STAR_OPEN = 'AT_STAR_OPEN'
	,AT_STAR_CLOSE = 'AT_STAR_CLOSE'
	,AT_COLON = 'AT_COLON'
	,EMAIL = 'EMAIL'
	,PAREN_OPEN = 'PAREN_OPEN'
	,PAREN_CLOSE = 'PAREN_CLOSE'
	,BRACE_OPEN = 'BRACE_OPEN'
	,BRACE_CLOSE = 'BRACE_CLOSE'
	,HARD_PAREN_OPEN = 'HARD_PAREN_OPEN'
	,HARD_PAREN_CLOSE = 'HARD_PAREN_CLOSE'
	,TEXT_TAG_OPEN = 'TEXT_TAG_OPEN'
	,TEXT_TAG_CLOSE = 'TEXT_TAG_CLOSE'
	,HTML_TAG_SELFCLOSE = 'HTML_TAG_SELFCLOSE'
	,HTML_TAG_OPEN = 'HTML_TAG_OPEN'
	,HTML_TAG_CLOSE = 'HTML_TAG_CLOSE'
	,KEYWORD = 'KEYWORD'
	,FUNCTION = 'FUNCTION'
	,FAT_ARROW = 'FAT_ARROW'
	,IDENTIFIER = 'IDENTIFIER'
	,PERIOD = 'PERIOD'
	,ASSIGN_OPERATOR = 'ASSIGN_OPERATOR'
	,SINGLE_QUOTE = 'SINGLE_QUOTE'
	,DOUBLE_QUOTE = 'DOUBLE_QUOTE'
	,BACKSLASH = 'BACKSLASH'
	,NUMERIC_CONTENT = 'NUMERIC_CONTENT'
	,OPERATOR = 'OPERATOR'
	,LOGICAL = 'LOGICAL'
	,CONTENT = 'CONTENT'
	,WHITESPACE = 'WHITESPACE'
	,NEWLINE = 'NEWLINE'
	,EOF = 'EOF'
	,HTML_RAW = 'HTML_RAW';

VLexer.pairs = {
	 AT_STAR_OPEN: AT_STAR_CLOSE
	,PAREN_OPEN: PAREN_CLOSE
	,BRACE_OPEN: BRACE_CLOSE
	,HARD_PAREN_OPEN: HARD_PAREN_CLOSE
	,DOUBLE_QUOTE: DOUBLE_QUOTE
	,SINGLE_QUOTE: SINGLE_QUOTE
};