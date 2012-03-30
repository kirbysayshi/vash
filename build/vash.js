/*jshint strict:true, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

/**
 * Vash - JavaScript Template Parser
 *
 * https://github.com/kirbysayshi/vash
 *
 * Copyright (c) 2012 Andrew Petersen
 * MIT License (LICENSE)
 */
(function(vash){

	// this pattern was inspired by LucidJS,
	// https://github.com/RobertWHurst/LucidJS/blob/master/lucid.js

	typeof define === 'function' && define.amd
		? define(vash) // AMD
		: typeof module === 'object' && module.exports
			? module.exports = vash // NODEJS
			: window['vash'] = vash // BROWSER

})(function(exports){

	exports["version"] = "0.4.1-581";

	exports["config"] = {
		 "useWith": false
		,"modelName": "model"
		,"debug": false
		,"debugParser": false
		,"debugCompiler": false
	};

	/************** Begin injected code from build script */
	
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


function Stack(){
	this._stack = []
}

Stack.prototype = {
	push: function(obj){
		this._stack.push(obj);
		return this;
	}
	,pop: function(){
		if(this._stack.length > 0)
			return this._stack.pop();
		else 
			return null //throw new Error('Stack Underflow');
	}
	,peek: function(){
		if(this._stack.length > 0){
			return this._stack[ this._stack.length - 1 ]
		} else {
			return null;
		}
	}
	,count: function(){
		return this._stack.length;
	}
	,raw: function(){
		return this._stack;
	}
};

function VParser(str, options){
	
	options = options || {}

	this.lex = new VLexer(str);
	this.tks = VLexer.tks;
	
	this.blockStack = new Stack();
	this.mode = VParser.modes.MKP;
	
	this.buffer = [];
	this.buffers = [];

	this.debug = options.debugParser;
	this.consumedTokens = [];

	if(typeof str !== 'string' || str.length === 0)
		throw this.exceptionFactory(new Error, 'INVALIDINPUT', str);
}

VParser.modes = { MKP: "MARKUP", BLK: "BLOCK", EXP: "EXPRESSION" };

VParser.prototype = {

	parse: function(){
		var curr, i, len, block, orderedTokens, topMsg = 'Top 30 tokens ordered by TOUCHING';

		while( (curr = this.lex.advance()) ){
			this.debug && console.log(this.mode, curr.type, curr, curr.val);
			
			if(this.mode === VParser.modes.MKP){
				this._handleMKP(curr);
				continue;
			}
			
			if(this.mode === VParser.modes.BLK){
				this._handleBLK(curr);
				continue;
			}
			
			if(this.mode === VParser.modes.EXP){
				this._handleEXP(curr);	
				continue;
			}
		}

		this._endMode(VParser.modes.MKP);

		for(i = 0, len = this.blockStack.count(); i < len; i++){
			block = this.blockStack.pop();
			
			// only throw errors if there is an unclosed block
			if(block.type === VParser.modes.BLK)
				throw this.exceptionFactory(new Error, 'UNMATCHED', block.tok);
		}
		
		if(this.debug){
			orderedTokens = this.consumedTokens.sort(function(a,b){ return b.touched - a.touched });
			(console['groupCollapsed'] 
				? console['groupCollapsed'](topMsg)
				: console['group'] 
					? console['group'](topMsg) 
					: console.log(topMsg));
			orderedTokens.slice(0, 30).forEach(function(tok){ console.log( tok.touched, tok ) });
			console['groupEnd'] && console['groupEnd']();
		}
		
		return this.buffers;
	}
	
	,exceptionFactory: function(e, type, tok){

		// second param is either a token or string?

		//var context = this.lex.originalInput.split('\n')[tok.line - 1].substring(0, tok.chr + 1);
		var context = '', i;

		for(i = 0; i < this.buffers.length; i++){
			context += this.buffers[i].value;
		}

		if(context.length > 100){
			context = context.substring( context.length - 100 );
		}

		switch(type){

			case 'UNMATCHED':
				e.name = "UnmatchedCharacterError";

				if(tok){
					e.message = 'Unmatched ' + tok.type
						+ ' near: "' + context + '"'
						+ ' at line ' + tok.line
						+ ', character ' + tok.chr
						+ '. Value: ' + tok.val;
					e.lineNumber = tok.line;
				}

				break;

			case 'INVALIDINPUT':
				e.name = "InvalidParserInputError";
				
				if(tok){
					this.message = 'Asked to parse invalid or non-string input: '
						+ tok;
				}
				
				this.lineNumber = 0;
				break;

		}

		return e;
	}

	,_useToken: function(tok){
		this.debug && this.consumedTokens.push(tok);
		this.buffer.push( tok );
	}
	
	,_useTokens: function(toks){
		for(var i = 0, len = toks.length; i < len; i++){
			this.debug && this.consumedTokens.push(toks[i]);
			this.buffer.push( toks[i] );
		}
	}

	,_advanceUntilNot: function(untilNot){
		var curr, next, tks = [];

		while( next = this.lex.lookahead(1) ){
			if(next.type === untilNot){
				curr = this.lex.advance();
				tks.push(curr);
			} else {
				break;
			}
		}
		
		return tks;
	}

	,_advanceUntilMatched: function(curr, start, end){
		var next = curr
			,nstart = 0
			,nend = 0
			,tks = [];
		
		while(next){
			if(next.type === start) nstart++;
			if(next.type === end) nend++;
			
			tks.push(next);
			
			if(nstart === nend) break;
			next = this.lex.advance();
			if(!next) throw this.exceptionFactory(new Error, 'UNMATCHED', curr);
		}
		
		return tks;
	}
	
	// allows a mode switch without closing the current buffer
	,_retconMode: function(correctMode){
		this.mode = correctMode;
	}

	,_endMode: function(nextMode){
		if(this.buffer.length !== 0){

			// mark all tokens with their appropriate mode
			// and add to flat list of global tokens
			for(var i = 0; i < this.buffer.length; i++){
				this.buffer[i].mode = this.mode;
				this.buffers.push( this.buffer[i] );
			}

			this.buffer.length = 0;
		}

		this.mode = nextMode || VParser.modes.MKP;
	}
	
	,_handleMKP: function(curr){
		var  next = this.lex.lookahead(1)
			,ahead = this.lex.lookahead(2)
			,block = null
			,tagName = null
			,tempStack = [];
		
		switch(curr.type){
			
			case this.tks.AT_STAR_OPEN:
				this._advanceUntilMatched(curr, this.tks.AT_STAR_OPEN, this.tks.AT_STAR_CLOSE);
				break;
			
			case this.tks.AT:
				if(next) switch(next.type){
					
					case this.tks.PAREN_OPEN:
					case this.tks.IDENTIFIER:
					case this.tks.HTML_RAW:
						this._endMode(VParser.modes.EXP);
						break;
					
					case this.tks.KEYWORD:
					case this.tks.FUNCTION:
					case this.tks.BRACE_OPEN:
					case this.tks.BLOCK_GENERATOR:
						this._endMode(VParser.modes.BLK);
						break;
					
					default:
						this._useToken(this.lex.advance());

						break;
				}
				break;		
			
			case this.tks.BRACE_OPEN:
				this._endMode(VParser.modes.BLK);
				this.lex.defer(curr);
				break;

			case this.tks.BRACE_CLOSE:
				this._endMode(VParser.modes.BLK);
				this.lex.defer(curr);
				break;
			
			case this.tks.TEXT_TAG_OPEN:
			case this.tks.HTML_TAG_OPEN:
				tagName = curr.val.match(/^<([^\/ >]+)/i); 
				
				if(tagName === null && next && next.type === this.tks.AT && ahead)
					tagName = ahead.val.match(/(.*)/); // HACK for <@exp>

				this.blockStack.push({ type: VParser.modes.MKP, tag: tagName[1], tok: curr });
				if(this.tks.HTML_TAG_OPEN === curr.type) this._useToken(curr);
				break;
			
			case this.tks.TEXT_TAG_CLOSE:
			case this.tks.HTML_TAG_CLOSE:
				tagName = curr.val.match(/^<\/([^>]+)/i); 
				
				if(tagName === null && next && next.type === this.tks.AT && ahead)
					tagName = ahead.val.match(/(.*)/); // HACK for </@exp>
				
				block = this.blockStack.pop();
				
				while(block !== null){
					if(block.type === VParser.modes.MKP && tagName[1] === block.tag){
						break;
					}
					tempStack.push(block);
					block = this.blockStack.pop();
				}
				
				if(block === null){
					// couldn't find opening tag
					throw this.exceptionFactory(new Error, 'UNMATCHED', curr);
				}
				
				// put all blocks back except for found
				this.blockStack.raw().push.apply(this.blockStack.raw(), tempStack);
				
				if(this.tks.HTML_TAG_CLOSE === curr.type) this._useToken(curr);

				block = this.blockStack.peek();

				if(
					block !== null && block.type === VParser.modes.BLK 
					&& (next.type === this.tks.WHITESPACE || next.type === this.tks.NEWLINE) 
				){
					this._useTokens(this._advanceUntilNot(this.tks.WHITESPACE));
					this._endMode(VParser.modes.BLK);
				}
				break;

			default:
				this._useToken(curr);
				break;
		}
		
	}
	
	,_handleBLK: function(curr){
		
		var next = this.lex.lookahead(1)
			,block = null
			,tempStack = [];
		
		switch(curr.type){
			
			case this.tks.AT:
				switch(next.type){
					
					case this.tks.AT:
						break;
					
					default:
						this.lex.defer(curr);
						this._endMode(VParser.modes.MKP);
						break;
				}
				break;
			
			case this.tks.AT_COLON:
				this._endMode(VParser.modes.MKP);
				break;
			
			case this.tks.TEXT_TAG_OPEN:
			case this.tks.TEXT_TAG_CLOSE:
			case this.tks.HTML_TAG_SELFCLOSE:
			case this.tks.HTML_TAG_OPEN:
			case this.tks.HTML_TAG_CLOSE:
				this._endMode(VParser.modes.MKP);
				this.lex.defer(curr);
				break;
			
			case this.tks.BRACE_OPEN:
			case this.tks.PAREN_OPEN:
				this.blockStack.push({ type: VParser.modes.BLK, tok: curr });
				this._useToken(curr);
				break;
			
			case this.tks.BRACE_CLOSE:
			case this.tks.PAREN_CLOSE:
				block = this.blockStack.pop();
				
				// try to find a block of type BLK. save non-BLKs for later...
				while(block !== null && block.type !== VParser.modes.BLK ){
					tempStack.push(block);
					block = this.blockStack.pop();
				}
				
				// put non-BLKs back in
				this.blockStack.raw().push.apply(this.blockStack.raw(), tempStack);
				
				if(block === null || (block !== null && block.type !== VParser.modes.BLK))
					throw this.exceptionFactory(new Error, 'UNMATCHED', curr);

				this._useToken(curr);
				
				// check for: } KEYWORD
				this._advanceUntilNot(this.tks.WHITESPACE);
				next = this.lex.lookahead(1);
				if( next && (next.type === this.tks.KEYWORD || next.type === this.tks.FUNCTION) )
					break;

				block = this.blockStack.peek();
				if(block !== null && block.type === VParser.modes.MKP) 
					this._endMode(VParser.modes.MKP);
					
				break;

			case this.tks.WHITESPACE:
				this._useToken(curr);
				this._advanceUntilNot(this.tks.WHITESPACE);
				break;

			default:
				this._useToken(curr);
				break;
		}
		
	}
	
	,_handleEXP: function(curr){
		
		var ahead = null;
		
		switch(curr.type){
			
			case this.tks.KEYWORD:
			case this.tks.FUNCTION:	
				this._endMode(VParser.modes.BLK);
				this.lex.defer(curr);
				break;
			
			case this.tks.IDENTIFIER:
			case this.tks.HTML_RAW:
				this._useToken(curr);		
				break;
			
			case this.tks.HARD_PAREN_OPEN:
				this._useTokens(this._advanceUntilMatched(curr, this.tks.HARD_PAREN_OPEN, this.tks.HARD_PAREN_CLOSE));
				ahead = this.lex.lookahead(1);
				if(ahead && ahead.type === this.tks.IDENTIFIER){
					this._endMode(VParser.modes.MKP);
				}
				break;
			
			case this.tks.PAREN_OPEN:
				ahead = this.lex.lookahead(1);
				if(ahead && (ahead.type === this.tks.KEYWORD || ahead.type === this.tks.FUNCTION) ){
					this.lex.defer(curr);
					this._retconMode(VParser.modes.BLK);
				} else {
					this._useTokens(this._advanceUntilMatched(curr, this.tks.PAREN_OPEN, this.tks.PAREN_CLOSE));
					ahead = this.lex.lookahead(1);
					if(ahead && ahead.type === this.tks.IDENTIFIER){
						this._endMode(VParser.modes.MKP);
					}	
				}
				break;
			
			case this.tks.PERIOD:
				ahead = this.lex.lookahead(1);
				if(
					ahead && (ahead.type === this.tks.IDENTIFIER 
						|| ahead.type === this.tks.KEYWORD 
						|| ahead.type === this.tks.FUNCTION)
				) {
					this._useToken(curr);
				} else {
					this._endMode(VParser.modes.MKP);
					this.lex.defer(curr);
				}
				break;
			
			default:
				// assume end of expression
				this._endMode(VParser.modes.MKP);
				this.lex.defer(curr);
				break;
				
		}
		
	}
	
}


function VCompiler(tokens, originalMarkup){
	this.tokens = tokens;
	this.originalMarkup = originalMarkup;
	this.symbolTable = {};
}

var VCP = VCompiler.prototype;


VCP.generate = function(options){

	this.buildSymbolTable();
	this.insertHTMLExpressionEscape(options);	
	
	//this.insertFunctionBuffering();
	this.mergeTokens();
}

VCP.assemble = function(options){
	// actually turn into a function

	var i, tok, lines = []
		,reQuote = /[\"']/gi
		,reLineBreak = /[\n\r]/gi
		,body
		,func;

	// suprisingly: http://jsperf.com/array-index-vs-push
	lines.push("var __vout = []; \n");

	options.debug && lines.push('var __vline = 0, __vchar = 0;');

	for(i = 0; i < this.tokens.length; i++){
		tok = this.tokens[i];

		options.debugCompiler && console.log(tok);
		options.debug && lines.push( '__vline = ' + tok.line + '; __vchar = ' + tok.chr + ';' )

		// normalize in prep for eval
		tok.val = tok.val.replace(reQuote, '\"');

		if(tok.mode === VParser.modes.MKP){
			lines.push( '__vout.push(\'' + tok.val.replace(reLineBreak, '\\n') + '\');' )
		}

		if(tok.mode === VParser.modes.BLK){
			// Nuke new lines, otherwise causes parse error
			lines.push( tok.val.replace(reLineBreak, '') )
		}

		if(tok.mode === VParser.modes.EXP){
			lines.push( '__vout.push(' + tok.val.replace(reLineBreak, '\\n') + ');' )
		}
	}

	if(options.useWith === true){
		lines.unshift( "with(" + options.modelName + " || {}){ \n" );
		lines.push("}");
	}

	if(options.debug){
		lines.unshift( 'try { \n' );
		lines.push( '} catch(e){ ('
			, VCP.reportError.toString()
			,')(e, __vline, __vchar, '
			,'"' + this.originalMarkup
				.replace(reLineBreak, '!LB!')
				.replace(/(["'])/g, '\\$1') + '"'
			,') } \n' )
	}

	lines.push('return __vout.join(\'\');');
	body = lines.join('');
	options.debugCompiler && console.log(body);

	try {
		func = new Function(options.modelName, body);
	} catch(e){
		e.message += ' -> ' + body;
		throw e;	
	}

	return func;
}

VCP.mergeTokens = function(){
	var  all = []
		,currentCondenser = this.tokens[0]
		,tok
		,i;

	for(i = 1; i < this.tokens.length; i++){
		tok = this.tokens[i];

		if(currentCondenser.mode === tok.mode){
			currentCondenser.val += tok.val;
			currentCondenser.type += ' ' + tok.type;
		} else {
			all.push(currentCondenser);
			currentCondenser = tok;
		}
	}

	all.push(currentCondenser);

	this.tokens = all;
	return this.tokens;
}

// transform functions

VCP.insertHTMLExpressionEscape = function(options){
	var i
		,tok
		,nextNotExp
		,edgeCase = false
		,nextOpenParen
		,nextCloseParen;

	for(i = 0; i < this.tokens.length; i++){
		tok = this.tokens[i];
		nextNotExp = -1;

		if(tok.mode !== VParser.modes.EXP) continue;

		if(tok.type === VLexer.tks.HTML_RAW){
			tok.val = '';

			nextOpenParen = this.deeperIndexOf(this.tokens, 'type', VLexer.tks.PAREN_OPEN, i);
			nextCloseParen = this.findMatchingIndex(this.tokens, VLexer.tks.PAREN_OPEN, VLexer.tks.PAREN_CLOSE, nextOpenParen);

			this.tokens[nextOpenParen].val = '';
			this.tokens[nextCloseParen].val = '';
			i = nextCloseParen; // skip i ahead
			continue;
		}

		if(this.symbolTable[tok.val] === true) {
			nextNotExp = Math.max(
				 this.tokens.length - 1
				,this.deeperIndexOfNot(this.tokens, 'mode', VParser.modes.EXP, i) - 1);
			i = nextNotExp; // skip i ahead, remembering auto inc
			continue; // named helper function, do not escape
		}

		if(options.htmlEscape === false) continue;

		nextNotExp = this.deeperIndexOfNot(this.tokens, 'mode', VParser.modes.EXP, i);

		// EDGE CASE!
		if(nextNotExp === -1 && this.tokens.length === 1){
			nextNotExp = 1;
			edgeCase = true;
		}

		this.tokens.splice(i, 0, { 
			mode: VParser.modes.EXP
			,type: 'EXP_GENERATED'
			,touched: 1
			,val: '(' 
			,line: tok.line
			,chr: tok.chr
		});

		this.tokens.splice(nextNotExp + 1, 0, { 
			mode: VParser.modes.EXP
			,type: 'EXP_GENERATED'
			,touched: 1
			,val: ").toString()"
				+ ".replace(/&(?!\w+;)/g, '&amp;')"
				+ ".replace(/</g, '&lt;')"
				+ ".replace(/>/g, '&gt;')"
				+ ".replace(/\"/g, '&quot;')"
			,line: this.tokens[nextNotExp].line
			,chr: this.tokens[nextNotExp].chr
		});

		if(edgeCase == false){
			i = nextNotExp + 1;	
		} else {
			i = nextNotExp + 2;
		}
		
	}

	return this.tokens;
}

/*VCP.insertFunctionBuffering = function(){
	var i, openBraceAt, closingBraceAt, tok;

	for(i = 0; i < this.tokens.length; i++){

		tok = this.tokens[i];
		openBraceAt = 0;

		if(tok.mode !== VParser.modes.BLK || tok.type !== VLexer.tks.FUNCTION) continue;

		openBraceAt = this.deeperIndexOf(this.tokens, 'type', VLexer.tks.BRACE_OPEN, i);
		closingBraceAt = this.findMatchingIndex(this.tokens, VLexer.tks.BRACE_OPEN, VLexer.tks.BRACE_CLOSE, openBraceAt);

		if( openBraceAt && closingBraceAt ){

			//// plus 1 because we want it after the brace
			//this.tokens.splice(openBraceAt + 1, 0, { 
			//	mode: VParser.modes.BLK
			//	,type: 'BLK_GENERATED'
			//	,touched: 1
			//	,val: 'var __vout_cache = __vout, __vout = '';'
			//	,line: this.tokens[openBraceAt + 1].line
			//	,chr: this.tokens[openBraceAt + 1].chr
			//});

			//// plus 1 because thee previous op has increased the index
			//this.tokens.splice(closingBraceAt + 1, 0, { 
			//	mode: VParser.modes.BLK
			//	,type: 'BLK_GENERATED'
			//	,touched: 1
			//	,val: '__vout += __vout_inner, );'
			//	,line: this.tokens[closingBraceAt].line
			//	,chr: this.tokens[closingBraceAt].chr
			//});
		}
	}

	return this.tokens;
}*/

VCP.buildSymbolTable = function(){
	this.symbolTable = {};

	var i, tok, nextIdentifier, nextOpenParen;

	for(i = 0; i < this.tokens.length; i++){
		tok = this.tokens[i];

		if(tok.type === VLexer.tks.FUNCTION){
			nextIdentifier = this.deeperIndexOf( this.tokens, 'type', VLexer.tks.IDENTIFIER, i );
			nextOpenParen = this.deeperIndexOf( this.tokens, 'type', VLexer.tks.PAREN_OPEN, i );

			// anonymous function
			if(nextIdentifier > nextOpenParen) continue;

			this.symbolTable[ this.tokens[nextIdentifier].val ] = true;
		}
	}

	return this.symbolTable;
}


// Helper functions

VCP.deeperIndexOf = function(list, property, value, startAt){
	startAt = startAt || 0;

	var i, foundAt = -1;

	for(i = startAt; i < list.length; i++){
		if( list[i][property] === value ) {
			foundAt = i;
			break;
		}
	}

	return foundAt;
}

VCP.deeperIndexOfNot = function(list, property, value, startAt){
	startAt = startAt || 0;

	var i, foundAt = -1;

	for(i = startAt; i < list.length; i++){
		if( list[i][property] !== value ) {
			foundAt = i;
			break;
		}
	}

	return foundAt;
}

// expects a flat list of tokens
VCP.findMatchingIndex = function(list, startType, endType, startAt){
	var nstart = 0
		,nend = 0
		,i = startAt || 0
		,tok;

	for(; i < list.length; i++){
		tok = list[i];
		if(tok.type === startType) nstart++;
		if(tok.type === endType) nend++

		if(nstart === nend) break;
	}

	return i;
}

// runtime-esque

// Liberally modified from https://github.com/visionmedia/jade/blob/master/jade.js
VCP.reportError = function(e, lineno, chr, orig){

	var lines = orig.split('!LB!')
		,contextSize = 3
		,start = Math.max(0, lineno - contextSize)
		,end = Math.min(lines.length, lineno + contextSize);

	var contextStr = lines.slice(start, end).map(function(line, i, all){
		var curr = i + start + 1;

		return (curr === lineno ? '  > ' : '    ')
			+ curr 
			+ ' | '
			+ line;
	}).join('\n');

	e.message = 'Problem while rendering template at line ' 
		+ lineno + ', character ' + chr 
		+ '.\nOriginal message: ' + e.message + '.'
		+ '\nContext: \n\n' + contextStr + '\n\n';

	throw e;
}
	/************** End injected code from build script */

	exports["VLexer"] = VLexer;
	exports["VParser"] = VParser;
	exports["VCompiler"] = VCompiler;
	exports["compile"] = function compile(markup, options){

		var  p
			,c
			,cmp;

		options = options || {};
		options.useWith = options.useWith || exports.config.useWith;
		options.modelName = options.modelName || exports.config.modelName;
		options.debug = options.debug || exports.config.debug;
		options.debugParser = options.debugParser || exports.config.debugParser;
		options.debugCompiler = options.debugCompiler || exports.config.debugCompiler;

		p = new VParser(markup, options);
		p.parse();

		c = new VCompiler(p.buffers, p.lex.originalInput);
		c.generate(options);

		// Express support
		cmp = c.assemble(options);
		cmp.displayName = 'render';
		return cmp;
	};

	return exports;
}({}));
