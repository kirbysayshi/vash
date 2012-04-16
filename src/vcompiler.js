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
		,escapeStack = []

		,reQuote = /["']/gi
		,reEscapedQuote = /(\\?)(["'])/gi
		,reLineBreak = /[\n\r]/gi
		,joined
		,func;

	function insertDebugVars(tok){
		if(options.debug){
			buffer.push( '__vline = ' + tok.line + ', ');
			buffer.push( '__vchar = ' + tok.chr + '; \n' );
		}
	}

	function visitMarkupTok(tok, parentNode, index){

		insertDebugVars(tok);
		buffer.push( "__vout.push('" + tok.val
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
					start += '( typeof (__vtemp = ';	
				}
			}

			if( parentParentIsNotEXP && index === parentNode.length - 1 && isHomogenous){

				if(escapeStack.length > 0){
					escapeStack.pop();
				} else {
					end += ") !== 'undefined' ? __vtemp : '' ).toString()\n"
						+ ".replace(/&(?!\w+;)/g, '&amp;')\n"
						+ ".replace(/</g, '&lt;')\n"
						+ ".replace(/>/g, '&gt;')\n"
						+ ".replace(/\"/g, '&quot;') \n";
				}
			}	
		}

		if(parentParentIsNotEXP && (index === 0 || (index === 1 && parentNode[0].type === VLexer.tks.HTML_RAW) ) ){
			insertDebugVars(tok)
			start = "__vout.push(" + start;	
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
	buffer.unshift("var __vout = [], __vtemp; \n");

	options.debug && buffer.push('var __vline = 0, __vchar = 0; \n');

	visitNode(this.ast);

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