/*jshint strict:false, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

function VParser(tokens, options){

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

	,advanceUntilMatched: function(curr, start, end, startEscape, endEscape){
		var  next = curr
			,prev = null
			,nstart = 0
			,nend = 0
			,tks = [];
		
		// this is fairly convoluted because the start and end for single/double
		// quotes is the same, and can also be escaped

		while(next){

			if( next.type === start ){

				if( (prev && prev.type !== escape && start !== end) || !prev ){
					nstart++;
				} else if( start === end ) {
					nend++;
				}
				
			} else if( next.type === end ){
				nend++;
				if(prev && prev.type === endEscape){ nend--; }
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
				this.advanceUntilMatched(curr, VLexer.tks.AT_STAR_OPEN, VLexer.tks.AT_STAR_CLOSE, VLexer.tks.AT, VLexer.tks.AT);
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
				subTokens = this.advanceUntilMatched( curr, curr.type, VLexer.pairs[ curr.type ], null, VLexer.tks.AT );
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
					subTokens = this.advanceUntilMatched( 
						 curr
						,curr.type
						,VLexer.pairs[ curr.type ]
						,VLexer.tks.BACKSLASH
						,VLexer.tks.BACKSLASH );
					this.ast.pushFlatten(subTokens.reverse());

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
				subTokens = this.advanceUntilMatched( 
					curr
					,curr.type
					,VLexer.pairs[ curr.type ]
					,null
					,VLexer.tks.AT );
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
						|| ahead.type === VLexer.tks.FUNCTION
						|| ahead.type === VLexer.tks.PERIOD)
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