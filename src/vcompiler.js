/*jshint strict:false, asi:true, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

function VCompiler(ast, originalMarkup, options){
	this.ast = ast;
	this.originalMarkup = originalMarkup || '';
	this.options = options || {};

	this.reQuote = /(['"])/gi
	this.reEscapedQuote = /\\+(["'])/gi
	this.reLineBreak = /\r?\n/gi
	this.reHelpersName = /HELPERSNAME/g
	this.reModelName = /MODELNAME/g
	this.reOriginalMarkup = /ORIGINALMARKUP/g

	this.buffer = [];
}

var VCP = VCompiler.prototype;

VCP.insertDebugVars = function(tok){

	if(this.options.debug){
		this.buffer.push(
			this.options.helpersName + '.vl = ' + tok.line + ', '
			,this.options.helpersName + '.vc = ' + tok.chr + '; \n'
		);
	}
}

VCP.visitMarkupTok = function(tok, parentNode, index){

	this.insertDebugVars(tok);
	this.buffer.push(
		"MKP(" + tok.val
			.replace(this.reEscapedQuote, '\\\\$1')
			.replace(this.reQuote, '\\$1')
			.replace(this.reLineBreak, '\\n')
		+ ")MKP" );
}

VCP.visitBlockTok = function(tok, parentNode, index){

	this.buffer.push( tok.val );
}

VCP.visitExpressionTok = function(tok, parentNode, index, isHomogenous){

	var  start = ''
		,end = ''
		,parentParentIsNotEXP = parentNode.parent && parentNode.parent.mode !== EXP;

	if(this.options.htmlEscape !== false){

		if( parentParentIsNotEXP && index === 0 && isHomogenous ){
			start += this.options.helpersName + '.escape(';
		}

		if( parentParentIsNotEXP && index === parentNode.length - 1 && isHomogenous){
			end += ").toHtmlString()";
		}
	}

	if(parentParentIsNotEXP && (index === 0 ) ){
		this.insertDebugVars(tok);
		start = "__vbuffer.push(" + start;
	}

	if( parentParentIsNotEXP && index === parentNode.length - 1 ){
		end += "); \n";
	}

	this.buffer.push( start + tok.val + end );

	if(parentParentIsNotEXP && index === parentNode.length - 1){
		this.insertDebugVars(tok);
	}
}

VCP.visitNode = function(node){

	var n, children = node.slice(0), nonExp, i, child;

	if(node.mode === EXP && (node.parent && node.parent.mode !== EXP)){
		// see if this node's children are all EXP
		nonExp = node.filter(VCompiler.findNonExp).length;
	}

	for(i = 0; i < children.length; i++){
		child = children[i];

		// if saveAT is true, or if AT_COLON is used, these should not be compiled
		if( child.type && child.type === AT || child.type === AT_COLON ) continue;

		if(child.vquery){

			this.visitNode(child);

		} else if(node.mode === MKP){

			this.visitMarkupTok(child, node, i);

		} else if(node.mode === BLK){

			this.visitBlockTok(child, node, i);

		} else if(node.mode === EXP){

			this.visitExpressionTok(child, node, i, (nonExp > 0 ? false : true));

		}
	}

}

VCP.escapeForDebug = function( str ){
	return str
		.replace(this.reLineBreak, '!LB!')
		.replace(this.reQuote, '\\$1')
		.replace(this.reEscapedQuote, '\\$1')
}

VCP.replaceDevTokens = function( str ){
	return str
		.replace( this.reHelpersName, this.options.helpersName )
		.replace( this.reModelName, this.options.modelName );
}

VCP.addHead = function(body){

	var options = this.options;

	var head = ''
		+ (options.debug ? 'try { \n' : '')
		+ 'var __vbuffer = HELPERSNAME.buffer; \n'
		+ 'HELPERSNAME.options = __vopts; \n'
		+ 'MODELNAME = MODELNAME || {}; \n'
		+ (options.useWith ? 'with( MODELNAME ){ \n' : '');

	head = this.replaceDevTokens( head );
	return head + body;
}

VCP.addHelperHead = function(body){

	var options = this.options;

	var head = ''
		+ (options.debug ? 'try { \n' : '')
		+ 'var __vbuffer = this.buffer; \n'
		+ 'var MODELNAME = this.model; \n'
		+ 'var HELPERSNAME = this; \n';

	head = this.replaceDevTokens( head );
	return head + body;
}

VCP.addFoot = function(body){

	var options = this.options;

	var foot = ''
		+ (options.simple
			? 'return HELPERSNAME.buffer.join(""); \n'
			: '(__vopts && __vopts.onRenderEnd && __vopts.onRenderEnd(null, HELPERSNAME)); \n'
				+ 'return (__vopts && __vopts.asContext) \n'
				+ '  ? HELPERSNAME \n'
				+ '  : HELPERSNAME.toString(); \n' )
		+ (options.useWith ? '} \n' : '')
		+ (options.debug ? '} catch( e ){ \n'
			+ '  HELPERSNAME.reportError( e, HELPERSNAME.vl, HELPERSNAME.vc, "ORIGINALMARKUP" ); \n'
			+ '} \n' : '');

	foot = this.replaceDevTokens( foot )
		.replace( this.reOriginalMarkup, this.escapeForDebug( this.originalMarkup ) );

	return body + foot;
}

VCP.addHelperFoot = function(body){

	var options = this.options;

	var foot = ''
		+ (options.debug ? '} catch( e ){ \n'
			+ '  HELPERSNAME.reportError( e, HELPERSNAME.vl, HELPERSNAME.vc, "ORIGINALMARKUP" ); \n'
			+ '} \n' : '');

	foot = this.replaceDevTokens( foot )
		.replace( this.reOriginalMarkup, this.escapeForDebug( this.originalMarkup ) );

	return body + foot;
}

VCP.generate = function(){
	var options = this.options;

	// clear whatever's in the current buffer
	this.buffer.length = 0;

	this.visitNode(this.ast);

	// coalesce markup
	var joined = this.buffer
		.join("")
		.split(")MKPMKP(").join('')
		.split("MKP(").join( "__vbuffer.push('")
		.split(")MKP").join("'); \n");

	if(!options.asHelper){
		joined = this.addHead( joined );
		joined = this.addFoot( joined );
	} else {
		joined = this.addHelperHead( joined );
		joined = this.addHelperFoot( joined );
	}

	if(options.debugCompiler){
		console.log(joined);
		console.log(options);
	}

	this.cmpFunc = vash.link( joined, options );
	return this.cmpFunc;
}

VCompiler.noop = function(){}

VCompiler.findNonExp = function(node){

	if(node.vquery && node.mode === EXP){
		return node.filter(VCompiler.findNonExp).length > 0;
	}

	if(node.vquery && node.mode !== EXP){
		return true;
	} else {
		return false;
	}
}
