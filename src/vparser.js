
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
			throw new Error('Stack Underflow');
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
};

function VParser(str){
	this.lex = new VLexer(str);
	this.tks = VLexer.tks;
	
	this.blockStack = new Stack();
	this.mode = VParser.modes.MKP;
	
	this.buffer = '';
	this.buffers = [];

	this.debug = false;
}

VParser.modes = { MKP: "MARKUP", BLK: "BLOCK", EXP: "EXPRESSION" };

VParser.exceptions = (function(){

	var err = {
		UNMATCHED: function UNMATCHED(tok){
			this.name = "UnmatchedCharacterError";
			this.message = 'Unmatched ' + tok.type
				+ ' at line ' + tok.line
				+ ', character ' + tok.chr
				+ '. Value: ' + tok.val
			this.lineNumber = tok.line;
			this.stack = '';
		}
	};
	
	for(var e in err){
		if(err.hasOwnProperty(e)){
			err[e].prototype = new Error();
			err[e].constructor = err[e];
		}
	}
	
	return err;
})();

VParser.prototype = {

	parse: function(){
		var curr, i, len, block;
		
		while( (curr = this.lex.advance()) ){
			this.debug && console.debug(curr.val, curr.type, curr);
			
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
				throw new VParser.exceptions.UNMATCHED(block.tok);
		}
			
		
		return this.buffers;
	}
	
	,compile: function(options){
		options = options || {};
		options.useWith = options.useWith === false ? false : true;
		options.modelName = options.modelName || 'model';
	
		var	 i
			,len
			,previous = null
			,current = null
			,generated = 'var out = "";\n'
			,modes = VParser.modes
			,reQuote = /[\"']/gi
			,reLineBreak = /[\n\r]/gi;

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
					+ ' (' 
					+ current.value
						.replace(reQuote, '\"')
						.replace(reLineBreak, '\\n') 
					+ ')\n';
			}
		}

		return new Function(options.modelName, 
			(options.useWith === true 
				? "with(" + options.modelName + " || {}){" + generated + "}" 
				: generated ) + "\nreturn out;");
	
	}
	
	,_useToken: function(tok){
		this.buffer += tok.val;
	}
	
	,_useTokens: function(toks){
		for(var i = 0, len = toks.length; i < len; i++){
			this.buffer += toks[i].val;
		}
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
			if(!next) throw new VParser.exceptions.UNMATCHED(curr);
		}
		
		return tks;
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
			,tagName = null;
		
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
					case this.tks.BRACE_OPEN:
						this._endMode(VParser.modes.BLK);
						break;
					
					default:
						this._useToken(this.lex.advance());

						break;
				}
				break;		
			
			case this.tks.BRACE_CLOSE:
				block = this.blockStack.peek();
				if(block !== null && block.type === VParser.modes.MKP)
					this._useToken(curr);
				else {
					this._endMode(VParser.modes.BLK);
					this.lex.defer(curr);
				}
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
				
				block = this.blockStack.peek();
				if(block !== null && block.type === VParser.modes.MKP && tagName[1] === block.tag){
					this.blockStack.pop();
				}
				
				if(this.tks.HTML_TAG_CLOSE === curr.type) this._useToken(curr);

				block = this.blockStack.peek();
				if(block !== null && block.type === VParser.modes.BLK){
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
			,block = null;
		
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
				this.blockStack.push({ type: VParser.modes.BLK, tok: curr });
				this._useToken(curr);
				break;
			
			case this.tks.BRACE_CLOSE:
				block = this.blockStack.peek();
				// TODO: throw error if not BLK
				if(block === null || (block !== null && block.type !== VParser.modes.BLK))
					throw new VParser.exceptions.UNMATCHED(curr);
				this.blockStack.pop();
				this._useToken(curr);
				
				block = this.blockStack.peek();
				if(block !== null && block.type === VParser.modes.MKP) 
					this._endMode(VParser.modes.MKP);
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
				this._endMode(VParser.modes.BLK);
				this.lex.defer(curr);
				break
			
			case this.tks.IDENTIFIER:
				this._useToken(curr);		
				break;
			
			case this.tks.HARD_PAREN_OPEN:
				this._useTokens(this._advanceUntilMatched(curr, this.tks.HARD_PAREN_OPEN, this.tks.HARD_PAREN_CLOSE));
				break;
			
			case this.tks.PAREN_OPEN:
				this._useTokens(this._advanceUntilMatched(curr, this.tks.PAREN_OPEN, this.tks.PAREN_CLOSE));
				break;
			
			case this.tks.PERIOD:
				ahead = this.lex.lookahead(1);
				if(ahead && ahead.type === this.tks.IDENTIFIER)
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
