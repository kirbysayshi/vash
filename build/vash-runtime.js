/**
 * Vash - JavaScript Template Parser, v0.5.7-1572
 *
 * https://github.com/kirbysayshi/vash
 *
 * Copyright (c) 2012 Andrew Petersen
 * MIT License (LICENSE)
 */
 
/*jshint strict:false, asi: false, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */
;(function(){

	///////////////////////////////////////////////////////////////////////////
	// CONFIG
	// Ideally this is where any helper-specific configuration would go, things
	// such as syntax highlighting callbacks, whether to temporarily disable
	// html escaping, and others.
	// 
	// Each helper should define it's configuration options just above its own
	// definition, for ease of modularity and discoverability.

	// grab/create the global. sigh.
	vash = typeof vash === 'undefined'
		? typeof window !== 'undefined'
			? ( window.vash = window.vash || {} )
			: typeof module !== 'undefined' && module.exports
				? exports = {}
				: {}
		: vash;
		
	var helpers = vash['helpers']
		,Helpers
		,Buffer;
	
	if ( !helpers ) {
		Helpers = function ( model ) {			
			this.buffer = new Buffer();
			this.model  = model;			
		};
		
		vash['helpers']
			= helpers
			= Helpers.prototype
			= { constructor: Helpers, config: {}};
	}

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

	helpers.raw = function( val ) {
		var func = function() { return val; };
		
		val = val != null ? val : "";		
		
		return {
			 toHtmlString: func
			,toString: func
		};
	};
		
	helpers.escape = function( val ) {
		var	func = function() { return val; };

		val = val != null ? val : "";
		
		if ( typeof val.toHtmlString !== "function" ) {
			
			val = val.toString().replace( HTML_REGEX, HTML_REPLACER );

			return {
				 toHtmlString: func
				,toString: func
			};
		}
		
		return val;
	};

	// HTML ESCAPING
	///////////////////////////////////////////////////////////////////////////

	///////////////////////////////////////////////////////////////////////////
	// BUFFER MANIPULATION
	//
	// These are to be used from within helpers, to allow for manipulation of
	// output in a sane manner. 

	Buffer = function() {
		var __vo = [];
		
		this.mark = function() {
			return __vo.length;
		};

		this.empty = function() {
			return __vo.splice( 0, __vo.length );
		};

		this.fromMark = function( mark ) {
			return __vo.splice( mark, __vo.length );
		};

		this.push = function( buffer ) {
			if( buffer instanceof Array ) {
				__vo.push.apply( __vo, buffer );
			} else if ( arguments.length > 1 ) {
				__vo.push.apply( __vo, Array.prototype.slice.call( arguments ));
			} else {
				__vo.push( buffer );
			}
		};
		
		this.flush = function() {			
			return this.empty().join( "" );
		};
	};


	// BUFFER MANIPULATION
	///////////////////////////////////////////////////////////////////////////

	///////////////////////////////////////////////////////////////////////////
	// ERROR REPORTING 

	// Liberally modified from https://github.com/visionmedia/jade/blob/master/jade.js
	helpers.constructor.reportError = function(e, lineno, chr, orig, lb){

		lb = lb || '!LB!';

		var lines = orig.split(lb)
			,contextSize = lineno === 0 && chr === 0 ? lines.length - 1 : 3
			,start = Math.max(0, lineno - contextSize)
			,end = Math.min(lines.length, lineno + contextSize);

		var contextStr = lines.slice(start, end).map(function(line, i, all){
			var curr = i + start + 1;

			return (curr === lineno ? '  > ' : '    ')
				+ curr
				+ ' | '
				+ line;
		}).join('\n');

		e.message = 'Problem while rendering template at line '
			+ lineno + ', character ' + chr
			+ '.\nOriginal message: ' + e.message + '.'
			+ '\nContext: \n\n' + contextStr + '\n\n';

		throw e;
	};
	
	helpers.reportError = function() {
		this.constructor.reportError.apply( this, arguments );
	};
}());
