/**
 * Vash - JavaScript Template Parser, v0.5.5-1538
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

/*jshint strict:false, asi:true, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */
;(function(){

	var helpers = vash.helpers;

	///////////////////////////////////////////////////////////////////////////
	// EXAMPLE HELPER: syntax highlighting

	helpers.config.highlighter = null;

	helpers.highlight = function(lang, cb){

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
		if( helpers.config.highlighter ){
			this.buffer.push( helpers.config.highlighter(lang, cbOutLines.join('')).value );
		} else {
			this.buffer.push(cbOutLines);
		}

		this.buffer.push( '</code></pre>' );

		// returning is allowed, but could cause surprising effects. A return
		// value will be directly added to the output.
	}

}());

;(function(){


	///////////////////////////////////////////////////////////////////////////
	// LAYOUT HELPERS

	// semi hacky guard to prevent non-nodejs erroring
	if( typeof window === 'undefined' ){
		var  fs = require('fs')
			,path = require('path')
	}

	var helpers = vash.helpers;

	// TRUE implies that all TPLS are loaded and waiting in cache
	helpers.config.browser = false;

	helpers.tplcache = {};
	helpers.blocks = {};
	helpers.appends = [];
	helpers.prepends = [];

	vash.loadFile = function(filepath, options, cb){

		// options are passed in via Express
		// {
		//   settings:
		//   {
		//      env: 'development',
		//   	'jsonp callback name': 'callback',
		//   	'json spaces': 2,
		//   	views: '/Users/drew/Dropbox/js/vash/test/fixtures/views',
		//   	'view engine': 'vash'
		//   },
		//   _locals: [Function: locals],
		//   cache: false
		// }

		// extend works from right to left, using first arg as target
		options = vQuery.extend( {}, vash.config, options || {} );

		var browser = helpers.config.browser
			,tpl

		if( !browser && options.settings && options.settings.views && options.settings['view engine'] ){
			filepath = filepath.indexOf(options.settings.views) > -1
				? filepath
				: path.join( options.settings.views
					,filepath
					+ ( path.extname(filepath)
						? ''
						: '.' + options.settings['view engine'] ) );
		}

		// if browser, tpl must exist in tpl cache
		tpl = options.cache || browser
			? helpers.tplcache[filepath] || ( helpers.tplcache[filepath] = vash.compile(fs.readFileSync(filepath, 'utf8')) )
			: vash.compile( fs.readFileSync(filepath, 'utf8') )

		cb && cb(null, tpl);
	}

	vash.renderFile = function(filepath, options, cb){

		vash.loadFile(filepath, options, function(err, tpl){
			cb(err, tpl(options));
		})
	}

	helpers.extends = function(path, ctn){
		var  self = this
			,origModel = this.model;

		// this is a synchronous callback
		vash.loadFile(path, this.model, function(err, tpl){
			ctn(self.model); // the child content
			tpl(self.model); // the tpl being extended
		})

		this.model = origModel;
	}

	helpers.include = function(name, model){

		var  self = this
			,origModel = this.model;

		// this is a synchronous callback
		vash.loadFile(name, this.model, function(err, tpl){
			tpl(model || self.model);
		})

		this.model = origModel;
	}

	helpers.block = function(name, ctn){
		var bstart, ctnLines, self = this;

		// Because this is at RUNTIME, blocks are tricky. Blocks can "overwrite"
		// each other, but the "highest level" block must not have a callback.
		// This signifies that it should render out, instead of replacing.
		// In the future, this should be handled at compile time, which would
		// remove this restriction.

		if( !ctn ){

			if( this.hasPrepends(name) ){
				this.prepends[name].forEach(function(a){ a(self.model); });
				this.prepends[name].length = 0;
			}

			if( this.hasBlock(name) ){
				this.blocks[name](this.model);
				delete this.blocks[name];
			}

			if( this.hasAppends(name) ){
				this.appends[name].forEach(function(a){ a(self.model); });
				this.appends[name].length = 0;
			}
		}

		if( ctn && !this.blocks[name] ){
			this.blocks[name] = ctn;
		}
	}

	helpers.append = function(name, ctn){

		if( !this.appends[name] ){
			this.appends[name] = [];
		}

		this.appends[name].push(ctn);
	}

	helpers.prepend = function(name, ctn){

		if( !this.prepends[name] ){
			this.prepends[name] = [];
		}

		this.prepends[name].push(ctn);
	}

	helpers.hasBlock = function(name){
		return typeof this.blocks[name] !== "undefined";
	}

	helpers.hasPrepends = function(name){
		return this.prepends[name] && (this.prepends[name].length > 0);
	}

	helpers.hasAppends = function(name){
		return this.appends[name] && (this.appends[name].length > 0);
	}

}());
