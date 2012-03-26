
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

function VParser(str){
	if(typeof str !== 'string')
		throw this.exceptionFactory(new Error, 'INVALIDINPUT', str);
	this.lex = new VLexer(str);
	this.tks = VLexer.tks;
	
	this.blockStack = new Stack();
	this.mode = VParser.modes.MKP;
	
	this.buffer = '';
	this.buffers = [];

	this.debug = false;
	this.consumedTokens = [];
}

VParser.modes = { MKP: "MARKUP", BLK: "BLOCK", EXP: "EXPRESSION" };

VParser.prototype = {

	parse: function(){
		var curr, i, len, block, orderedTokens;
		
		while( (curr = this.lex.advance()) ){
			this.debug && console.debug(this.mode, curr.type, curr, curr.val);
			
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
			orderedTokens = this.consumedTokens.sort(function(a,b){ return b.touched - a.touched })
			console.group('Top 30 tokens ordered by TOUCHING');
			orderedTokens.slice(0, 30).forEach(function(tok){ console.debug( tok.touched, tok ) })
			console.groupEnd();
		}
		
		return this.buffers;
	}
	
	// TODO: break compile out to its own object, maybe even own file
	// TODO: make two passes, once to concat/clean all adjacent same types, once to actually combine and compile

	,compile: function(options){
		options = options || {};
		options.useWith = options.useWith === true ? true : false;
		options.modelName = options.modelName || 'model';
	
		var	 i
			,len
			,previous = null
			,current = null
			,generated = 'var out = "";\n'
			,modes = VParser.modes
			,reQuote = /[\"']/gi
			,reLineBreak = /[\n\r]/gi

			,func;

		for(i = 0, len = this.buffers.length; i < len; i++){
			previous = current;
			current = this.buffers[i];

			if(current.type === modes.MKP){
				generated += 
					(previous !== null && (previous.type === modes.MKP || previous.type === modes.EXP) 
						? '+' 
						: 'out += ') 
					+ '\'' 
					+ current.value
						.replace(reQuote, '\"')
						.replace(reLineBreak, '\\n') 
					+ '\'\n';
			}

			if(current.type === modes.BLK){
				// Nuke new lines, otherwise causes parse error
				generated += current.value
					.replace(reQuote, '\"')
					.replace(reLineBreak, '') + '\n';
			}

			if(current.type === modes.EXP){
				generated += 
					(previous !== null && (previous.type === modes.MKP || previous.type === modes.EXP) 
						? '+' 
						: 'out +=') 
					//+ ' (' 
					+ current.value
						.replace(reQuote, '\"')
						.replace(reLineBreak, '\\n') 
					+ '\n';//+ ')\n';
			}
		}

		this.debug && console.debug(generated);

		try {

			func = new Function(options.modelName, 
				(options.useWith === true 
					? "with(" + options.modelName + " || {}){" + generated + "}" 
					: generated ) + "\nreturn out;");

		} catch(e){
			e.message += ' :::: GENERATED :::: ' + generated;
			throw e;	
		}

		return func;
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
		this.buffer += tok.val;
	}
	
	,_useTokens: function(toks){
		for(var i = 0, len = toks.length; i < len; i++){
			this.debug && this.consumedTokens.push(toks[i]);
			this.buffer += toks[i].val;
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
		if(this.buffer !== ''){
			this.buffers.push( { type: this.mode, value: this.buffer } );
			this.buffer = '';
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
						this._endMode(VParser.modes.EXP);
						break;
					
					case this.tks.KEYWORD:
					case this.tks.FUNCTION:
					case this.tks.BRACE_OPEN:
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
				if(ahead && (ahead.type === this.tks.IDENTIFIER || ahead.type === this.tks.KEYWORD || ahead.type === this.tks.FUNCTION))
					this._useToken(curr);
				else {
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
