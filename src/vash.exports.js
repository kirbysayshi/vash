/*jshint strict:false, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

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

	if(typeof define === 'function' && define['amd']){
		define(vash); // AMD
	} else if(typeof module === 'object' && module['exports']){
		module['exports'] = vash; // NODEJS
	} else {
		window['vash'] = vash; // BROWSER
	}

})(function(exports){

	var vash = exports; // neccessary for nodejs references

	exports["version"] = "0.4.4-?BUILDNUM?";
  exports["helpers"] = {};
	exports["config"] = {
		"useWith": false
		,"modelName": "model"
		,"helpersName": "html"
		,"htmlEscape": true
		,"debug": false
		,"debugParser": false
		,"debugCompiler": false
	};

	/************** Begin injected code from build script */
	/*?CODE?*/
	/************** End injected code from build script */	
	
	exports["helpers"].raw = function( val ) {
		var func = function() { return val != null ? val : "" };
		return {
			toHtmlString: func,
			toString: func,
			valueOf: func 
		};
	}
	
	exports["helpers"].escape = function( val ) {
		var
			lt = "&lt;",
			gt = "&gt;",
			amp = "&amp;",
			quot = "&quot;",
			ltre = /</g,
			gtre = />/g,
			ampre = /&(?!\\w+;)/g,
			quotre = /\"/g;

		val = ( val != null ? val : "" );
		
		if ( typeof val.toHtmlString === "function" ) {
			val = val.toHtmlString();
		} else {
		
			val = val.toString()
				.replace(ampre, amp)
				.replace(ltre, lt)
				.replace(gtre, gt)
				.replace(quotre, quot);
		}
		
		return exports["helpers"].raw( val );
	}
	
	exports["VLexer"] = VLexer;
	exports["VParser"] = VParser;
	exports["VCompiler"] = VCompiler;
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

		c = new VCompiler(p.ast, markup);

		cmp = c.assemble(options, exports.helpers);
		cmp.displayName = 'render';
		return cmp;
	};

	return exports;
}({}));
