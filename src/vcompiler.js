/*jshint strict:false, asi:true, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

function VCompiler(ast, originalMarkup){
	this.ast = ast;
	this.originalMarkup = originalMarkup || '';
}

var VCP = VCompiler.prototype;

VCP.assemble = function(options, Helpers){

	options = options || {};
	Helpers = Helpers || {};
	

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
			start = options.helpersName + ".buffer.push(" + start;
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

	// suprisingly: http://jsperf.com/array-index-vs-push		

	if(options.debug){
		buffer.push(
			 'var __vl = ' + options.helpersName + '.__vl = 0,'
			,'__vc = ' + options.helpersName + '.__vc = 0; \n'
		);
	}
	
	visitNode(this.ast);

	if(options.useWith === true){
		buffer.unshift( "with(" + options.modelName + " || {}){ \n" );
		buffer.push("}");
	}

	if(options.debug){
		buffer.unshift( 'try { \n' );
		buffer.push( '} catch( e ) { '
			,options.helpersName + '.reportError'
			,'(e, __vl, __vc, '
			,'"' + this.originalMarkup
				.replace(reLineBreak, '!LB!')
				.replace(reQuote, '\\$1')
				.replace(reEscapedQuote, '\\$1')
			+ '"'
			,') } \n' );
	}

	if(options.debug){
		buffer.push( 'delete ' + options.helpersName + '.__vl \n' );
		buffer.push( 'delete ' + options.helpersName + '.__vc \n' );
	}

	buffer.push( 'return ' + options.helpersName + '.buffer.flush(); \n');

	joined = buffer.join( '' );

	// coalesce markup
	joined = joined
		.split( "')MKPMKP('" ).join('')
		.split( "MKP(" ).join( options.helpersName + ".buffer.push(" )
		.split( ")MKP" ).join( "); \n" );

	if ( options.debugCompiler ) {
		console.log( joined );
	}
	
	try {
		compiledFunc = new Function( options.modelName, options.helpersName, joined );			
	} catch(e){
		Helpers.reportError( e, 0, 0, joined, /\n/ );
	}	

	// Link compiled function to helpers collection, but report original function
	// body for code generation purposes.
	linkedFunc = function(model) {
		return compiledFunc(model, new Helpers( model ));
	};
	linkedFunc.toString = function() { return compiledFunc.toString(); };
	
	return linkedFunc;
}
