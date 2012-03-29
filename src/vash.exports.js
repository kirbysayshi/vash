/*jshint strict:true, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

/**
 * Vash - JavaScript Template Parser
 *
 * https://github.com/kirbysayshi/vash
 *
 * Copyright (c) 2012 Andrew Petersen
 * MIT License (LICENSE)
 */
(function(exports){

	
	exports["version"] = "0.4.1-?BUILDNUM?";

	exports["config"] = {
		 "useWith": false
		,"modelName": "model"
		,"debug": false
		,"debugParser": false
		,"debugCompiler": false
	};

	/************** Begin injected code from build script */
	?CODE?
	/************** End injected code from build script */

	exports["VLexer"] = VLexer;
	exports["VParser"] = VParser;
	exports["VCompiler"] = VCompiler;
	exports["compile"] = function compile(markup, options){

		var  p
			,c
			,cmp;

		options = options || {};
		options.useWith = options.useWith || exports.config.useWith;
		options.modelName = options.modelName || exports.config.modelName;
		options.debug = options.debug || exports.config.debug;
		options.debugParser = options.debugParser || exports.config.debugParser;
		options.debugCompiler = options.debugCompiler || exports.config.debugCompiler;

		p = new VParser(markup, options);
		p.parse();

		c = new VCompiler(p.buffers, p.lex.originalInput);
		c.generate(options);

		// Express support
		cmp = c.assemble(options);
		cmp.displayName = 'render';
		return cmp;
	};

})(typeof exports === 'undefined' ? (this['vash'] = this['vash'] || {}) : exports);
