(function(root){

// this pattern and basic lexer code is taken from the Jade lexer

var VLexer = function Lexer(str){
	this.tokens = [];
	this.input = str.replace(/\r\n|\r/g, '\n');
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
			,char: this.charno
			,val: val
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

	,spewIf: function(tok, ifTok){
		var ifSplit

		if(tok){
			ifSplit = tok.val.split(ifTok);

			if(ifSplit.length > 1){
				tok.val = ifSplit.shift();
				this.spew('@' + ifSplit.join(''));
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
			
			|| this.GT()
			|| this.PERIOD()
			|| this.NEWLINE()
			|| this.WHITESPACE()
			|| this.KEYWORD()
			|| this.IDENTIFIER()
			|| this.CONTENT()
	}

	,deferred: function() {
		return this.deferredTokens.length 
			&& this.deferredTokens.shift();
	}

	,stashed: function() {
		return this.stash.length
			&& this.stash.shift();
	}
	
	,AT: function(){
		return this.scan(/^(@)/, this.tks.AT);
	}
	,AT_COLON: function(){
		return this.scan(/^@\:/, this.tks.AT_COLON);
	}
	,AT_STAR_OPEN: function(){
		return this.scan(/^(@\*)/, this.tks.AT_STAR_OPEN);
	}
	,AT_STAR_CLOSE: function(){
		return this.scan(/^(\*@)/, this.tks.AT_STAR_CLOSE);
	}
	,PAREN_OPEN: function(){
		return this.scan(/^(\()/, this.tks.PAREN_OPEN);
	}
	,PAREN_CLOSE: function(){
		return this.scan(/^(\))/, this.tks.PAREN_CLOSE);
	}
	,BRACE_OPEN: function(){
		return this.scan(/^(\{)/, this.tks.BRACE_OPEN);
	}
	,BRACE_CLOSE: function(){
		return this.scan(/^(\})/, this.tks.BRACE_CLOSE);
	}
	,GT: function(){
		return this.scan(/^(>)/, this.tks.GT);
	}
	,HARD_PAREN_OPEN: function(){
		return this.scan(/^(\[)/, this.tks.HARD_PAREN_OPEN);
	}
	,HARD_PAREN_CLOSE: function(){
		return this.scan(/^(\])/, this.tks.HARD_PAREN_CLOSE);
	}
	,TEXT_TAG_OPEN: function(){
		return this.scan(/^(<text>)/, this.tks.TEXT_TAG_OPEN);
	}
	,TEXT_TAG_CLOSE: function(){
		return this.scan(/^(<\/text>)/, this.tks.TEXT_TAG_CLOSE);
	}
	,HTML_TAG_SELFCLOSE: function(){
		return this.spewIf(this.scan(/^(<[^>]+?\/>)/, this.tks.HTML_TAG_SELFCLOSE), '@');
	}
	,HTML_TAG_OPEN: function(){
		return this.spewIf(this.scan(/^(<[^\/ >]+?[^>]*?>)/, this.tks.HTML_TAG_OPEN), '@');
	} 
	,HTML_TAG_CLOSE: function(){
		return this.spewIf(this.scan(/^(<\/[^>\b]+?>)/, this.tks.HTML_TAG_CLOSE), '@');
	}
	,KEYWORD: function(){
		return this.scan(/^(case|catch|do|else|finally|for|function|goto|if|instanceof|return|switch|try|typeof|var|while|with)/, this.tks.KEYWORD);
	}
	,IDENTIFIER: function(){
		return this.scan(/^([_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*)/, this.tks.IDENTIFIER);
	}
	,PERIOD: function(){
		return this.scan(/^(\.)/, this.tks.PERIOD);
	}
	,EMAIL: function(){
		return this.scan(/^([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})\b/, this.tks.EMAIL);
	}
	,CONTENT: function(){
		return this.scan(/^([^\s})@.]+?)/, this.tks.CONTENT);
	}
	,WHITESPACE: function(){
		return this.scan(/^(\s+)/, this.tks.WHITESPACE);
	}
	,NEWLINE: function(){
		var token = this.scan(/^(\n)/, this.tks.NEWLINE);
		if(token){
			this.lineno++;
			this.charno = 0;
		}
		return token;
	}
	
	,tks: {
		 AT: 'AT'
		,AT_STAR_OPEN: 'AT_STAR_OPEN'
		,AT_STAR_CLOSE: 'AT_STAR_CLOSE'
		,AT_COLON: 'AT_COLON'
		,EMAIL: 'EMAIL'
		,PAREN_OPEN: 'PAREN_OPEN'
		,PAREN_CLOSE: 'PAREN_CLOSE'
		,BRACE_OPEN: 'BRACE_OPEN'
		,BRACE_CLOSE: 'BRACE_CLOSE'
		,GT: 'GT'
		,HARD_PAREN_OPEN: 'HARD_PAREN_OPEN'
		,HARD_PAREN_CLOSE: 'HARD_PAREN_CLOSE'
		,TEXT_TAG_OPEN: 'TEXT_TAG_OPEN'
		,TEXT_TAG_CLOSE: 'TEXT_TAG_CLOSE'
		,HTML_TAG_SELFCLOSE: 'HTML_TAG_SELFCLOSE'
		,HTML_TAG_OPEN: 'HTML_TAG_OPEN'
		,HTML_TAG_CLOSE: 'HTML_TAG_CLOSE'
		,KEYWORD: 'KEYWORD'
		,IDENTIFIER: 'IDENTIFIER'
		,PERIOD: 'PERIOD'
		,CONTENT: 'CONTENT'
		,WHITESPACE: 'WHITESPACE'
		,NEWLINE: 'NEWLINE'
	}
};

if(typeof module !== 'undefined' && module.exports){
	module["exports"] = VLexer;
} else {
	root["vash"] = root["vash"] || {};
	root["vash"].VLexer = VLexer;
}

})(this);




