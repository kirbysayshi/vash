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

	typeof define === 'function' && define['amd']
		? define(vash) // AMD
		: typeof module === 'object' && module['exports']
			? module['exports'] = vash // NODEJS
			: window['vash'] = vash // BROWSER

})(function(exports){

	var vash = exports; // neccessary for nodejs references

	exports["version"] = "0.4.1-826";

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

			|| this.DOUBLE_QUOTE()
			|| this.SINGLE_QUOTE()

			|| this.NUMERIC_CONTENT()
			|| this.CONTENT()
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
};

VLexer.pairs = {
	 AT_STAR_OPEN: VLexer.tks.AT_STAR_CLOSE
	,PAREN_OPEN: VLexer.tks.PAREN_CLOSE
	,BRACE_OPEN: VLexer.tks.BRACE_CLOSE
	,HARD_PAREN_OPEN: VLexer.tks.HARD_PAREN_CLOSE
	,DOUBLE_QUOTE: VLexer.tks.DOUBLE_QUOTE
	,SINGLE_QUOTE: VLexer.tks.SINGLE_QUOTE
};
/*jshint strict:false, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

var vQuery = function(node){
	return new vQuery.fn.init(node);
}

vQuery.prototype.init = function(astNode){

	// handle falsy
	if(!astNode) return this;

	// handle mode string
	if(typeof astNode === 'string'){
		this.mode = astNode;
		return this;
	}

	// handle plain token?
	if(!vQuery.isArray(astNode) && astNode.vquery !== this.vquery){
		astNode = [astNode];
	} else {

		// protect against ridiculous bugs
		if( astNode.length >= vQuery.maxSize ){
			throw { name: 'vQuery Error', message: 'Maximum number of elements exceeded' };
		}
	}

	if( astNode.vquery === this.vquery ){
		return astNode;
	}

	return vQuery.makeArray(astNode, this);
}

vQuery.fn = vQuery.prototype.init.prototype = vQuery.prototype;

vQuery.fn.vquery = 'yep';
vQuery.fn.constructor = vQuery;
vQuery.fn.length = 0;
vQuery.fn.parent = null;
vQuery.fn.mode = null;
vQuery.fn.tagName = null;

vQuery.fn.beget = function(mode, tagName){
	var child = vQuery();
	child.mode = mode;
	child.parent = this;
	this.push( child );

	if(tagName) { child.tagName = tagName; }

	return child;
}

vQuery.fn.every = function(fun /*, thisp */) {  
	"use strict";  

	if (this == null)
		throw new TypeError();

	var t = Object(this);
	var len = t.length >>> 0;
	if (typeof fun != "function")
		throw new TypeError();

	var thisp = arguments[1];
	for (var i = 0; i < len; i++){
		if (i in t && !fun.call(thisp, t[i], i, t))
			return false;
	}

	return true;
};  

vQuery.fn.each = function(cb){
	vQuery.each(this, cb, this);
	return this;
}

vQuery.fn.closest = function(mode, tagName){
	var p = this;

	if(!tagName){
		while( p && (p.mode !== mode || p == this) && p.parent && (p = p.parent) );
	} else {

		while(p){

			if( p.tagName !== tagName && p.parent ){
				p = p.parent;
			} else {
				break;
			}
		}

		//while( p && (p.mode !== mode || p == this) && p.tagName !== tagName && p.parent && (p = p.parent) );
	}

	return p;
}

vQuery.fn.pushFlatten = function(node){
	var n = node, i, children;

	while( n.length === 1 && n[0].vquery ){
		n = n[0];
	}

	if(n.mode !== VParser.modes.PRG){
		this.push(n);	
	} else {

		for(i = 0; i < n.length; i++){
			this.push( n[i] )
		}
	}

	return this;
}

