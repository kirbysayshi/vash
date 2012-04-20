/*jshint strict:true, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

/**
 * Vash - JavaScript Template Parser
 *
 * https://github.com/kirbysayshi/vash
 *
 * Copyright (c) 2012 Andrew Petersen
 * MIT License (LICENSE)
 */
;(function(vash){

	// this pattern was inspired by LucidJS,
	// https://github.com/RobertWHurst/LucidJS/blob/master/lucid.js

	typeof define === 'function' && define['amd']
		? define(vash) // AMD
		: typeof module === 'object' && module['exports']
			? module['exports'] = vash // NODEJS
			: window['vash'] = vash // BROWSER

})(function(exports){

	var vash = exports; // neccessary for nodejs references

	exports["version"] = "0.4.3-?BUILDNUM?";

	exports["config"] = {
		 "useWith": false
		,"modelName": "model"
		,"debug": false
		,"debugParser": false
		,"debugCompiler": false
	};

	/************** Begin injected code from build script */
	/*?CODE?*/
	/************** End injected code from build script */

	/*exports['isArray'] = function(obj){
		return Object.prototype.toString.call(obj) == '[object Array]'
	}

	exports['copyObj'] = function(obj){
		var nObj = {};

		for(var i in obj){
			if(Object.prototype.hasOwnProperty(i)){
				nObj[i] = obj[i]
			}
		}

		return nObj;
	}*/

	exports["VLexer"] = VLexer;
	exports["VParser"] = VParser;
	exports["VCompiler"] = VCompiler;
	exports["compile"] = function compile(markup, options){

		if(markup === '' || typeof markup !== 'string') throw new Error('Empty or non-string cannot be compiled');

		var  l
			,tok
			,tokens = []
			,p
			,c
			,cmp;

		options = options || {};
		options.useWith = options.useWith || exports.config.useWith;
		options.modelName = options.modelName || exports.config.modelName;
		options.debug = options.debug || exports.config.debug;
		options.debugParser = options.debugParser || exports.config.debugParser;
		options.debugCompiler = options.debugCompiler || exports.config.debugCompiler;

		l = new VLexer(markup);
		while(tok = l.advance()) tokens.push(tok)
		tokens.reverse(); // parser needs in reverse order for faster popping vs shift

		p = new VParser(tokens, options);
		p.parse();

		c = new VCompiler(p.ast, markup);
		//c.generate(options);

		// Express support
		cmp = c.assemble(options);
		cmp.displayName = 'render';
		return cmp;
	};

	return exports;
}({}));
