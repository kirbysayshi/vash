/*jshint strict:false, asi:true, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

var lx = require('./vlexer');
var vQuery = require('./vast');

function VParser(tokens, options){

	this.options = options || {};
	this.tokens = tokens;
	this.ast = vQuery(PRG);
	this.prevTokens = [];

	this.inCommentLine = false;
}

module.exports = VParser;

var PRG = "PROGRAM", MKP = "MARKUP", BLK = "BLOCK", EXP = "EXPRESSION" ;

VParser.prototype = {

	parse: function(){
		var curr, i, len, block;

		while( this.prevTokens.push( curr ), (curr = this.tokens.pop()) ){

			if(this.options.debugParser){
				console.log(this.ast && this.ast.mode, curr.type, curr.toString(), curr.val);
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
				this.handleBLK(curr);
				continue;
			}

			if(this.ast.mode === EXP){
				this.handleEXP(curr);
				continue;
			}
		}

		this.ast = this.ast.root();

		if(this.options.debugParser && !this.options.initialMode){
			// this should really only output on the true root

			console.log(this.ast.toString());
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

				if( (prev && prev.type !== startEscape && start !== end) || !prev ){
					nstart++;
				} else if( start === end && prev.type !== startEscape ) {
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

	,subParse: function(curr, modeToOpen, includeDelimsInSub){
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

		if( !includeDelimsInSub ){
			this.ast.push(curr);
		}

		miniParse = new VParser( subTokens, parseOpts );
		miniParse.parse();

		if( includeDelimsInSub ){
			// attach delimiters to [0] (first child), because ast is PROGRAM
			miniParse.ast[0].unshift( curr );
			miniParse.ast[0].push( closer );
		}

		this.ast.pushFlatten(miniParse.ast);

		if( !includeDelimsInSub ){
			this.ast.push(closer);
		}
	}

	,handleMKP: function(curr){
		var  next = this.tokens[ this.tokens.length - 1 ]
			,ahead = this.tokens[ this.tokens.length - 2 ]
			,tagName = null
			,opener;

		switch(curr.type){

			case lx.AT_STAR_OPEN:
				this.advanceUntilMatched(curr, lx.AT_STAR_OPEN, lx.AT_STAR_CLOSE, lx.AT, lx.AT);
				break;

			case lx.AT:
				if(next) {

					if(this.options.saveAT) this.ast.push( curr );

					switch(next.type){

						case lx.PAREN_OPEN:
						case lx.IDENTIFIER:

							if(this.ast.length === 0) {
								this.ast = this.ast.parent;
								this.ast.pop(); // remove empty MKP block
							}

							this.ast = this.ast.beget( EXP );
							break;

						case lx.KEYWORD:
						case lx.FUNCTION:
						case lx.BRACE_OPEN:

							if(this.ast.length === 0) {
								this.ast = this.ast.parent;
								this.ast.pop(); // remove empty MKP block
							}

							this.ast = this.ast.beget( BLK );
							break;

						case lx.AT:
						case lx.AT_COLON:

							// we want to keep the token, but remove its
							// "special" meaning because during compilation
							// AT and AT_COLON are discarded
							next.type = 'CONTENT';
							this.ast.push( this.tokens.pop() );
							break;

						default:
							this.ast.push( this.tokens.pop() );
							break;
					}

				}
				break;

			case lx.TEXT_TAG_OPEN:
			case lx.HTML_TAG_OPEN:
			case lx.HTML_TAG_VOID_OPEN:
				tagName = curr.val.match(/^<([^\/ >]+)/i);

				if(tagName === null && next && next.type === lx.AT && ahead){
					tagName = ahead.val.match(/(.*)/); // HACK for <@exp>
				}

				if(this.ast.tagName){
					// current markup is already waiting for a close tag, make new child
					this.ast = this.ast.beget(MKP, tagName[1]);
				} else {
					this.ast.tagName = tagName[1];
				}

				// mark this ast as void, to enable recognition of HTML_TAG_VOID_CLOSE,
				// which is otherwise generic
				if(curr.type === lx.HTML_TAG_VOID_OPEN){
					this.ast.tagVoid = this.ast.tagName;
				}

				if(
					lx.HTML_TAG_VOID_OPEN === curr.type
					|| lx.HTML_TAG_OPEN === curr.type
					|| this.options.saveTextTag
				){
					this.ast.push(curr);
				}

				break;

			case lx.TEXT_TAG_CLOSE:
			case lx.HTML_TAG_CLOSE:
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

				if(lx.HTML_TAG_CLOSE === curr.type || this.options.saveTextTag) {
					this.ast.push( curr );
				}

				// close this ast if parent is BLK. if another tag follows, BLK will
				// flip over to MKP
				if( this.ast.parent && this.ast.parent.mode === BLK ){
					this.ast = this.ast.parent;
				}

				break;

			case lx.HTML_TAG_VOID_CLOSE:

				// this should only be a valid token if tagVoid is defined, meaning
				// HTML_TAG_VOID_OPEN was previously found within this markup block
				if(this.ast.tagVoid){
					this.ast.push(curr);
					this.ast = this.ast.parent;
				} else {
					this.tokens.push(curr); // defer
				}

				break;

			case lx.BACKSLASH:
				curr.val += '\\';
				this.ast.push(curr);
				break;

			default:
				this.ast.push(curr);
				break;
		}

	}

	,handleBLK: function(curr){

		var  next = this.tokens[ this.tokens.length - 1 ]
			,submode
			,opener
			,closer
			,subTokens
			,parseOpts
			,miniParse
			,i;

		switch(curr.type){

			case lx.AT:
				if(next.type !== lx.AT && !this.inCommentLine){
					this.tokens.push(curr); // defer
					this.ast = this.ast.beget(MKP);
				} else {
					// we want to keep the token, but remove its
					// "special" meaning because during compilation
					// AT and AT_COLON are discarded
					next.type = lx.CONTENT;
					this.ast.push(next);
					this.tokens.pop(); // skip following AT
				}
				break;

			case lx.AT_STAR_OPEN:
				this.advanceUntilMatched(curr, lx.AT_STAR_OPEN, lx.AT_STAR_CLOSE, lx.AT, lx.AT);
				break;

			case lx.AT_COLON:
				this.subParse(curr, MKP, true);
				break;

			case lx.TEXT_TAG_OPEN:
			case lx.TEXT_TAG_CLOSE:
			case lx.HTML_TAG_VOID_OPEN:
			case lx.HTML_TAG_OPEN:
			case lx.HTML_TAG_CLOSE:
				this.ast = this.ast.beget(MKP);
				this.tokens.push(curr); // defer
				break;

			case lx.FORWARD_SLASH:
			case lx.SINGLE_QUOTE:
			case lx.DOUBLE_QUOTE:
				if(
					curr.type === lx.FORWARD_SLASH
					&& next
					&& next.type === lx.FORWARD_SLASH
				){
					this.inCommentLine = true;
				}

				if(!this.inCommentLine) {
					// assume regex or quoted string
					subTokens = this.advanceUntilMatched(
						 curr
						,curr.type
						,lx.PAIRS[ curr.type ]
						,lx.BACKSLASH
						,lx.BACKSLASH ).map(function(tok){
							// mark AT within a regex/quoted string as literal
							if(tok.type === lx.AT) tok.type = lx.CONTENT;
							return tok;
						});
					this.ast.pushFlatten(subTokens.reverse());
				} else {
					this.ast.push(curr);
				}

				break;

			case lx.NEWLINE:
				if(this.inCommentLine){
					this.inCommentLine = false;
				}
				this.ast.push(curr);
				break;

			case lx.BRACE_OPEN:
			case lx.PAREN_OPEN:
				submode = this.options.favorText && curr.type === lx.BRACE_OPEN
					? MKP
					: BLK;

				this.subParse( curr, submode );

				subTokens = this.advanceUntilNot(lx.WHITESPACE);
				next = this.tokens[ this.tokens.length - 1 ];

				if(
					next
					&& next.type !== lx.KEYWORD
					&& next.type !== lx.FUNCTION
					&& next.type !== lx.BRACE_OPEN
					&& curr.type !== lx.PAREN_OPEN
				){
					// defer whitespace
					this.tokens.push.apply(this.tokens, subTokens.reverse());
					this.ast = this.ast.parent;
				} else {
					this.ast.push(subTokens);
				}

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
			,prev
			,i;

		switch(curr.type){

			case lx.KEYWORD:
			case lx.FUNCTION:
				this.ast = this.ast.beget(BLK);
				this.tokens.push(curr); // defer
				break;

			case lx.WHITESPACE:
			case lx.LOGICAL:
			case lx.ASSIGN_OPERATOR:
			case lx.OPERATOR:
			case lx.NUMERIC_CONTENT:
				if(this.ast.parent && this.ast.parent.mode === EXP){

					this.ast.push(curr);
				} else {

					// if not contained within a parent EXP, must be end of EXP
					this.ast = this.ast.parent;
					this.tokens.push(curr); // defer
				}

				break;

			case lx.IDENTIFIER:
				this.ast.push(curr);
				break;

			case lx.SINGLE_QUOTE:
			case lx.DOUBLE_QUOTE:

				if(this.ast.parent && this.ast.parent.mode === EXP){
					subTokens = this.advanceUntilMatched(
						curr
						,curr.type
						,lx.PAIRS[ curr.type ]
						,lx.BACKSLASH
						,lx.BACKSLASH );
					this.ast.pushFlatten(subTokens.reverse());

				} else {
					// probably end of expression
					this.ast = this.ast.parent;
					this.tokens.push(curr); // defer
				}

				break;

			case lx.HARD_PAREN_OPEN:
			case lx.PAREN_OPEN:

				prev = this.prevTokens[ this.prevTokens.length - 1 ];
				ahead = this.tokens[ this.tokens.length - 1 ];

				if( curr.type === lx.HARD_PAREN_OPEN && ahead.type === lx.HARD_PAREN_CLOSE ){
					// likely just [], which is not likely valid outside of EXP
					this.tokens.push(curr); // defer
					this.ast = this.ast.parent; //this.ast.beget(MKP);
					break;
				}

				this.subParse(curr, EXP);
				ahead = this.tokens[ this.tokens.length - 1 ];

				if( (prev && prev.type === lx.AT) || (ahead && ahead.type === lx.IDENTIFIER) ){
					// explicit expression is automatically ended
					this.ast = this.ast.parent;
				}

				break;

			case lx.BRACE_OPEN:
				this.tokens.push(curr); // defer
				this.ast = this.ast.beget(BLK);
				break;

			case lx.PERIOD:
				ahead = this.tokens[ this.tokens.length - 1 ];
				if(
					ahead &&
					(  ahead.type === lx.IDENTIFIER
					|| ahead.type === lx.KEYWORD
					|| ahead.type === lx.FUNCTION
					|| ahead.type === lx.PERIOD
					// if it's "expressions all the way down", then there is no way
					// to exit EXP mode without running out of tokens, i.e. we're
					// within a sub parser
					|| this.ast.parent && this.ast.parent.mode === EXP )
				) {
					this.ast.push(curr);
				} else {
					this.ast = this.ast.parent;
					this.tokens.push(curr); // defer
				}
				break;

			default:

				if( this.ast.parent && this.ast.parent.mode !== EXP ){
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
