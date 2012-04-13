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

				this.ast.openNewAsChild( VParser.modes.MKP );
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
				
				} else {

					if(this.ast.current.closed()){
						this.ast.closeCurrent();
						this.tokens.push(curr); // defer
					} else {
						subTokens = this.advanceUntilMatched( curr, curr.type, VLexer.pairs[ curr.type ] );
						this.ast.useToken(subTokens);	
					}	
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