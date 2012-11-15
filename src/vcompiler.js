/*jshint strict:false, asi:true, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

function VCompiler(ast, originalMarkup, Helpers){
	this.ast = ast;
	this.originalMarkup = originalMarkup || '';
	this.Helpers = Helpers || vash.helpers.constructor;
}

var VCP = VCompiler.prototype;

VCP.generate = function(options){

	options = options || {};

	var buffer = []

		,reQuote = /(["'])/gi
		,reEscapedQuote = /\\+(["'])/gi
		,reLineBreak = /[\n\r]/gi
		,joined
		,compiledFunc
		,linkedFunc

	function insertDebugVars(tok){
		if(options.debug){
			buffer.push(
				 options.helpersName + '.vl = ' + tok.line + ', '
				,options.helpersName + '.vc = ' + tok.chr + '; \n'
			);
		}
	}

	function visitMarkupTok(tok, parentNode, index){

		insertDebugVars(tok);
		buffer.push(
			"MKP('" + tok.val
				.replace(reQuote, '\\$1')
				.replace(reLineBreak, '\\n')
			+ "')MKP" );
	}

	function visitBlockTok(tok, parentNode, index){

		buffer.push( tok.val /*.replace(reQuote, '\"')*/ );
	}

	function visitExpressionTok(tok, parentNode, index, isHomogenous){

		var  start = ''
			,end = ''
			,parentParentIsNotEXP = parentNode.parent && parentNode.parent.mode !== EXP;

		if(options.htmlEscape !== false){

			if( parentParentIsNotEXP && index === 0 && isHomogenous ){
				start += options.helpersName + '.escape(';
			}

			if( parentParentIsNotEXP && index === parentNode.length - 1 && isHomogenous){
				end += ").toHtmlString()";
			}
		}

		if(parentParentIsNotEXP && (index === 0 ) ){
			insertDebugVars(tok);
			start = "__vbuffer.push(" + start;
		}

		if( parentParentIsNotEXP && index === parentNode.length - 1 ){
			end += "); \n";
		}

		buffer.push( start + tok.val + end );

		if(parentParentIsNotEXP && index === parentNode.length - 1){
			insertDebugVars(tok);
		}
	}

	function visitNode(node){

		var n, children = node.slice(0), nonExp, i, child;

		if(node.mode === EXP && (node.parent && node.parent.mode !== EXP)){
			// see if this node's children are all EXP
			nonExp = node.filter(findNonExp).length;
		}

		for(i = 0; i < children.length; i++){
			child = children[i];

			// if saveAT is true, or if AT_COLON is used, these should not be compiled
			if( child.type && child.type === AT || child.type === AT_COLON ) continue;

			if(child.vquery){

				visitNode(child);

			} else if(node.mode === MKP){

				visitMarkupTok(child, node, i);

			} else if(node.mode === BLK){

				visitBlockTok(child, node, i);

			} else if(node.mode === EXP){

				visitExpressionTok(child, node, i, (nonExp > 0 ? false : true));

			}
		}

	}

	function findNonExp(node){

		if(node.vquery && node.mode === EXP){
			return node.filter(findNonExp).length > 0;
		}

		if(node.vquery && node.mode !== EXP){
			return true;
		} else {
			return false;
		}
	}

	function escapeForDebug( str ){
		return str
			.replace(reLineBreak, '!LB!')
			.replace(reQuote, '\\$1')
			.replace(reEscapedQuote, '\\$1')
	}

	function replaceDevTokens( str ){
		return str
			.replace( /HELPERSNAME/g, options.helpersName )
			.replace( /MODELNAME/g, options.modelName );
	}

	var head = ''
		+ (options.debug ? 'try { \n' : '')
		+ 'var __vbuffer = HELPERSNAME.buffer; \n'
		+ (options.useWith ? 'with( MODELNAME || {} ){ \n' : '');

	var foot = ''
		+ 'return HELPERSNAME; \n'
		+ (options.debug ? '} catch( e ){ \n'
			+ 'HELPERSNAME.reportError( e, HELPERSNAME.vl, HELPERSNAME.vc, '
			+ '"' + escapeForDebug( this.originalMarkup ) + '"'
			+ ' ); \n'
			+ '} \n' : '')
		+ (options.useWith ? '} \n' : '');

	head = replaceDevTokens( head );
	foot = replaceDevTokens( foot );

	visitNode(this.ast);

	// coalesce markup
	joined = buffer
		.join("")
		.split("')MKPMKP('").join('')
		.split("MKP(").join( "__vbuffer.push(")
		.split(")MKP").join("); \n");

	joined = head + joined + foot;

	if(options.debugCompiler){
		console.log(joined);
	}

	try {
		compiledFunc = new Function(options.modelName, options.helpersName, joined);
	} catch(e){
		this.Helpers.reportError(e, 0, 0, joined, /\n/)
	}

	return compiledFunc;
}

VCP.assemble = function( cmpFunc ){
	return VCompiler.assemble( cmpFunc, this.Helpers );
}

VCompiler.assemble = function( cmpFunc, Helpers ){
	Helpers = Helpers || vash.helpers.constructor;

	var linked = function( model ){
		return cmpFunc( model, new Helpers( model ) );
	}

	linked.toString = function(){
		return cmpFunc.toString();
	}

	linked.toClientString = function(){
		return 'vash.link( ' + cmpFunc.toString() + ' )';
	}

	return linked;
}
