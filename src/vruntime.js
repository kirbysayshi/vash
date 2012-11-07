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

	var helpers = (vash['helpers'] = vash['helpers'] || {});

	vash.helpers.config = {};

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
		var func = function() { return val; }

		val = val != null ? val : "";

		return {
			 toHtmlString: func
			,toString: func
		};
	}

	helpers.escape = function( val ) {
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

	helpers.buffer = (function(){

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
				if( buffer instanceof Array ) {
					helpers.__vo.push.apply( helpers.__vo, buffer );
				} else if (arguments.length > 1){
					helpers.__vo.push.apply( helpers.__vo, Array.prototype.slice.call(arguments) );
				} else {
					helpers.__vo.push(buffer);
				}
			}

		}
	}());

	// BUFFER MANIPULATION
	///////////////////////////////////////////////////////////////////////////

	///////////////////////////////////////////////////////////////////////////
	// ERROR REPORTING

	// Liberally modified from https://github.com/visionmedia/jade/blob/master/jade.js
	helpers.reportError = function(e, lineno, chr, orig, lb){

		lb = lb || '!LB!';

		var lines = orig.split(lb)
			,contextSize = lineno == 0 && chr == 0 ? lines.length - 1 : 3
			,start = Math.max(0, lineno - contextSize)
			,end = Math.min(lines.length, lineno + contextSize);

		var contextStr = lines.slice(start, end).map(function(line, i, all){
			var curr = i + start + 1;

			return (curr === lineno ? '  > ' : '    ')
				+ (curr < 10 ? curr + ' ' : curr)
				+ ' | '
				+ line;
		}).join('\n');

		e.message = 'Problem while rendering template at line '
			+ lineno + ', character ' + chr
			+ '.\nOriginal message: ' + e.message + '.'
			+ '\nContext: \n\n' + contextStr + '\n\n';

		throw e;
	}
}());
