
// This pattern and basic lexer code are taken from the Jade lexer:
// https://github.com/visionmedia/jade/blob/master/lib/lexer.js

function VLexer(str){
	this.tokens = [];
	this.input = this.originalInput = str.replace(/\r\n|\r/g, '\n');
	this.deferredTokens = [];
	this.stash = [];
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
			,touched: 0
		}
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
			tok.touched += 1;
			parts = tok.val.split(ifStr);

			if(parts.length > 1){
				tok.val = parts.shift();
				tok.touched += 1;
				this.spew(ifStr + parts.join(ifStr));
			}
		}
		
		return tok;
	}

	,advance: function(){
		return this.deferred()
			|| this.stashed()
			|| this.next();
	}

	,defer: function(tok){
		tok.touched += 1;
		this.deferredTokens.push(tok);
	}

	,lookahead: function(n){
		var fetch = n - this.stash.length;
		while (fetch-- > 0) this.stash.push(this.next());
		return this.stash[--n];
	}

	,next: function() {
		return this.EMAIL()
			|| this.AT_STAR_OPEN()
			|| this.AT_STAR_CLOSE()

			|| this.AT_COLON()
			|| this.AT()
			
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
			//|| this.BLOCK_GENERATOR()
			|| this.IDENTIFIER()
			|| this.CONTENT()
			//|| this.EOF()
	}

	,deferred: function() {

		var tok = this.deferredTokens.shift();

		if(tok){
			tok.touched += 1;
			return tok;
		} else {
			return false;
		}
	}

	,stashed: function() {
		
		var tok = this.stash.shift();

		if(tok) {
			tok.touched += 1;
			return tok;
		} else {
			return false;
		}
	}
	
	,AT: function(){
		return this.scan(/^(@)/, VLexer.tks.AT);
	}
	,AT_COLON: function(){
		return this.scan(/^@\:/, VLexer.tks.AT_COLON);
	}
	,AT_STAR_OPEN: function(){
		return this.scan(/^(@\*)/, VLexer.tks.AT_STAR_OPEN);
	}
	,AT_STAR_CLOSE: function(){
		return this.scan(/^(\*@)/, VLexer.tks.AT_STAR_CLOSE);
	}
	,PAREN_OPEN: function(){
		return this.scan(/^(\()/, VLexer.tks.PAREN_OPEN);
	}
	,PAREN_CLOSE: function(){
		return this.scan(/^(\))/, VLexer.tks.PAREN_CLOSE);
	}
	,BRACE_OPEN: function(){
		return this.scan(/^(\{)/, VLexer.tks.BRACE_OPEN);
	}
	,BRACE_CLOSE: function(){
		return this.scan(/^(\})/, VLexer.tks.BRACE_CLOSE);
	}
	,HARD_PAREN_OPEN: function(){
		return this.scan(/^(\[)/, VLexer.tks.HARD_PAREN_OPEN);
	}
	,HARD_PAREN_CLOSE: function(){
		return this.scan(/^(\])/, VLexer.tks.HARD_PAREN_CLOSE);
	}
	,TEXT_TAG_OPEN: function(){
		return this.scan(/^(<text>)/, VLexer.tks.TEXT_TAG_OPEN);
	}
	,TEXT_TAG_CLOSE: function(){
		return this.scan(/^(<\/text>)/, VLexer.tks.TEXT_TAG_CLOSE);
	}
	,HTML_TAG_SELFCLOSE: function(){
		return this.spewIf(this.scan(/^(<[^>]+?\/>)/, VLexer.tks.HTML_TAG_SELFCLOSE), '@');
	}
	,HTML_TAG_OPEN: function(){
		return this.spewIf(this.scan(/^(<[^\/ >]+?[^>]*?>)/, VLexer.tks.HTML_TAG_OPEN), '@');
	} 
	,HTML_TAG_CLOSE: function(){
		return this.spewIf(this.scan(/^(<\/[^>\b]+?>)/, VLexer.tks.HTML_TAG_CLOSE), '@');
	}
	,FUNCTION: function(){
		return this.scan(/^(function)(?![\d\w])/, VLexer.tks.FUNCTION);
	}
	,KEYWORD: function(){
		return this.scan(/^(case|catch|do|else|finally|for|function|goto|if|instanceof|return|switch|try|typeof|var|while|with)(?![\d\w])/, VLexer.tks.KEYWORD);
	}
	,IDENTIFIER: function(){
		return this.scan(/^([_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*)/, VLexer.tks.IDENTIFIER);
	}
	,HTML_RAW: function(){
		return this.scan(/^(vash\.raw)(?![\d\w])/, VLexer.tks.HTML_RAW);
	}
	//,BLOCK_GENERATOR: function(){
	//	return this.scan(/^(helper)(?![\d\w])/, VLexer.tks.BLOCK_GENERATOR);
	//}
	,PERIOD: function(){
		return this.scan(/^(\.)/, VLexer.tks.PERIOD);
	}
	,EMAIL: function(){
		return this.scan(/^([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})\b/, VLexer.tks.EMAIL);
	}
	,CONTENT: function(){
		return this.scan(/^([^\s})@.]+?)/, VLexer.tks.CONTENT);
	}
	,WHITESPACE: function(){
		return this.scan(/^(\s)/, VLexer.tks.WHITESPACE);
	}
	,NEWLINE: function(){
		var token = this.scan(/^(\n)/, VLexer.tks.NEWLINE);
		if(token){
			this.lineno++;
			this.charno = 0;
		}
		return token;
	}
	,EOF: function(){
		return this.scan(/^$/, VLexer.tks.EOF);
	}
}

VLexer.tks = {
	 AT: 'AT'
	,AT_STAR_OPEN: 'AT_STAR_OPEN'
	,AT_STAR_CLOSE: 'AT_STAR_CLOSE'
	,AT_COLON: 'AT_COLON'
	,EMAIL: 'EMAIL'
	,PAREN_OPEN: 'PAREN_OPEN'
	,PAREN_CLOSE: 'PAREN_CLOSE'
	,BRACE_OPEN: 'BRACE_OPEN'
	,BRACE_CLOSE: 'BRACE_CLOSE'
	,HARD_PAREN_OPEN: 'HARD_PAREN_OPEN'
	,HARD_PAREN_CLOSE: 'HARD_PAREN_CLOSE'
	,TEXT_TAG_OPEN: 'TEXT_TAG_OPEN'
	,TEXT_TAG_CLOSE: 'TEXT_TAG_CLOSE'
	,HTML_TAG_SELFCLOSE: 'HTML_TAG_SELFCLOSE'
	,HTML_TAG_OPEN: 'HTML_TAG_OPEN'
	,HTML_TAG_CLOSE: 'HTML_TAG_CLOSE'
	,KEYWORD: 'KEYWORD'
	,FUNCTION: 'FUNCTION'
	,IDENTIFIER: 'IDENTIFIER'
	,PERIOD: 'PERIOD'
	,CONTENT: 'CONTENT'
	,WHITESPACE: 'WHITESPACE'
	,NEWLINE: 'NEWLINE'
	,EOF: 'EOF'
	,HTML_RAW: 'HTML_RAW'
	//,BLOCK_GENERATOR: 'BLOCK_GENERATOR'
};
