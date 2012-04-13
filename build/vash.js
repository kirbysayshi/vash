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

	var vash = exports; // neccessary for nodejs references

	exports["version"] = "0.4.1-672";

	exports["config"] = {
		 "useWith": false
		,"modelName": "model"
		,"debug": false
		,"debugParser": false
		,"debugCompiler": false
	};

	/************** Begin injected code from build script */
	/*jshint strict:false, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

// This pattern and basic lexer code are taken from the Jade lexer:
// https://github.com/visionmedia/jade/blob/master/lib/lexer.js

function VLexer(str){
	//this.tokens = [];
	this.input = this.originalInput = str.replace(/\r\n|\r/g, '\n');
	//this.deferredTokens = [];
	//this.stash = [];
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
				return (this.mode ? this.mode : '') + '[' + this.type + ' (' + this.line + ',' + this.chr + '): ' + this.val + ']';
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
		/*return this.deferred()
			|| this.stashed()
			|| this.next();*/
	}

	/*,defer: function(tok){
		tok.touched += 1;
		this.deferredTokens.push(tok);
	}

	,lookahead: function(n){
		var fetch = n - this.stash.length;
		while (fetch-- > 0) this.stash.push(this.next());
		return this.stash[--n];
	}*/

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
			//|| this.BLOCK_GENERATOR()
			|| this.IDENTIFIER()

			|| this.OPERATOR()
			|| this.ASSIGN_OPERATOR()
			|| this.LOGICAL()

			|| this.DOUBLE_QUOTE()
			|| this.SINGLE_QUOTE()

			|| this.NUMERIC_CONTENT()
			|| this.CONTENT()
			//|| this.EOF()
	}

	/*,deferred: function() {

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
	}*/
	
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
	,FAT_ARROW: function(){
		return this.scan(/^(\(.*?\)?\s*?=>)/, VLexer.tks.FAT_ARROW);
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
	,ASSIGN_OPERATOR: function(){
		return this.scan(/^(\|=|\^=|&=|>>>=|>>=|<<=|-=|\+=|%=|\/=|\*=|=)/, VLexer.tks.ASSIGN_OPERATOR);
	}
	,OPERATOR: function(){
		return this.scan(/^(===|!==|==|!==|>>>|<<|>>|>=|<=|>|<|\+|-|\/|\*|\^|%|\:|\?)/, VLexer.tks.OPERATOR);
	}
	,LOGICAL: function(){
		return this.scan(/^(&&|\|\||&|\||\^)/, VLexer.tks.LOGICAL);
	}
	,SINGLE_QUOTE: function(){
		return this.scan(/^(\\?')/, VLexer.tks.SINGLE_QUOTE)
	}
	,DOUBLE_QUOTE: function(){
		return this.scan(/^(\\?")/, VLexer.tks.DOUBLE_QUOTE)
	}
	,NUMERIC_CONTENT: function(){
		return this.scan(/^([0-9]+)/, VLexer.tks.NUMERIC_CONTENT);
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
	,FAT_ARROW: 'FAT_ARROW'
	,IDENTIFIER: 'IDENTIFIER'
	,PERIOD: 'PERIOD'
	,ASSIGN_OPERATOR: 'ASSIGN_OPERATOR'
	,SINGLE_QUOTE: 'SINGLE_QUOTE'
	,DOUBLE_QUOTE: 'DOUBLE_QUOTE'
	,NUMERIC_CONTENT: 'NUMERIC_CONTENT'
	,OPERATOR: 'OPERATOR'
	,LOGICAL: 'LOGICAL'
	,CONTENT: 'CONTENT'
	,WHITESPACE: 'WHITESPACE'
	,NEWLINE: 'NEWLINE'
	,EOF: 'EOF'
	,HTML_RAW: 'HTML_RAW'
	//,BLOCK_GENERATOR: 'BLOCK_GENERATOR'
};

VLexer.pairs = {
	 AT_STAR_OPEN: VLexer.tks.AT_STAR_CLOSE
	,PAREN_OPEN: VLexer.tks.PAREN_CLOSE
	,BRACE_OPEN: VLexer.tks.BRACE_CLOSE
	,HARD_PAREN_OPEN: VLexer.tks.HARD_PAREN_CLOSE
	,DOUBLE_QUOTE: VLexer.tks.DOUBLE_QUOTE
	,SINGLE_QUOTE: VLexer.tks.SINGLE_QUOTE
};

function VAST(root){
	
	this.current = this.openNew( VParser.modes.PRG );
	this.rootNode = this.current;	
}

VAST.prototype.root = function(){
	this.current = this.rootNode;
	return this.rootNode;
}

VAST.prototype.useToken = function(tok){

	var method = this.current.closed() || this.current.children.length > 0
		? this.useAsStopper
		: this.useAsStarter;

	tok = vash.isArray(tok)
		? tok
		: [tok];

	for(var i = 0; i < tok.length; i++){
		method.call(this, tok[i]);
	}
}

VAST.prototype.useAsStarter = function(tok){
	this.current.starter.push(tok);
}

VAST.prototype.useAsStopper = function(tok){
	this.current.stopper.push(tok);
}

VAST.prototype.openNew = function(type, parent){
	var n = new VASTNode();
	n.type = type;
	n.parent = parent || this.current;

	return n;
}

VAST.prototype.openNewAsChild = function(type, tok, forceDuplicate){

	var n;

	if(this.current.closed()){
		this.openNewAsSibling(type, tok);
		return
	}

	if( forceDuplicate !== true
		&&this.current.children.length === 0 
		&& this.current.starter.length === 0
		&& this.current.stopper.length === 0
		&& this.current.type !== VParser.modes.PRG
	) {
		n = this.current;
		this.current.type = type;
	} else {
		n = this.openNew(type, this.current);	
		this.current.children.push(n);
		this.current = n;
	}

	tok && n.starter.push(tok);
}

VAST.prototype.openNewAsSibling = function(type, tok){
	var n = this.openNew(type, this.current.parent);
	tok && n.starter.push(tok);

	n.parent.children.push(n);
	this.current = n;
}

VAST.prototype.closeCurrent = function(){
	this.current = this.current.parent;
}

VAST.prototype.searchParentsFor = function( property, value ){
	var p = this.current;

	while(p && p.parent && p[property] !== value && (p = p.parent));

	if(p[property] !== value) return null;
	else return p;
}

VAST.prototype.searchParentsByTypeFor = function( type, property, value ){
	var p = this.current;

	while(p && p[property] !== value && p.type !== type && (p = p.parent));

	if(p[property] !== value) return null;
	else return p;
}

VAST.prototype.flatten = function(){

	var all = [];

	function visitNode(node){
		var child, children;

		node.starter.forEach(function(n){ n.mode = node.type; });
		node.stopper.forEach(function(n){ n.mode = node.type; });

		all.push.apply( all, node.starter );

		children = node.children.slice();
		while( (child = children.shift()) ){
			visitNode(child)
		}

		all.push.apply( all, node.stopper );
	}

	visitNode(this.current);

	return all;
}

VAST.prototype.toTreeString = function(){
	var  buffer = []
		
		,indent = 1;

	function joinTokens(toks, indent){
		return toks.map(function(n){ 
			return Array(indent).join(' |') + ' ' + (n
				?  n.toString()
				: '[empty]');
		}) 
	}

	function visitNode(node){
		var  children
			,child

		buffer.push( Array(indent-1).join(' |') + ' +' + node.type );
		//if(node.starter.length === 0) node.starter.push('');
		buffer.push.apply( buffer, joinTokens(node.starter, indent))

		indent += 2;
		children = node.children.slice();
		while( (child = children.shift()) ){
			visitNode(child); 
		}
		indent -= 2;

		//if(node.stopper.length === 1) node.stopper.unshift('');
		buffer.push.apply( buffer, joinTokens(node.stopper, indent) )
	}

	visitNode(this.current)

	return buffer.join('\n');
}


function VASTNode(){
	this.type = ''; //
	this.tagName = null;
	this.parent = null; 
	this.starter = [];
	this.children = [];
	this.stopper = [];
}

VASTNode.prototype.closed = function(){
	return this.stopper.length > 0;
}

VASTNode.prototype.asTag = function(tagName){
	this.tagName = tagName;
}


/*jshint strict:false, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

function VParser(tokens, options){
	
	var n;

	this.options = options || {};

	this.tokens = tokens;

	this.ast = new VAST();

	//if(this.ast.current.type === VParser.modes.PRG){
	//	this.ast.openNewAsChild( this.options.initialMode || VParser.modes.MKP );
	//}

	//delete this.options.initialMode;

	this.debug = this.options.debugParser;
}

VParser.modes = { PRG: "PROGRAM", MKP: "MARKUP", BLK: "BLOCK", EXP: "EXPRESSION" };

VParser.prototype = {

	parse: function(){
		var curr, i, len, block, orderedTokens, topMsg = 'Top 30 tokens ordered by TOUCHING';

		while( (curr = this.tokens.pop()) ){

			if(this.debug){
				console.log(this.ast.current && this.ast.current.type, curr.type, curr, curr.val);
			}

			if(this.ast.current.type === VParser.modes.PRG){
				
				this.ast.openNewAsChild( this.options.initialMode || VParser.modes.MKP );	

				if(this.options.initialMode === VParser.modes.EXP){
					this.ast.openNewAsChild( VParser.modes.EXP, null, true ); // EXP needs to know it's within to continue
				}

				//delete this.options.initialMode; // always want to fallback to MKP after initial
			}

			if(this.ast.current.type === VParser.modes.MKP){
				this.handleMKP(curr);
				continue;
			}
			
			if(this.ast.current.type === VParser.modes.BLK){
				this.handleBLK(curr);
				continue;
			}
			
			if(this.ast.current.type === VParser.modes.EXP){
				this.handleEXP(curr);	
				continue;
			}
		}

		this.ast.root();

		// TODO: some sort of node closed check
		//for(i = 0, len = this.blockStack.count(); i < len; i++){
		//	block = this.blockStack.pop();
		//	
		//	// only throw errors if there is an unclosed block
		//	if(block.type === VParser.modes.BLK)
		//		throw this.exceptionFactory(new Error, 'UNMATCHED', block.tok);
		//}

		if(this.debug){
			console.log(this.ast.toTreeString());
		}
		
		return this.ast;
	}
	
	,exceptionFactory: function(e, type, tok){

		// second param is either a token or string?

		//var context = this.lex.originalInput.split('\n')[tok.line - 1].substring(0, tok.chr + 1);
		//var context = '', i;
//
//		//for(i = 0; i < this.buffers.length; i++){
//		//	context += this.buffers[i].value;
//		//}
//
//		//if(context.length > 100){
//		//	context = context.substring( context.length - 100 );
		//}

		switch(type){

			case 'UNMATCHED':
				e.name = "UnmatchedCharacterError";

				this.ast.root();

				if(tok){
					e.message = 'Unmatched ' + tok.type
						//+ ' near: "' + context + '"'
						+ ' at line ' + tok.line
						+ ', character ' + tok.chr
						+ '. Value: ' + tok.val
						+ '\n ' + this.ast.toTreeString();
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

	,advanceUntilNot: function(untilNot){
		var curr, next, tks = [];

		while( next = this.tokens[ this.tokens.length - 1 ] ){
			if(next.type === untilNot){
				curr = this.tokens.pop();
				tks.push(curr);
			} else {
				break;
			}
		}
		
		return tks;
	}

	,advanceUntilMatched: function(curr, start, end){
		var next = curr
			,nstart = 0
			,nend = 0
			,tks = [];
		
		while(next){
			if(next.type === start) { nstart++; }
			if(next.type === end) { nend++; }
			
			tks.push(next);
			
			if(nstart === nend) { break; }
			next = this.tokens.pop();
			if(!next) { throw this.exceptionFactory(new Error, 'UNMATCHED', curr); }
		}
		
		return tks.reverse();
	}

	,handleMKP: function(curr){
		var  next = this.tokens[ this.tokens.length - 1 ]
			,ahead = this.tokens[ this.tokens.length - 2 ]
			,tagName = null
			,opener;
		
		switch(curr.type){
			
			case VLexer.tks.AT_STAR_OPEN:
				this.advanceUntilMatched(curr, VLexer.tks.AT_STAR_OPEN, VLexer.tks.AT_STAR_CLOSE);
				break;
			
			case VLexer.tks.AT:
				if(next) switch(next.type){
					
					case VLexer.tks.PAREN_OPEN:
					case VLexer.tks.IDENTIFIER:
					case VLexer.tks.HTML_RAW:
						this.ast.openNewAsChild( VParser.modes.EXP );
						break;
					
					case VLexer.tks.KEYWORD:
					case VLexer.tks.FUNCTION:
					case VLexer.tks.BRACE_OPEN:
					case VLexer.tks.BLOCK_GENERATOR:
						this.ast.openNewAsChild( VParser.modes.BLK );
						break;
					
					default:
						this.ast.useToken(this.tokens.pop());
						break;
				}
				break;		
			
			// TODO: are these really right?
			case VLexer.tks.BRACE_OPEN:
				this.ast.openNewAsChild( VParser.modes.BLK );
				this.tokens.push(curr); // defer
				break;

			case VLexer.tks.BRACE_CLOSE:
				this.ast.closeCurrent();
				this.tokens.push(curr); // defer
				break;
			
			case VLexer.tks.TEXT_TAG_OPEN:
			case VLexer.tks.HTML_TAG_OPEN:
				tagName = curr.val.match(/^<([^\/ >]+)/i); 
				
				if(tagName === null && next && next.type === VLexer.tks.AT && ahead)
					tagName = ahead.val.match(/(.*)/); // HACK for <@exp>

				this.ast.openNewAsChild( VParser.modes.MKP )
				this.ast.current.asTag( tagName[1] );

				if(VLexer.tks.HTML_TAG_OPEN === curr.type) {
					this.ast.useToken(curr);
				}
				break;
			
			case VLexer.tks.TEXT_TAG_CLOSE:
			case VLexer.tks.HTML_TAG_CLOSE:
				/*tagName = curr.val.match(/^<\/([^>]+)/i); 
				
				if(tagName === null && next && next.type === VLexer.tks.AT && ahead)
					tagName = ahead.val.match(/(.*)/); // HACK for </@exp>
				
				opener = this.ast.searchParentsFor( 'tagName', tagName[1] );
				
				if(opener === null){
					// couldn't find opening tag
					throw this.exceptionFactory(new Error, 'UNMATCHED', curr);
				}

				this.ast.current = opener;*/
				
				if(VLexer.tks.HTML_TAG_CLOSE === curr.type) { 
					this.ast.useAsStopper(curr);
					this.ast.closeCurrent();
				}

				if(
					this.ast.current.parent && this.ast.current.parent.type === VParser.modes.BLK
					&& (next.type === VLexer.tks.WHITESPACE || next.type === VLexer.tks.NEWLINE) 
				){
					this.ast.useToken(this.advanceUntilNot(VLexer.tks.WHITESPACE));
					this.ast.closeCurrent();
				}
				break;

			default:
				this.ast.useToken(curr);
				break;
		}
		
	}

	,handleBLK: function(curr){
		
		var  next = this.tokens[ this.tokens.length - 1 ]
			,opener
			,subTokens
			,parseOpts
			,miniParse
			,i
		
		switch(curr.type){
			
			case VLexer.tks.AT:
				switch(next.type){
					
					case VLexer.tks.AT:
						break;
					
					default:
						this.tokens.push(curr); // defer
						this.ast.closeCurrent();
						this.ast.openNewAsChild(VParser.modes.MKP);
						break;
				}
				break;
			
			case VLexer.tks.AT_COLON:
				this.ast.openNewAsChild(VParser.modes.MKP);
				break;
			
			case VLexer.tks.TEXT_TAG_OPEN:
			case VLexer.tks.TEXT_TAG_CLOSE:
			case VLexer.tks.HTML_TAG_SELFCLOSE:
			case VLexer.tks.HTML_TAG_OPEN:
			case VLexer.tks.HTML_TAG_CLOSE:
				this.ast.openNewAsChild(VParser.modes.MKP);
				this.tokens.push(curr); // defer
				break;
			
			case VLexer.tks.FAT_ARROW:
				this.ast.openNewAsChild(VParser.modes.BLK, curr);
				break;

			case VLexer.tks.BRACE_OPEN:
			case VLexer.tks.PAREN_OPEN:

				if(this.ast.current.closed()){
					this.ast.openNewAsSibling(VParser.modes.BLK, curr);
				} else {
					this.ast.useToken(curr);
				}
				
				parseOpts = vash.copyObj(this.options);
				parseOpts.initialMode = VParser.modes.BLK;
				subTokens = this.advanceUntilMatched( curr, curr.type, VLexer.pairs[ curr.type ] );
				subTokens.pop(); // remove (
				this.ast.useAsStopper( subTokens.shift() );
				miniParse = new VParser( subTokens, parseOpts );
				miniParse.parse();
				this.ast.current.children.push.apply(this.ast.current.children, miniParse.ast.current.children);

				// correct parent of mini
				for(i = this.ast.current.children.length-1; i >= 0; i--){
					this.ast.current.children[i].parent = this.ast.current;
				}

				this.ast.closeCurrent();
				
				break;
			
			/*case VLexer.tks.PAREN_CLOSE:
			case VLexer.tks.BRACE_CLOSE:
				opener = this.ast.searchParentsByTypeFor( VParser.modes.BLK, 'closed', false );

				if(opener === null || (opener !== null && opener.type !== VParser.modes.BLK))
					throw this.exceptionFactory(new Error, 'UNMATCHED', curr);

				this.ast.useAsStopper(curr);
				this.ast.closeCurrent();
				
				// check for: } KEYWORD, ).

				this.advanceUntilNot(VLexer.tks.WHITESPACE);
				next = this.tokens[ this.tokens.length - 1 ]
				if( next && (next.type === VLexer.tks.KEYWORD || next.type === VLexer.tks.FUNCTION) ){
					this.ast.openNewAsChild( VParser.modes.BLK );
					break;
				}

				if( next && next.type === VLexer.tks.PERIOD ){
					this.ast.openNewAsChild( VParser.modes.EXP )
					break;
				}

				//if(this.ast.current !== null && this.ast.current.parent.type === VParser.modes.MKP){
				//	this.ast.closeCurrent();
				//	this.ast.openNewAsChild( VParser.modes.MKP );
				//}
					
					
				break;*/

			case VLexer.tks.WHITESPACE:
				this.ast.useToken(curr);
				this.advanceUntilNot(VLexer.tks.WHITESPACE);
				break;

			default:
				this.ast.useToken(curr);
				break;
		}
		
	}

	,handleEXP: function(curr){
		
		var ahead = null
			,opener
			,miniParse
			,subTokens
			,i;
		
		switch(curr.type){
			
			case VLexer.tks.KEYWORD:
			case VLexer.tks.FUNCTION:	
				this.ast.openNewAsChild(VParser.modes.BLK);
				this.tokens.push(curr); // defer
				break;
			
			case VLexer.tks.LOGICAL:
			case VLexer.tks.ASSIGN_OPERATOR:
			case VLexer.tks.OPERATOR:
			case VLexer.tks.NUMERIC_CONTENT:
			case VLexer.tks.WHITESPACE:
			case VLexer.tks.IDENTIFIER:
			case VLexer.tks.HTML_RAW:
				this.ast.useToken(curr);		
				break;
			
			case VLexer.tks.SINGLE_QUOTE:
			case VLexer.tks.DOUBLE_QUOTE:

				if(this.ast.current.parent.type !== VParser.modes.EXP){
					// probably end of expression
					this.ast.closeCurrent();
					this.tokens.push(curr); // defer
					break;
				}

				if(this.ast.current.closed()){
					this.ast.closeCurrent();
					this.tokens.push(curr); // defer
				} else {
					subTokens = this.advanceUntilMatched( curr, curr.type, VLexer.pairs[ curr.type ] );
					this.ast.useToken(subTokens);	
				}

				break;

			case VLexer.tks.HARD_PAREN_OPEN:
			case VLexer.tks.PAREN_OPEN:

				if(this.ast.current.closed()){
					this.ast.openNewAsSibling(VParser.modes.EXP, curr);
				} else {
					this.ast.useToken(curr);
				}

				parseOpts = vash.copyObj(this.options);
				parseOpts.initialMode = VParser.modes.EXP;
				subTokens = this.advanceUntilMatched( curr, curr.type, VLexer.pairs[ curr.type ] );
				subTokens.pop();
				this.ast.useAsStopper( subTokens.shift() );
				miniParse = new VParser( subTokens, parseOpts );
				miniParse.parse();

				// EXP miniparsers automatically are double-nested for the parsing process
				// but it's not needed once merging back in
				this.ast.current.children.push.apply(this.ast.current.children, miniParse.ast.current.children[0].children);

				// correct parent of mini
				for(i = this.ast.current.children.length-1; i >= 0; i--){
					this.ast.current.children[i].parent = this.ast.current;
				}

				break;
			
			case VLexer.tks.BRACE_OPEN:
				this.tokens.push(curr); // defer
				this.ast.openNewAsChild(VParser.modes.BLK);
				break;

			/*case VLexer.tks.HARD_PAREN_CLOSE:
			case VLexer.tks.PAREN_CLOSE:
				opener = this.ast.searchParentsByTypeFor( VParser.modes.EXP, 'closed', false );
				if(opener){
					this.ast.current = opener;
					this.ast.useAsStopper(curr);
					this.ast.closeCurrent();
				} else {
					throw this.exceptionFactory(new Error, 'UNMATCHED', curr);
				}
				
				break;*/

			case VLexer.tks.FAT_ARROW:
				this.tokens.push(curr); // defer
				this.ast.openNewAsChild(VParser.modes.BLK);
				break;

			case VLexer.tks.PERIOD:
				ahead = this.tokens[ this.tokens.length - 1 ]
				if(
					ahead && (ahead.type === VLexer.tks.IDENTIFIER 
						|| ahead.type === VLexer.tks.KEYWORD 
						|| ahead.type === VLexer.tks.FUNCTION)
				) {
					this.ast.useToken(curr);
				} else {
					//this.ast.openNewAsChild(VParser.modes.MKP);
					this.ast.closeCurrent();
					this.tokens.push(curr); // defer
				}
				break;
			
			default:
				// assume end of expression
				this.ast.closeCurrent();
				//this.ast.openNewAsChild(VParser.modes.MKP);
				this.tokens.push(curr); // defer
				break;
				
		}
		
	}
}
/*jshint strict:false, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

function VCompiler(ast, originalMarkup){
	this.ast = ast;
	this.originalMarkup = originalMarkup || '';
}

var VCP = VCompiler.prototype;

VCP.assemble = function(options){

	options = options || {};
	//options.modelName = options.modelName || 'model';

	var buffer = []

		,reQuote = /["']/gi
		,reEscapedQuote = /(\\?)(["'])/gi
		,reLineBreak = /[\n\r]/gi
		,joined
		,func;

	function pluckTokVals(toks){
		var i, tok, all = [];

		for(i = 0; i < toks.length; i++){
			all.push(toks[i].val)
		}
		return all.join('');
	}

	function visitMarkupNode(node){

		if(node.starter.length === 0 && node.stopper.length === 0 && node.children.length === 0){
			return;
		}

		if(node.starter.length > 0){
			options.debug 
				&& buffer.push( ';__vline = ' + node.starter[0].line + '; \n')
				&& buffer.push( ';__vchar = ' + node.starter[0].chr + '; \n' );	
		}
		
		buffer.push( "__vout.push('" + pluckTokVals(node.starter)
			.replace(reQuote, '\"').replace(reLineBreak, '\\n') + "'); \n" );

		visitChildren(node)

		if(node.stopper.length > 0){
			options.debug 
				&& buffer.push( ';__vline = ' + node.stopper[0].line + '; \n')
				&& buffer.push( ';__vchar = ' + node.stopper[0].chr + '; \n' );
		}

		buffer.push( "__vout.push('" + pluckTokVals(node.stopper)
			.replace(reQuote, '\"').replace(reLineBreak, '\\n') + "'); \n" );
	}

	function visitBlockNode(node){
		
		buffer.push( pluckTokVals(node.starter).replace(reQuote, '\"') );
		visitChildren(node)
		buffer.push( pluckTokVals(node.stopper).replace(reQuote, '\"') );
	}

	function visitExpressionNode(node){

		var start = '', end = '';

		// deepest, this is also where escaping would be applied, I think...
		if(node.children.length === 0){
			
			if(options.htmlEscape !== false){
				start += "(";
				end += ").toString()\n"
					+ ".replace(/&(?!\w+;)/g, '&amp;')\n"
					+ ".replace(/</g, '&lt;')\n"
					+ ".replace(/>/g, '&gt;')\n"
					+ ".replace(/\"/g, '&quot;') \n";
			} else {
				
			}
		}

		if(node.parent && node.parent.type !== VParser.modes.EXP){
			start += "__vout.push(";
			end += "); \n";
		}

		buffer.push( start + pluckTokVals(node.starter).replace(reQuote, '"').replace(reEscapedQuote, '"') );
		visitChildren(node)
		buffer.push( pluckTokVals(node.stopper).replace(reQuote, '"').replace(reEscapedQuote, '"') + end );
	}

	function visitChildren(node){

		var n, children;

		children = node.children.slice();
		while( (n = children.shift()) ){

			if(n.type === VParser.modes.MKP) { visitMarkupNode(n); }
			if(n.type === VParser.modes.BLK) { visitBlockNode(n); }
			if(n.type === VParser.modes.EXP) { visitExpressionNode(n); }
		}
	}

	// suprisingly: http://jsperf.com/array-index-vs-push
	buffer.unshift("var __vout = []; \n");

	options.debug && buffer.push('var __vline = 0, __vchar = 0; \n');

	visitChildren(this.ast.current);

	if(options.useWith === true){
		buffer.unshift( "with(" + options.modelName + " || {}){ \n" );
		buffer.push("}");
	}

	if(options.debug){
		buffer.unshift( 'try { \n' );
		buffer.push( '} catch(e){ ('
			,VCP.reportError.toString()
			,')(e, __vline, __vchar, '
			,'"' + this.originalMarkup
				.replace(reLineBreak, '!LB!')
				.replace(reEscapedQuote, '\\$2') + '"'
			,') } \n' )
	}

	buffer.push("return __vout.join('');")

	joined = buffer.join('');

	options.debugCompiler && console.log(joined);

	try {
		func = new Function(options.modelName, joined);
	} catch(e){
		e.message += ' -> ' + joined;
		throw e;	
	}

	return func;
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

	exports['isArray'] = function(obj){
		return Object.prototype.toString.call(obj) == '[object Array]'
	}

	exports['copyObj'] = function(obj){
		var nObj = {};

		for(var i in obj){
			if(Object.prototype.hasOwnProperty(i)){
				nObj[i] = obj[i]
			}
		}

		return nObj;
	}

	exports["VLexer"] = VLexer;
	exports["VParser"] = VParser;
	exports["VCompiler"] = VCompiler;
	exports["compile"] = function compile(markup, options){

		var  l
			,tok
			,tokens = []
			,p
			,c
			,cmp;

		options = options || {};
		options.useWith = options.useWith || exports.config.useWith;
		options.modelName = options.modelName || exports.config.modelName;
		options.debug = options.debug || exports.config.debug;
		options.debugParser = options.debugParser || exports.config.debugParser;
		options.debugCompiler = options.debugCompiler || exports.config.debugCompiler;

		l = new VLexer(markup);
		while(tok = l.advance()) tokens.push(tok)
		tokens.reverse(); // parser needs in reverse order for faster popping vs shift

		p = new VParser(tokens, options);
		p.parse();

		c = new VCompiler(p.ast, markup);
		//c.generate(options);

		// Express support
		cmp = c.assemble(options);
		cmp.displayName = 'render';
		return cmp;
	};

	return exports;
}({}));
