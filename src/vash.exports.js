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

	"use strict";
	exports["version"] = "0.3.1-?BUILDNUM?";

	exports["config"] = {
		 "useWith": false
		,"modelName": "model"
	};

	/************** Begin injected code from build script */
	?CODE?
	/************** End injected code from build script */

	exports["VLexer"] = VLexer;
	exports["VParser"] = VParser;
	exports["compile"] = function tpl(markup, options){

		var  p = new VParser(markup)
			,cmp;

		options = options || {};
		options.useWith = typeof options.useWith === 'undefined' 
			? exports.config.useWith 
			: options.useWith;
		options.modelName = options.modelName || exports.config.modelName;

		p.parse();
		cmp = p.compile(options)

		// Express support
		return function render(locals){
			return cmp(locals);
		}
	};

})(typeof exports === 'undefined' ? this['vash'] = {} : exports);