vQuery.fn.push = function(nodes){

	if(vQuery.isArray(nodes)){
		if(nodes.vquery){
			vQuery.each(nodes, function(node){ node.parent = this; }, this);	
		}
		
		Array.prototype.push.apply(this, nodes);
	} else {
		if(nodes.vquery){
			nodes.parent = this;	
		}
		
		Array.prototype.push.call(this, nodes);
	}

	return this.length;
}

vQuery.fn.root = function(){
	var p = this;

	while(p && p.parent && (p = p.parent));

	return p;
}

vQuery.fn.toTreeString = function(){
	var  buffer = []
		,indent = 1;

	function visitNode(node){
		var  children
			,child

		buffer.push( Array(indent).join(' |') + ' +' + node.mode + ' ' + ( node.tagName || '' ) );

		indent += 1;
		children = node.slice();
		while( (child = children.shift()) ){

			if(child.vquery === vQuery.fn.vquery){
				// recurse
				visitNode(child);
			} else {
				buffer.push( Array(indent).join(' |') + ' ' 
					+ (child
						?  child.toString()
						: '[empty]') 
				);
			}

		}

		indent -= 1;
	}

	visitNode(this);

	return buffer.join('\n');
}

vQuery.maxSize = 500000;

// via jQuery
vQuery.makeArray = function( array, results ) {
	array = Array.prototype.slice.call( array, 0 );

	if ( results ) {
		results.push.apply( results, array );
		results.mode = array.mode;
		results.parent = array.parent;
		results.tagName = array.tagName;
		return results;
	}
	
	return array;
};

vQuery.isArray = function(obj){
	return Object.prototype.toString.call(obj) == '[object Array]'
}

vQuery.each = function(nodes, cb, scope){
	var i, node;

	for(i = 0; i < nodes.length; i++){
		node = nodes[i];
		cb.call( (scope || node), node, i );
	}
}

vQuery.copyObj = function(obj){
	var nObj = {};

	for(var i in obj){
		if(Object.prototype.hasOwnProperty.call(obj, i)){
			nObj[i] = obj[i];
		}
	}

	return nObj;
}

vQuery.takeMethodsFromArray = function(){
	var methods = [
		'pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift',
		'concat', 'join', 'slice', 'indexOf', 'lastIndexOf',
		'filter', 'forEach', 'every', 'map', 'some', 'reduce', 'reduceRight'
	]

		,arr = []
		,m;

	for (var i = 0; i < methods.length; i++){
		m = methods[i];
		if( typeof arr[m] === 'function' ){
			if( !vQuery.fn[m] ){
				(function(methodName){ 
					vQuery.fn[methodName] = function(){
						return arr[methodName].apply(this, vQuery.makeArray(arguments));
					}
				})(m);
			}
		} else {
			throw new Error('Vash requires ES5 array iteration methods, missing: ' + m);
		}
	}

}

vQuery.takeMethodsFromArray(); // run on page load

