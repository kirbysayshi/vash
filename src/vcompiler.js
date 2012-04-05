
function VCompiler(tokens, originalMarkup){
	this.tokens = tokens;
	this.originalMarkup = originalMarkup;
	this.symbolTable = {};
}

var VCP = VCompiler.prototype;


VCP.generate = function(options){

	this.buildSymbolTable();
	this.fatArrowTransform();
	this.insertHTMLExpressionEscape(options);
	
	//this.insertFunctionBuffering();
	this.mergeTokens();
	this.insertBlockSemiColons();
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

VCP.fatArrowTransform = function(){
	var i
		,openParenAt
		,closeParenAt
		,openBraceAt
		,openArgParenAt
		,closeArgParenAt
		,nextNonWhiteSpace
		,fatIndex
		,tok;

	for(i = 0; i < this.tokens.length; i++){

		tok = this.tokens[i];

		if(tok.mode !== VParser.modes.BLK || tok.type !== VLexer.tks.FAT_ARROW) continue;

		// ( is the first char of a FAT_ARROW always, because these are only supported as lambdas
		// but arguments can be un-parenthesized if singular
		openParenAt = i;
		closeParenAt = this.findMatchingIndex(this.tokens, VLexer.tks.PAREN_OPEN, VLexer.tks.PAREN_CLOSE, i);
		nextNonWhiteSpaceAt = this.deeperIndexOfNot(this.tokens, VLexer.tks.WHITE_SPACE, i);

		fatIndex = tok.val.indexOf('=>');
		openArgParenAt = tok.val.indexOf('(', 1); // looking for parenthetized args
		closeArgParenAt = VCP.findMatchingStrIndex(tok.val, '(', ')', openArgParenAt); 

		// ( i =>
		tok.val = 
			tok.val[0] 
			+ 'function'
			+ (openArgParenAt === -1 
				? '(' + tok.val.substring(1, fatIndex) + ')' 
				: tok.val.substring(openArgParenAt, closeArgParenAt + 1))
			+ (this.tokens[nextNonWhiteSpaceAt].type !== VLexer.tks.BRACE_OPEN ? '{' : '');
		// (function( i ){

		if(this.tokens[nextNonWhiteSpaceAt].type !== VLexer.tks.BRACE_OPEN){
			this.tokens.splice(closeParenAt, 0, { 
				 mode: VParser.modes.BLK
				,type: 'BLK_GENERATED BRACE_CLOSE'
				,touched: 1
				,val: "}"
				,line: this.tokens[closeParenAt].line
				,chr: this.tokens[closeParenAt].chr
			})
		}
	}
}

VCP.insertBlockSemiColons = function(){
	var i, openBraceAt, closingBraceAt, tok;

	for(i = 0; i < this.tokens.length; i++){

		tok = this.tokens[i];

		// this is really a bit of a hack
		if(tok.mode === VParser.modes.BLK){
			tok.val = tok.val.replace(/\}\s*?\)(?!;)/, '});')
		}		
	}
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
		if(tok.type !== startType && i === startAt) nstart++; // allow to start on a non matching char
		if(tok.type === startType) nstart++;
		if(tok.type === endType) nend++

		if(nstart === nend) break;
	}

	return i;
}

VCP.findMatchingStrIndex = function(str, startChr, endChr, startAt){
	var  list = str.split('')
		,nstart = 0
		,nend = 0
		,i = startAt || 0
		,chr;

	for(; i < str.length; i++){
		chr = list[i];
		if(chr !== startChr && i === startAt) nstart++; // allow to start on a non matching char
		if(chr === startChr) nstart++;
		if(chr === endChr) nend++

		if(nstart === nend) break;
	}

	return i;
}

// endType is actually before startType in terms of absolute index
VCP.findPreviousMatchingIndex = function(list, startType, endType, startAt){
	var nstart = 0
		,nend = 0
		,i = startAt || list.length - 1
		,tok;

	for(; i >= 0; i--){
		tok = list[i];
		if(tok.type !== startType && i === startAt) nstart--; // allow to start on a non matching char
		if(tok.type === startType) nstart--;
		if(tok.type === endType) nend--

		if(nstart === nend) break;
	}

	return i + nstart; // nstart === nend and will be negative
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