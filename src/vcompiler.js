/*jshint strict:false, asi:true, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

function VCompiler(ast, originalMarkup){
	this.ast = ast;
	this.originalMarkup = originalMarkup || '';
}

var VCP = VCompiler.prototype;

VCP.assemble = function(options, helpers){

	options = options || {};
	helpers = helpers || {};


	var buffer = []
		,escapeStack = []

		,reQuote = /(["'])/gi
		,reEscapedQuote = /\\+(["'])/gi
		,reLineBreak = /[\n\r]/gi
		,joined
		,compiledFunc
		,linkedFunc

		,markupBuffer = [];

	function insertDebugVars(tok){
		if(options.debug){
			buffer.push(
				 options.helpersName + '.__vl = __vl = ' + tok.line + ', '
				,options.helpersName + '.__vc = __vc = ' + tok.chr + '; \n'
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
			start = "__vo.push(" + start;
		}

		if( parentParentIsNotEXP && index === parentNode.length - 1 ){
			end += "); \n";
		}

		buffer.push( start + tok.val /*.replace(reQuote, '"').replace(reEscapedQuote, '\\$1')*/ + end );

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

	var pre = ''
		+ 'HELPERSNAME = HELPERSNAME || vash.helpers; \n'
		+ 'var __vo = HELPERSNAME.__vo = HELPERSNAME.__vo || []; \n'
		+ 'HELPERSNAME.model = MODELNAME; \n'

		// we mark the buffer to know the side effects of the currently running
		// template
		+ 'var __vomstart = HELPERSNAME.buffer.mark(); \n'

		// `__vanddie`, if true, tells the template that, when finished, it
		// should clear the buffer and mark execution as concluded. It is
		// necessary to know if `__vexecuting` was set before or during this
		// template.
		+ 'var __vanddie; \n'

		// `__vexecuting`, if set, means that another template is running / has
		// run before the currently executing template. If this is true, then
		// don't clear things out when this template finishes.
		+ 'if( HELPERSNAME.__vexecuting ){ \n'
		+ '  __vanddie = false; \n'
		+ '} else { \n'
		+ '  __vanddie = true; \n'
		+ '  HELPERSNAME.__vexecuting = true; \n'
		+ '} \n'

	if( options.debug ){
		pre += 'var __vl = HELPERSNAME.__vl = 0, __vc = HELPERSNAME.__vc = 0; \n'
	}

	pre += 'VASHTPLBODY';

	if( options.useWith ){
		pre = 'with( MODELNAME || {} ){ \n' + pre + '} \n'
	}

	if( options.debug ){
		pre = 'try { \n' + pre + '} catch( e ){ \n';
		pre += ''
			+ 'HELPERSNAME.reportError( e, __vl, __vc, '
			+ '"' + this.originalMarkup
				.replace(reLineBreak, '!LB!')
				.replace(reQuote, '\\$1')
				.replace(reEscapedQuote, '\\$1')
			+ '"'
			+ ' ); \n'
		pre += '} \n';
	}

	if( options.debug ){
		pre += ''
			+ 'delete HELPERSNAME.__vl; \n'
			+ 'delete HELPERSNAME.__vc; \n'
	}

	pre += ''
		+ 'var __vall = __vo.join(""); \n'

		// as said above, if `__vanddie` is true, then this is the "root" template
		// or the first to be run this event loop.
		+ 'if( __vanddie ){ \n'
		+ '  HELPERSNAME.buffer.empty(); \n'
		+ '  delete HELPERSNAME.__vexecuting; \n'
		+ '} \n'
		+ 'return __vall; \n'

	visitNode(this.ast);

	joined = pre
		// substitutions
		.replace( /VASHTPLBODY/g, buffer.join('') )
		.replace( /HELPERSNAME/g, options.helpersName )
		.replace( /MODELNAME/g, options.modelName )

		// coalesce markup
		.split("')MKPMKP('").join('')
		.split("MKP(").join("__vo.push(")
		.split(")MKP").join("); \n");

	if(options.debugCompiler){
		console.log(joined);
	}

	try {
		compiledFunc = new Function(options.modelName, options.helpersName, joined);
	} catch(e){
		vash.helpers.reportError(e, 0, 0, joined, /\n/)
	}

	// Link compiled function to helpers collection, but report original function
	// body for code generation purposes.
	linkedFunc = function(model) { return compiledFunc(model, helpers); };
	linkedFunc.toString = function() { return compiledFunc.toString(); };

	return linkedFunc;
}
