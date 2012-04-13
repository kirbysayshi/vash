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

		,reQuote = /["']/gi
		,reEscapedQuote = /(\\?)(["'])/gi
		,reLineBreak = /[\n\r]/gi
		,joined
		,func;

	function pluckTokVals(toks){
		var i, tok, all = [];

		for(i = 0; i < toks.length; i++){
			all.push(toks[i].val)
		}
		return all.join('');
	}

	function visitMarkupNode(node){

		if(node.starter.length === 0 && node.stopper.length === 0 && node.children.length === 0){
			return;
		}

		if(node.starter.length > 0){
			options.debug 
				&& buffer.push( ';__vline = ' + node.starter[0].line + '; \n')
				&& buffer.push( ';__vchar = ' + node.starter[0].chr + '; \n' );	
		}
		
		buffer.push( "__vout.push('" + pluckTokVals(node.starter)
			.replace(reQuote, '\"').replace(reLineBreak, '\\n') + "'); \n" );

		visitChildren(node)

		if(node.stopper.length > 0){
			options.debug 
				&& buffer.push( ';__vline = ' + node.stopper[0].line + '; \n')
				&& buffer.push( ';__vchar = ' + node.stopper[0].chr + '; \n' );
		}

		buffer.push( "__vout.push('" + pluckTokVals(node.stopper)
			.replace(reQuote, '\"').replace(reLineBreak, '\\n') + "'); \n" );
	}

	function visitBlockNode(node){
		
		buffer.push( pluckTokVals(node.starter).replace(reQuote, '\"') );
		visitChildren(node)
		buffer.push( pluckTokVals(node.stopper).replace(reQuote, '\"') );
	}

	function visitExpressionNode(node){

		var start = '', end = '';

		// deepest, this is also where escaping would be applied, I think...
		if(node.children.length === 0){
			
			if(options.htmlEscape !== false){
				start += "(";
				end += ").toString()\n"
					+ ".replace(/&(?!\w+;)/g, '&amp;')\n"
					+ ".replace(/</g, '&lt;')\n"
					+ ".replace(/>/g, '&gt;')\n"
					+ ".replace(/\"/g, '&quot;') \n";
			} else {
				
			}
		}

		if(node.parent && node.parent.type !== VParser.modes.EXP){
			start += "__vout.push(";
			end += "); \n";
		}

		buffer.push( start + pluckTokVals(node.starter).replace(reQuote, '"').replace(reEscapedQuote, '"') );
		visitChildren(node)
		buffer.push( pluckTokVals(node.stopper).replace(reQuote, '"').replace(reEscapedQuote, '"') + end );
	}

	function visitChildren(node){

		var n, children;

		children = node.children.slice();
		while( (n = children.shift()) ){

			if(n.type === VParser.modes.MKP) { visitMarkupNode(n); }
			if(n.type === VParser.modes.BLK) { visitBlockNode(n); }
			if(n.type === VParser.modes.EXP) { visitExpressionNode(n); }
		}
	}

	// suprisingly: http://jsperf.com/array-index-vs-push
	buffer.unshift("var __vout = []; \n");

	options.debug && buffer.push('var __vline = 0, __vchar = 0; \n');

	visitChildren(this.ast.current);

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