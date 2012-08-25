/**
 * Vash - JavaScript Template Parser, v0.4.5-996
 *
 * https://github.com/kirbysayshi/vash
 *
 * Copyright (c) 2012 Andrew Petersen
 * MIT License (LICENSE)
 */
 ;(function(helpers){

	// this pattern was inspired by LucidJS,
	// https://github.com/RobertWHurst/LucidJS/blob/master/lucid.js

	if(typeof define === 'function' && define['amd']){
		define(helpers); // AMD
	} else if(typeof module === 'object' && module['exports']){
		// NODEJS
		exports['helpers'] = helpers;
	} else {
		window['vash'] = window['vash'] || {}; // BROWSER
		window['vash']['helpers'] = helpers
	}

})(function(exports){

	///////////////////////////////////////////////////////////////////////////
	// CONFIG
	// Ideally this is where any helper-specific configuration would go, things
	// such as syntax highlighting callbacks, whether to temporarily disable
	// html escaping, and others.
	// 
	// Each helper should define it's configuration options just above its own
	// definition, for ease of modularity and discoverability.

	exports.config = {};

	// CONFIG
	///////////////////////////////////////////////////////////////////////////


	///////////////////////////////////////////////////////////////////////////
	// HTML ESCAPING

	var HTML_REGEX = /[&<>"'`]/g
		,HTML_REPLACER = function(match) { return HTML_CHARS[match]; }
		,HTML_CHARS = {
			"&": "&amp;"
			,"<": "&lt;"
			,">": "&gt;"
			,'"': "&quot;"
			,"'": "&#x27;"
			,"`": "&#x60;"
		};


	// raw: explicitly prevent an expression or value from being HTML escaped.

	exports.raw = function( val ) {
		var func = function() { return val; }
		
		val = val != null ? val : "";		
		
		return {
			 toHtmlString: func
			,toString: func
		};
	}
		
	exports.escape = function( val ) {
		var	func = function() { return val; }

		val = val != null ? val : "";
		
		if ( typeof val.toHtmlString !== "function" ) {
			
			val = val.toString().replace( HTML_REGEX, HTML_REPLACER );

			return {
				 toHtmlString: func
				,toString: func
			};
		}
		
		return val;
	}

	// HTML ESCAPING
	///////////////////////////////////////////////////////////////////////////

	///////////////////////////////////////////////////////////////////////////
	// BUFFER MANIPULATION
	//
	// These are to be used from within helpers, to allow for manipulation of
	// output in a sane manner. 

	exports.buffer = (function(){ 
		var helpers = exports;
		
		return {

			mark: function(){
				return helpers.__vo.length;
			}

			,empty: function(){
				return helpers.__vo.splice(0, helpers.__vo.length);
			}

			,fromMark: function(mark){
				return helpers.__vo.splice(mark, helpers.__vo.length);
			}

			,push: function(buffer){
				if( buffer instanceof Array )
					helpers.__vo.push.apply( helpers.__vo, buffer );
				else if (arguments.length > 1){
					helpers.__vo.push.apply( helpers.__vo, Array.prototype.slice.call(arguments) );
				} else
					helpers.__vo.push(buffer);
			}

		} 
	}());

	// BUFFER MANIPULATION
	///////////////////////////////////////////////////////////////////////////

	return exports;

}({}));
;(function(exports){

	///////////////////////////////////////////////////////////////////////////
	// EXAMPLE HELPER: syntax highlighting

	exports.config.highlighter = null

	exports.highlight = function(lang, cb){

		// context (this) is vash.helpers

		// mark() returns, for now, the current length of the internal buffer.
		// Use it to easily capture output...
		var startMark = this.buffer.mark();

		// cb() is simply a user-defined function. It could (and should) contain
		// buffer additions, so we call it...
		cb();

		// ... and then use fromMark() to grab the output added by cb().
		// Allowing the user to have functions mitigates having to do a lot of 
		// manual string concatenation within a helper.
		var cbOutLines = this.buffer.fromMark(startMark);

		// The internal buffer should now be back to where it was before this 
		// helper started.

		this.buffer.push( '<pre><code>' );

		// 
		if( exports.config.highlighter ){
			this.buffer.push( exports.config.highlighter(lang, cbOutLines.join('')).value );
		}

		this.buffer.push( '</code></pre>' );

		// returning is allowed, but could cause surprising effects. A return
		// value will be directly added to the output.
	}

}(function(){

	if(typeof define === 'function' && define['amd']){
		return {}; // AMD
	} else if(typeof module === 'object' && module['exports']){
		// NODEJS, one file
		return exports['helpers'];
	} else {
		return window['vash']['helpers'];
	}

}()));