/*jshint strict:false, asi:true, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

function VCompiler(ast, originalMarkup, Helpers, options){
	this.ast = ast;
	this.originalMarkup = originalMarkup || '';
	this.Helpers = Helpers || vash.helpers.constructor;
	this.options = options || {};

	this.reQuote = /(["'])/gi
	this.reEscapedQuote = /\\+(["'])/gi
	this.reLineBreak = /[\n\r]/gi
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
		"MKP('" + tok.val
			.replace(this.reQuote, '\\$1')
			.replace(this.reLineBreak, '\\n')
		+ "')MKP" );
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

VCP.generate = function(){

	// clear whatever's in the current buffer
	this.buffer.length = 0;

	var options = this.options;

	var head = ''
		+ (options.debug ? 'try { \n' : '')
		+ 'var __vbuffer = HELPERSNAME.buffer; \n'
		+ 'MODELNAME = MODELNAME || {}; \n'
		+ (options.useWith ? 'with( MODELNAME ){ \n' : '');

	var foot = ''
		+ 'return (__vopts && __vopts.context) \n'
		+ '  ? HELPERSNAME \n'
		+ '  : HELPERSNAME.toString(); \n'
		+ (options.debug ? '} catch( e ){ \n'
			+ '  HELPERSNAME.reportError( e, HELPERSNAME.vl, HELPERSNAME.vc, "ORIGINALMARKUP" ); \n'
			+ '} \n' : '')
		+ (options.useWith ? '} \n' : '');

	head = this.replaceDevTokens( head );
	foot = this.replaceDevTokens( foot )
		.replace( this.reOriginalMarkup, this.escapeForDebug( this.originalMarkup ) );

	this.visitNode(this.ast);

	// coalesce markup
	var joined = this.buffer
		.join("")
		.split("')MKPMKP('").join('')
		.split("MKP(").join( "__vbuffer.push(")
		.split(")MKP").join("); \n");

	joined = head + joined + foot;

	if(options.debugCompiler){
		console.log(joined);
	}

	try {
		this.cmpFunc = new Function(options.modelName, options.helpersName, '__vopts', joined);
	} catch(e){
		this.Helpers.reportError(e, 0, 0, joined, /\n/)
	}

	return this.compiledFunc;
}

VCP.assemble = function( cmpFunc ){
	return VCompiler.assemble( cmpFunc || this.cmpFunc, this.Helpers );
}

VCompiler.assemble = function( cmpFunc, Helpers ){
	Helpers = Helpers || vash.helpers.constructor;

	var linked = function( model, opts ){
		return cmpFunc( model, new Helpers( model ), opts );
	}

	linked.toString = function(){
		return cmpFunc.toString();
	}

	linked.toClientString = function(){
		return 'vash.link( ' + cmpFunc.toString() + ' )';
	}

	return linked;
}

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
