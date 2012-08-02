/*jshint strict:false, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

function VParser(tokens, options){

	this.options = options || {};
	this.tokens = tokens;
	this.ast = vQuery(PRG);
	this.prevTokens = [];
}

var PRG = "PROGRAM", MKP = "MARKUP", BLK = "BLOCK", EXP = "EXPRESSION" ;

VParser.prototype = {

	parse: function(){
		var curr, i, len, block, handler;

		while( this.prevTokens.push( curr ), (curr = this.tokens.pop()) ){

			handler = undefined;

			if(this.options.debugParser){
				console.log(this.ast && this.ast.mode, curr.type, curr, curr.val);
			}

			if(this.ast.mode === PRG || this.ast.mode === null){
				
				this.ast = this.ast.beget( this.options.initialMode || MKP );

				if(this.options.initialMode === EXP){
					this.ast = this.ast.beget( EXP ); // EXP needs to know it's within to continue
				}
			}

			if(this.ast.mode === MKP){
				this.handleMKP(curr);
				continue;
			}
			
			if(this.ast.mode === BLK){
				handler = this.BLKS[curr.type] || this.BLKS.DEFAULT;
			}
			
			if(this.ast.mode === EXP){
				handler = this.EXPS[curr.type] || this.EXPS.DEFAULT;
			}

			if(handler){
				handler.call(this, curr);
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

			this.ast = this.ast.root();

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
			if(!next) { throw this.exceptionFactory(new Error(), 'UNMATCHED', curr); }
		}
		
		return tks.reverse();
	}

	,subParse: function(curr, modeToOpen){
		var  subTokens
			,closer
			,miniParse
			,parseOpts = vQuery.extend({}, this.options);
		
		parseOpts.initialMode = modeToOpen;
		
		subTokens = this.advanceUntilMatched(
			curr
			,curr.type
			,PAIRS[ curr.type ]
			,null
			,AT );
		
		subTokens.pop();
		
		closer = subTokens.shift();

		this.ast.push(curr);

		miniParse = new VParser( subTokens, parseOpts );
		miniParse.parse();

		this.ast.pushFlatten(miniParse.ast);
		this.ast.push(closer);
	}

	,handleMKP: function(curr){
		var  next = this.tokens[ this.tokens.length - 1 ]
			,ahead = this.tokens[ this.tokens.length - 2 ]
			,tagName = null
			,opener;
		
		switch(curr.type){
			
			case AT_STAR_OPEN:
				this.advanceUntilMatched(curr, AT_STAR_OPEN, AT_STAR_CLOSE, AT, AT);
				break;
			
			case AT:
				if(next) { switch(next.type){
					
					case PAREN_OPEN:
					case IDENTIFIER:
					case HTML_RAW:

						if(this.ast.length === 0) {
							this.ast = this.ast.parent;
							this.ast.pop(); // remove empty MKP block
						}

						this.ast = this.ast.beget( EXP );
						break;
					
					case KEYWORD:
					case FUNCTION:
					case BRACE_OPEN:

						if(this.ast.length === 0) {
							this.ast = this.ast.parent;
							this.ast.pop(); // remove empty MKP block
						}

						this.ast = this.ast.beget( BLK );
						break;
					
					default:
						this.ast.push( this.tokens.pop() );
						break;
				} }
				break;
			
			case BRACE_OPEN:
				this.ast = this.ast.beget( BLK );
				this.tokens.push(curr); // defer
				break;

			case BRACE_CLOSE:
				this.ast = this.ast.parent;
				this.tokens.push(curr); // defer
				break;
			
			case TEXT_TAG_OPEN:
			case HTML_TAG_OPEN:
				tagName = curr.val.match(/^<([^\/ >]+)/i);
				
				if(tagName === null && next && next.type === AT && ahead){
					tagName = ahead.val.match(/(.*)/); // HACK for <@exp>
				}

				if(this.ast.tagName){
					// current markup is already waiting for a close tag, make new child
					this.ast = this.ast.beget(MKP, tagName[1]);
				} else {
					this.ast.tagName = tagName[1];
				}

				if(HTML_TAG_OPEN === curr.type) {
					this.ast.push(curr);
				}

				break;
			
			case TEXT_TAG_CLOSE:
			case HTML_TAG_CLOSE:
				tagName = curr.val.match(/^<\/([^>]+)/i);
				
				if(tagName === null && next && next.type === AT && ahead){
					tagName = ahead.val.match(/(.*)/); // HACK for </@exp>
				}
				
				opener = this.ast.closest( MKP, tagName[1] );
				
				if(opener === null || opener.tagName !== tagName[1]){
					// couldn't find opening tag
					// could mean this closer is within a child parser
					//throw this.exceptionFactory(new Error, 'UNMATCHED', curr);
				} else {
					this.ast = opener;
				}
				
				if(HTML_TAG_CLOSE === curr.type) {
					this.ast.push( curr );
				}

				if(
					this.ast.parent && this.ast.parent.mode === BLK
					&& (next && (next.type === WHITESPACE || next.type === NEWLINE))
				){
					this.ast = this.ast.parent;
				}
				break;

			case HTML_TAG_SELFCLOSE:

				this.ast.push(curr);

				if(
					this.ast.parent && this.ast.parent.mode === BLK
					&& (next && (next.type === WHITESPACE || next.type === NEWLINE))
				){
					this.ast = this.ast.parent;
				}
				break;

			default:
				this.ast.push(curr);
				break;
		}
		
	}

	,MKPS: {}
	,BLKS: {}
	,EXPS: {}
}


var  MKPS = VParser.prototype.MKPS
	,BLKS = VParser.prototype.BLKS
	,EXPS = VParser.prototype.EXPS;

///////////////////////////////////////////////////////////////////////////////
// MARKUP HANDLERS
///////////////////////////////////////////////////////////////////////////////



///////////////////////////////////////////////////////////////////////////////
// BLOCK HANDLERS
///////////////////////////////////////////////////////////////////////////////

BLKS.AT = function(curr){
	var next = this.tokens[ this.tokens.length - 1 ]

	if(next.type !== AT){
		this.tokens.push(curr); // defer
		this.ast = this.ast.beget(MKP);
	}
}

BLKS.AT_COLON = function(curr){
	this.ast = this.ast.beget(MKP);
}
				
BLKS.TEXT_TAG_OPEN = 
BLKS.TEXT_TAG_CLOSE = 
BLKS.HTML_TAG_SELFCLOSE = 
BLKS.HTML_TAG_OPEN = 
BLKS.HTML_TAG_CLOSE = function(curr){
	this.ast = this.ast.beget(MKP);
	this.tokens.push(curr); // defer
}

BLKS.FAT_ARROW = function(curr){
	this.ast = this.ast.beget(BLK);
}

BLKS.BRACE_OPEN = 
BLKS.PAREN_OPEN = function(curr){
	var  next
		,subTokens;

	this.subParse(curr, BLK);
	
	subTokens = this.advanceUntilNot(WHITESPACE);
	next = this.tokens[ this.tokens.length - 1 ];

	if(
		next
		&& next.type !== KEYWORD
		&& next.type !== FUNCTION
		&& next.type !== BRACE_OPEN
		&& curr.type !== PAREN_OPEN
	){
		// defer whitespace
		this.tokens.push.apply(this.tokens, subTokens.reverse());
		this.ast = this.ast.parent;
	} else {
		this.ast.push(subTokens);
	}

}

BLKS.WHITESPACE = function(curr){
	this.ast.push(curr);
	this.advanceUntilNot(WHITESPACE);
}

BLKS.DEFAULT = function(curr){
	this.ast.push(curr);
}


///////////////////////////////////////////////////////////////////////////////
// EXP HANDLERS
///////////////////////////////////////////////////////////////////////////////

EXPS.FUNCTION = EXPS.KEYWORD = function(curr){
	this.ast = this.ast.beget(BLK);
	this.tokens.push(curr); // defer
}

EXPS.WHITESPACE = 
EXPS.LOGICAL = 
EXPS.ASSIGN_OPERATOR = 
EXPS.OPERATOR = 
EXPS.NUMERIC_CONTENT = function(curr){
	if(this.ast.parent && this.ast.parent.mode === EXP){

		this.ast.push(curr);
	} else {

		// if not contained within a parent EXP, must be end of EXP
		this.ast = this.ast.parent;
		this.tokens.push(curr); // defer
	}
}

EXPS.IDENTIFIER = 
EXPS.HTML_RAW = function(curr){
	this.ast.push(curr);
}

EXPS.SINGLE_QUOTE =
EXPS.DOUBLE_QUOTE = function(curr){

	var subTokens;

	if(this.ast.parent && this.ast.parent.mode === EXP){
		subTokens = this.advanceUntilMatched(
			curr
			,curr.type
			,PAIRS[ curr.type ]
			,BACKSLASH
			,BACKSLASH );
		this.ast.pushFlatten(subTokens.reverse());

	} else {
		// probably end of expression
		this.ast = this.ast.parent;
		this.tokens.push(curr); // defer
	}
}

EXPS.HARD_PAREN_OPEN = 
EXPS.PAREN_OPEN = function(curr){
	var prev, ahead;

	prev = this.prevTokens[ this.prevTokens.length - 1 ];
	this.subParse(curr, EXP);
	ahead = this.tokens[ this.tokens.length - 1 ];

	if( (prev && prev.type === AT) || (ahead && ahead.type === IDENTIFIER) ){
		// explicit expression is automatically ended
		this.ast = this.ast.parent;
	}
}

EXPS.BRACE_OPEN = function(curr){
	this.tokens.push(curr); // defer
	this.ast = this.ast.beget(BLK);
}

EXPS.PERIOD = function(curr){
	var ahead = this.tokens[ this.tokens.length - 1 ];
	if(
		ahead &&
		(  ahead.type === IDENTIFIER
		|| ahead.type === KEYWORD
		|| ahead.type === FUNCTION
		|| ahead.type === PERIOD )
	) {
		this.ast.push(curr);
	} else {
		this.ast = this.ast.parent;
		this.tokens.push(curr); // defer
	}
}

EXPS.DEFAULT = function(curr){

	if( this.ast.parent && this.ast.parent.mode !== EXP ){
		// assume end of expression
		this.ast = this.ast.parent;
		this.tokens.push(curr); // defer
	} else {
		this.ast.push(curr);
	}
}