/*jshint strict:false, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

function VParser(tokens, options){
	
	var n;

	this.options = options || {};

	this.tokens = tokens;

	this.ast = vQuery(VParser.modes.PRG);
}

VParser.modes = { PRG: "PROGRAM", MKP: "MARKUP", BLK: "BLOCK", EXP: "EXPRESSION" };

VParser.prototype = {

	parse: function(){
		var curr, i, len, block;

		while( (curr = this.tokens.pop()) ){

			if(this.options.debugParser){
				console.log(this.ast && this.ast.mode, curr.type, curr, curr.val);
			}

			if(this.ast.mode === VParser.modes.PRG || this.ast.mode === null){
				
				this.ast = this.ast.beget( this.options.initialMode || VParser.modes.MKP );	

				if(this.options.initialMode === VParser.modes.EXP){
					this.ast = this.ast.beget( VParser.modes.EXP ); // EXP needs to know it's within to continue
				}
			}

			if(this.ast.mode === VParser.modes.MKP){
				this.handleMKP(curr);
				continue;
			}
			
			if(this.ast.mode === VParser.modes.BLK){
				this.handleBLK(curr);
				continue;
			}
			
			if(this.ast.mode === VParser.modes.EXP){
				this.handleEXP(curr);	
				continue;
			}
		}

		this.ast = this.ast.root();

		if(this.options.debugParser && !this.options.initialMode){
			// this should really only output on the true root

			console.log(this.ast);
			console.log(this.ast.toTreeString());
		}
		
		return this.ast;
	}
	
	,exceptionFactory: function(e, type, tok){

		// second param is either a token or string?

		if(type == 'UNMATCHED'){

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

	,advanceUntilMatched: function(curr, start, end, escape){
		var  next = curr
			,prev = null
			,nstart = 0
			,nend = 0
			,tks = [];
		
		while(next){

			if( next.type === start ){
				nstart++;
				//if(prev && prev.type === escape){ nstart--; }
			}

			if( next.type === end ){
				nend++;
				if(prev && prev.type === escape){ nend--; }
			}

			tks.push(next);
			
			if(nstart === nend) { break; }
			prev = next;
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
				this.advanceUntilMatched(curr, VLexer.tks.AT_STAR_OPEN, VLexer.tks.AT_STAR_CLOSE, VLexer.tks.AT);
				break;
			
			case VLexer.tks.AT:
				if(next) switch(next.type){
					
					case VLexer.tks.PAREN_OPEN:
					case VLexer.tks.IDENTIFIER:
					case VLexer.tks.HTML_RAW:

						if(this.ast.length === 0) {
							this.ast = this.ast.parent;
							this.ast.pop(); // remove empty MKP block
						}

						this.ast = this.ast.beget( VParser.modes.EXP );
						break;
					
					case VLexer.tks.KEYWORD:
					case VLexer.tks.FUNCTION:
					case VLexer.tks.BRACE_OPEN:
					case VLexer.tks.BLOCK_GENERATOR:

						if(this.ast.length === 0) {
							this.ast = this.ast.parent;
							this.ast.pop(); // remove empty MKP block
						}

						this.ast = this.ast.beget( VParser.modes.BLK );
						break;
					
					default:
						this.ast.push( this.tokens.pop() );
						break;
				}
				break;		
			
			case VLexer.tks.BRACE_OPEN:
				this.ast = this.ast.beget( VParser.modes.BLK );
				this.tokens.push(curr); // defer
				break;

			case VLexer.tks.BRACE_CLOSE:
				this.ast = this.ast.parent;
				this.tokens.push(curr); // defer
				break;
			
			case VLexer.tks.TEXT_TAG_OPEN:
			case VLexer.tks.HTML_TAG_OPEN:
				tagName = curr.val.match(/^<([^\/ >]+)/i); 
				
				if(tagName === null && next && next.type === VLexer.tks.AT && ahead){
					tagName = ahead.val.match(/(.*)/); // HACK for <@exp>
				}

				if(this.ast.tagName){
					// current markup is already waiting for a close tag, make new child
					this.ast = this.ast.beget(VParser.modes.MKP, tagName[1]);
				} else {
					this.ast.tagName = tagName[1];
				}

				if(VLexer.tks.HTML_TAG_OPEN === curr.type) {
					this.ast.push(curr);
				}

				break;
			
			case VLexer.tks.TEXT_TAG_CLOSE:
			case VLexer.tks.HTML_TAG_CLOSE:
				tagName = curr.val.match(/^<\/([^>]+)/i); 
				
				if(tagName === null && next && next.type === VLexer.tks.AT && ahead){
					tagName = ahead.val.match(/(.*)/); // HACK for </@exp>
				}
				
				opener = this.ast.closest( VParser.modes.MKP, tagName[1] );
				
				if(opener === null || opener.tagName !== tagName[1]){
					// couldn't find opening tag
					// could mean this closer is within a child parser
					//throw this.exceptionFactory(new Error, 'UNMATCHED', curr);
				} else {
					this.ast = opener;
				}
				
				if(VLexer.tks.HTML_TAG_CLOSE === curr.type) { 
					this.ast.push( curr );
				}

				if(
					this.ast.parent && this.ast.parent.mode === VParser.modes.BLK
					&& (next.type === VLexer.tks.WHITESPACE || next.type === VLexer.tks.NEWLINE) 
				){
					this.ast = this.ast.parent;
				}
				break;

			case VLexer.tks.HTML_TAG_SELFCLOSE:

				this.ast.push(curr);

				if(
					this.ast.parent && this.ast.parent.mode === VParser.modes.BLK
					&& (next.type === VLexer.tks.WHITESPACE || next.type === VLexer.tks.NEWLINE) 
				){
					this.ast = this.ast.parent;
				}
				break;

			default:
				this.ast.push(curr);
				break;
		}
		
	}

	,handleBLK: function(curr){
		
		var  next = this.tokens[ this.tokens.length - 1 ]
			,opener
			,closer
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
						this.ast = this.ast.beget(VParser.modes.MKP);
						break;
				}
				break;
			
			case VLexer.tks.AT_COLON:
				this.ast = this.ast.beget(VParser.modes.MKP);
				break;
			
			case VLexer.tks.TEXT_TAG_OPEN:
			case VLexer.tks.TEXT_TAG_CLOSE:
			case VLexer.tks.HTML_TAG_SELFCLOSE:
			case VLexer.tks.HTML_TAG_OPEN:
			case VLexer.tks.HTML_TAG_CLOSE:
				this.ast = this.ast.beget(VParser.modes.MKP);
				this.tokens.push(curr); // defer
				break;
			
			case VLexer.tks.FAT_ARROW:
				this.ast = this.ast.beget(VParser.modes.BLK);
				break;

			case VLexer.tks.BRACE_OPEN:
			case VLexer.tks.PAREN_OPEN:
				
				parseOpts = vQuery.copyObj(this.options);
				parseOpts.initialMode = VParser.modes.BLK;
				subTokens = this.advanceUntilMatched( curr, curr.type, VLexer.pairs[ curr.type ], VLexer.tks.AT );
				subTokens.pop(); // remove (
				closer = subTokens.shift();

				this.ast.push(curr);
				
				miniParse = new VParser( subTokens, parseOpts );
				miniParse.parse();

				this.ast.pushFlatten(miniParse.ast);
				this.ast.push( closer );
				
				subTokens = this.advanceUntilNot(VLexer.tks.WHITESPACE);
				next = this.tokens[ this.tokens.length - 1 ];

				if( 
					next 
					&& next.type !== VLexer.tks.KEYWORD 
					&& next.type !== VLexer.tks.FUNCTION 
					&& next.type !== VLexer.tks.BRACE_OPEN 
					&& curr.type !== VLexer.tks.PAREN_OPEN 
				){
					this.tokens.push.apply(this.tokens, subTokens.reverse());
					this.ast = this.ast.parent;	
				} else {
					this.ast.push(subTokens);
				}

				break;

			case VLexer.tks.WHITESPACE:
				this.ast.push(curr);
				this.advanceUntilNot(VLexer.tks.WHITESPACE);
				break;

			default:
				this.ast.push(curr);
				break;
		}
		
	}

	,handleEXP: function(curr){
		
		var ahead = null
			,opener
			,closer
			,parseOpts
			,miniParse
			,subTokens
			,i;
		
		switch(curr.type){
			
			case VLexer.tks.KEYWORD:
			case VLexer.tks.FUNCTION:	
				this.ast = this.ast.beget(VParser.modes.BLK);
				this.tokens.push(curr); // defer
				break;
			
			case VLexer.tks.LOGICAL:
			case VLexer.tks.ASSIGN_OPERATOR:
			case VLexer.tks.OPERATOR:
			case VLexer.tks.NUMERIC_CONTENT:
				if(this.ast.parent && this.ast.parent.mode === VParser.modes.EXP){

					this.ast.push(curr);
				} else {

					// if not contained within a parent EXP, must be end of EXP
					this.ast = this.ast.parent;
					this.tokens.push(curr); // defer
				}

				break;

			case VLexer.tks.WHITESPACE:
			case VLexer.tks.IDENTIFIER:
			case VLexer.tks.HTML_RAW:
				this.ast.push(curr);
				break;
			
			case VLexer.tks.SINGLE_QUOTE:
			case VLexer.tks.DOUBLE_QUOTE:
				if(this.ast.parent && this.ast.parent.mode === VParser.modes.EXP){
					this.ast.push(curr);
					
				} else {
					// probably end of expression
					this.ast = this.ast.parent;
					this.tokens.push(curr); // defer
				}

				break;

			case VLexer.tks.HARD_PAREN_OPEN:
			case VLexer.tks.PAREN_OPEN:
				
				parseOpts = vQuery.copyObj(this.options);
				parseOpts.initialMode = VParser.modes.EXP;
				subTokens = this.advanceUntilMatched( curr, curr.type, VLexer.pairs[ curr.type ], VLexer.tks.AT );
				subTokens.pop();
				closer = subTokens.shift();

				this.ast.push(curr);

				miniParse = new VParser( subTokens, parseOpts );
				miniParse.parse();

				// EXP miniparsers automatically are double-nested for the parsing process
				// but it's not needed once merging back in
				this.ast.pushFlatten(miniParse.ast);
				this.ast.push(closer);

				ahead = this.tokens[ this.tokens.length - 1 ];

				if(
					this.ast.parent && this.ast.parent.mode !== VParser.modes.EXP 
					&& (ahead && ahead.type !== VLexer.tks.HARD_PAREN_OPEN && ahead.type !== VLexer.tks.PERIOD )
				){
					this.ast = this.ast.parent;
				}

				break;
			
			case VLexer.tks.BRACE_OPEN:
				this.tokens.push(curr); // defer
				this.ast = this.ast.beget(VParser.modes.BLK);
				break;

			case VLexer.tks.FAT_ARROW:
				this.tokens.push(curr); // defer
				this.ast = this.ast.beget(VParser.modes.BLK);
				break;

			case VLexer.tks.PERIOD:
				ahead = this.tokens[ this.tokens.length - 1 ];
				if(
					ahead && (ahead.type === VLexer.tks.IDENTIFIER 
						|| ahead.type === VLexer.tks.KEYWORD 
						|| ahead.type === VLexer.tks.FUNCTION)
				) {
					this.ast.push(curr);
				} else {
					this.ast = this.ast.parent;
					this.tokens.push(curr); // defer
				}
				break;
			
			default:

				if( this.ast.parent && this.ast.parent.mode !== VParser.modes.EXP ){
					// assume end of expression
					this.ast = this.ast.parent;
					this.tokens.push(curr); // defer
				} else {
					this.ast.push(curr);
				}

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

	var buffer = []
		,escapeStack = []

		,reQuote = /["']/gi
		,reEscapedQuote = /(\\?)(["'])/gi
		,reLineBreak = /[\n\r]/gi
		,joined
		,func;

	function insertDebugVars(tok){
		if(options.debug){
			buffer.push( '__vl = ' + tok.line + ', ');
			buffer.push( '__vc = ' + tok.chr + '; \n' );
		}
	}

	function visitMarkupTok(tok, parentNode, index){

		insertDebugVars(tok);
		buffer.push( "__vo.push('" + tok.val
			.replace(reQuote, '\"').replace(reLineBreak, '\\n') + "'); \n" );
	}

	function visitBlockTok(tok, parentNode, index){
		
		buffer.push( tok.val.replace(reQuote, '\"') );
	}

	function visitExpressionTok(tok, parentNode, index, isHomogenous){

		var 
			 start = ''
			,end = ''
			,parentParentIsNotEXP = parentNode.parent && parentNode.parent.mode !== VParser.modes.EXP;

		if(options.htmlEscape !== false){

			if(tok.type === VLexer.tks.HTML_RAW){
				escapeStack.push(true);
			}

			if( parentParentIsNotEXP && index === 0 && isHomogenous ){

				if(escapeStack.length === 0){
					start += '( typeof (__vt = ';	
				}
			}

			if( parentParentIsNotEXP && index === parentNode.length - 1 && isHomogenous){

				if(escapeStack.length > 0){
					escapeStack.pop();
				} else {
					end += ") !== 'undefined' ? __vt : '' ).toString()\n"
						+ ".replace(/&(?!\w+;)/g, '&amp;')\n"
						+ ".replace(/</g, '&lt;')\n"
						+ ".replace(/>/g, '&gt;')\n"
						+ ".replace(/\"/g, '&quot;') \n";
				}
			}	
		}

		if(parentParentIsNotEXP && (index === 0 || (index === 1 && parentNode[0].type === VLexer.tks.HTML_RAW) ) ){
			insertDebugVars(tok)
			start = "__vo.push(" + start;	
		}

		if(parentParentIsNotEXP && (index === parentNode.length - 1 || (index === parentNode.length - 2 && parentNode[ parentNode.length - 1 ].type === VLexer.tks.HTML_RAW) ) ){
			end += "); \n";
		}

		if(tok.type !== VLexer.tks.HTML_RAW){
			buffer.push( start + tok.val.replace(reQuote, '"').replace(reEscapedQuote, '"') + end );	
		}

		if(parentParentIsNotEXP && index === parentNode.length - 1){
			insertDebugVars(tok)
		}
	}

	function visitNode(node){

		var n, children = node.slice(0), nonExp, i, child;

		if(node.mode === VParser.modes.EXP && (node.parent && node.parent.mode !== VParser.modes.EXP)){
			// see if this node's children are all EXP
			nonExp = node.filter(findNonExp).length
		}

		for(i = 0; i < children.length; i++){
			child = children[i];

			if(child.vquery){
				visitNode(child);
				continue;
			}

			if(node.mode === VParser.modes.MKP){

				visitMarkupTok(child, node, i);

			} else if(node.mode === VParser.modes.BLK){

				visitBlockTok(child, node, i);

			} else if(node.mode === VParser.modes.EXP){
				
				visitExpressionTok(child, node, i, (nonExp > 0 ? false : true));

			}
		}

	}

	function findNonExp(node){

		if(node.vquery && node.mode === VParser.modes.EXP){
			return node.filter(findNonExp).length > 0;
		}

		if(node.vquery && node.mode !== VParser.modes.EXP){
			return true
		} else {
			return false;
		}
	}

	// suprisingly: http://jsperf.com/array-index-vs-push
	buffer.unshift("var __vo = [], __vt; \n");

	options.debug && buffer.push('var __vl = 0, __vc = 0; \n');

	visitNode(this.ast);

	if(options.useWith === true){
		buffer.unshift( "with(" + options.modelName + " || {}){ \n" );
		buffer.push("}");
	}

	if(options.debug){
		buffer.unshift( 'try { \n' );
		buffer.push( '} catch(e){ ('
			,VCP.reportError.toString()
			,')(e, __vl, __vc, '
			,'"' + this.originalMarkup
				.replace(reLineBreak, '!LB!')
				.replace(reEscapedQuote, '\\$2') + '"'
			,') } \n' )
	}

	buffer.push("return __vo.join('');")

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

	/*exports['isArray'] = function(obj){
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
	}*/

	exports["VLexer"] = VLexer;
	exports["VParser"] = VParser;
	exports["VCompiler"] = VCompiler;
	exports["compile"] = function compile(markup, options){

		if(markup === '' || typeof markup !== 'string') throw new Error('Empty or non-string cannot be compiled');

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
