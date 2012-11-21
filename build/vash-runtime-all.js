/**
 * Vash - JavaScript Template Parser, v0.6.0-1644
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

			this.vl = 0;
			this.vc = 0;
		};

		vash['helpers']
			= helpers
			= Helpers.prototype
			= { constructor: Helpers, config: {}};
	}

	// this allows a template to return the context, and coercion
	// will handle it
	helpers.toString = helpers.toHtmlString = function(){
		return this.buffer.toString();
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
			var mark = new Mark( this );
			mark.markedIndex = __vo.length;
			__vo.push( mark.uid );
			return mark;
		};

		this.fromMark = function( mark ) {
			var found = mark.findInBuffer();

			if( found > -1 ){
				// automatically destroy the mark from the buffer
				mark.destroy();
				// `found` will still be valid for a manual splice
				return __vo.splice( found, __vo.length );
			}

			// TODO: should not found behavior call this.empty(),
			// or return an empty array?
		};

		this.empty = function() {
			return __vo.splice( 0, __vo.length );
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

		this.indexOf = function( str ){

			for( var i = 0; i < __vo.length; i++ ){
				if( __vo[i] == str ){
						return i;
				}
			}

			return -1;
		}

		this.splice = function(){
			return __vo.splice.apply( __vo, arguments );
		}

		this.index = function( idx ){
			return __vo[ idx ];
		}

		this.flush = function() {
			return this.empty().join( "" );
		};

		this.toString = this.toHtmlString = function(){
			// not using flush because then console.log( tpl() ) would artificially
			// affect the output
			return __vo.join( "" );
		}
	};

	// BUFFER MANIPULATION
	///////////////////////////////////////////////////////////////////////////

	///////////////////////////////////////////////////////////////////////////
	// MARKS
	// These can be used to manipulate the existing entries in the rendering
	// context. For an example, see the highlight helper.

	var Mark = function( buffer ){
		this.uid = 'VASHMARK-' + ~~( Math.random() * 10000000 );
		this.markedIndex = 0;
		this.buffer = buffer;
		this.destroyed = false;
	}

	Mark.prototype.destroy = function(){

		var found = this.findInBuffer();

		if( found > -1 ){
			this.buffer.splice( found, 1 );
			this.markedIndex = -1;
			this.Helpers = null;
		}

		this.destroyed = true;
	}

	Mark.prototype.findInBuffer = function(){

		if( this.destroyed ){
			return -1;
		}

		if( this.markedIndex && this.buffer.index( this.markedIndex ) === this.uid ){
			return this.markedIndex;
		}

		return this.markedIndex = this.buffer.indexOf( this.uid );
	}

	// MARKS
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
				+ (curr < 10 ? ' ' : '')
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

/*jshint strict:false, asi:true, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */
;(function(){

	var helpers = vash.helpers;

	///////////////////////////////////////////////////////////////////////////
	// EXAMPLE HELPER: syntax highlighting

	helpers.config.highlighter = null;

	helpers.highlight = function(lang, cb){

		// context (this) is and instance of Helpers, aka a rendering context

		// mark() returns an internal `Mark` object
		// Use it to easily capture output...
		var startMark = this.buffer.mark();

		// cb() is simply a user-defined function. It could (and should) contain
		// buffer additions, so we call it...
		cb();

		// ... and then use fromMark() to grab the output added by cb().
		var cbOutLines = this.buffer.fromMark(startMark);

		// The internal buffer should now be back to where it was before this
		// helper started, and the output is completely contained within cbOutLines.

		this.buffer.push( '<pre><code>' );

		if( helpers.config.highlighter ){
			this.buffer.push( helpers.config.highlighter(lang, cbOutLines.join('')).value );
		} else {
			this.buffer.push( cbOutLines );
		}

		this.buffer.push( '</code></pre>' );

		// returning is allowed, but could cause surprising effects. A return
		// value will be directly added to the output directly following the above.
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

	helpers.extend = function(path, ctn){
		var  self = this
			,buffer = this.buffer
			,origModel = this.model;

		// this is a synchronous callback
		vash.loadFile(path, this.model, function(err, tpl){
			buffer.push(ctn(self.model)); // the child content
			buffer.push(tpl(self.model)); // the tpl being extended
		})

		this.model = origModel;
	}

	helpers.include = function(name, model){

		var  self = this
			,buffer = this.buffer
			,origModel = this.model;

		// this is a synchronous callback
		vash.loadFile(name, this.model, function(err, tpl){
			buffer.push( tpl(model || self.model));
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
