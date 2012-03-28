
function VCompiler(tokens, originalMarkup){
	this.tokens = tokens;
	this.originalMarkup = originalMarkup;
	this.symbolTable = {};
}

var VCP = VCompiler.prototype;


VCP.generate = function(options){

	if(options.htmlEscape !== false){
		this.buildSymbolTable();
		this.insertHTMLExpressionEscape();	
	}
	
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

		options.debug && console.log(tok);
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
			+ VCP.reportError.toString()
			+ ')(e, __vline, __vchar) } \n' )
	}

	lines.push('return __vout.join(\'\');');
	body = lines.join('');
	options.debug && console.log(body);
	//console.log(body);

	try {
		func = new Function(options.modelName, body);
	} catch(e){
		e.message += ' :::: GENERATED :::: ' + body;
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

VCP.insertHTMLExpressionEscape = function(){
	var i, tok, nextNotExp, edgeCase = false;

	for(i = 0; i < this.tokens.length; i++){
		tok = this.tokens[i];
		nextNotExp = -1;

		if(tok.mode !== VParser.modes.EXP) continue;
		if(tok.type === VLexer.tks.HTML_RAW || this.symbolTable[tok.val] === true) {
			nextNotExp = Math.max(this.tokens.length - 1, this.deeperIndexOfNot(this.tokens, 'mode', VParser.modes.EXP, i) - 1);
			i = nextNotExp; // skip i ahead, remembering auto inc
			continue; // named helper function, do not escape
		}

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

VCP.insertFunctionBuffering = function(){
	var i, openBraceAt, closingBraceAt, tok;

	for(i = 0; i < this.tokens.length; i++){

		tok = this.tokens[i];
		openBraceAt = 0;

		if(tok.mode !== VParser.modes.BLK || tok.type !== VLexer.tks.FUNCTION) continue;

		openBraceAt = this.deeperIndexOf(this.tokens, 'type', VLexer.tks.BRACE_OPEN, i);
		closingBraceAt = this.findMatchingIndex(this.tokens, VLexer.tks.BRACE_OPEN, VLexer.tks.BRACE_CLOSE, openBraceAt);

		if( openBraceAt && closingBraceAt ){

			// plus 1 because we want it after the brace
			//this.tokens.splice(openBraceAt + 1, 0, { 
			//	mode: VParser.modes.BLK
			//	,type: 'BLK_GENERATED'
			//	,touched: 1
			//	,val: 'var __vout = [];'
			//	,line: this.tokens[openBraceAt + 1].line
			//	,chr: this.tokens[openBraceAt + 1].chr
			//});

			// plus 1 because thee previous op has increased the index
			//this.tokens.splice(closingBraceAt + 1, 0, { 
			//this.tokens.splice(closingBraceAt, 0, { 
			//	mode: VParser.modes.BLK
			//	,type: 'BLK_GENERATED'
			//	,touched: 1
			//	,val: '__vout.push.apply(__vout, );'
			//	,line: this.tokens[closingBraceAt].line
			//	,chr: this.tokens[closingBraceAt].chr
			//});
		}
	}

	return this.tokens;
}

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

VCP.reportError = function(e, line, chr){

	e.message = 'Problem while rendering template at line ' 
		+ line + ', character ' + chr 
		+ '. Original error: ' + e.message;

	throw e;
}