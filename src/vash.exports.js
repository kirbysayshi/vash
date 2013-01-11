/*jshint strict:false, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

;(function(vash){

	// this pattern was inspired by LucidJS,
	// https://github.com/RobertWHurst/LucidJS/blob/master/lucid.js

	if(typeof define === 'function' && define['amd']){
		define(function(){ return vash }); // AMD
	} else if(typeof module === 'object' && module['exports']){
		module['exports'] = vash; // NODEJS
	} else {
		window['vash'] = vash; // BROWSER
	}

})(function(exports){

	var vash = exports; // neccessary for nodejs references

	exports["version"] = "?BUILDNUM?";
	exports["config"] = {
		 "useWith": false
		,"modelName": "model"
		,"helpersName": "html"
		,"htmlEscape": true
		,"debug": true
		,"debugParser": false
		,"debugCompiler": false
		,"simple": false

		,"favorText": false

		,"saveTextTag": false
		,"saveAT": false
	};

	exports["compile"] = function compile(markup, options){

		if(markup === '' || typeof markup !== 'string') {
			throw new Error('Empty or non-string cannot be compiled');
		}

		var  l
			,tok
			,tokens = []
			,p
			,c
			,cmp
			,i;

		options = vQuery.extend( {}, exports.config, options || {} );

		l = new VLexer(markup);
		while(tok = l.advance()) { tokens.push(tok); }
		tokens.reverse(); // parser needs in reverse order for faster popping vs shift

		p = new VParser(tokens, options);
		p.parse();

		c = new VCompiler(p.ast, markup, options);

		cmp = c.generate();
		return cmp;
	};

	exports['batch'] = function batch(path, cb){

		var caller = batch.caller;

		function _batch(path, cb){

			var  reFuncHead = /^function[^(]*?\([^)]*?\)\s*{/
				,reFuncTail = /\}$/

				,str = cb.toString()
					.replace(reFuncHead, '')
					.replace(reFuncTail, '')

				,callOpts = caller.options

			var cmp = new VCompiler([], '', callOpts);

			str = cmp.addHead( str );
			str = cmp.addFoot( str );
			vash.install( path, vash.link( undefined, str, callOpts ) );
		}

		if( vash.compile ) {
			exports['batch'] = _batch;
			return exports['batch'](path, cb);
		} else {
			throw new Error('vash.batch is not available in the standalone runtime.');
		}
	};

	/************** Begin injected code from build script */
	/*?CODE?*/
	/************** End injected code from build script */

	exports["VLexer"] = VLexer;
	exports["VParser"] = VParser;
	exports["VCompiler"] = VCompiler;
	exports["vQuery"] = vQuery;

	return exports;
}({}));
