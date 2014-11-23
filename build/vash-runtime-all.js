/**
 * Vash - JavaScript Template Parser, v0.7.12-1
 *
 * https://github.com/kirbysayshi/vash
 *
 * Copyright (c) 2013 Andrew Petersen
 * MIT License (LICENSE)
 */
void(0); // hack for https://github.com/mishoo/UglifyJS/issues/465
/*jshint strict:false, asi: false, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */
;(function(){

	vash = typeof vash === 'undefined' ? {} : vash;

	// only fully define if this is standalone
	if(!vash.compile){
		if(typeof define === 'function' && define['amd']){
			define(function(){ return vash }); // AMD
		} else if(typeof module === 'object' && module['exports']){
			module['exports'] = vash; // NODEJS
		} else {
			window['vash'] = vash; // BROWSER
		}
	}

	var helpers = vash['helpers'];

	var Helpers = function ( model ) {
		this.buffer = new Buffer();
		this.model  = model;
		this.options = null; // added at render time

		this.vl = 0;
		this.vc = 0;
	};

	vash['helpers']
		= helpers
		= Helpers.prototype
		= { constructor: Helpers, config: {}, tplcache: {} };

	// this allows a template to return the context, and coercion
	// will handle it
	helpers.toString = helpers.toHtmlString = function(){
		// not calling buffer.toString() results in 2x speedup
		return this.buffer._vo.join('');//.toString();
	}

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

	helpers['raw'] = function( val ) {
		var func = function() { return val; };

		val = val != null ? val : "";

		return {
			 toHtmlString: func
			,toString: func
		};
	};

	helpers['escape'] = function( val ) {
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

	var Buffer = function() {
		this._vo = [];
	}

	Buffer.prototype.mark = function( debugName ) {
		var mark = new Mark( this, debugName );
		mark.markedIndex = this._vo.length;
		this._vo.push( mark.uid );
		return mark;
	};

	Buffer.prototype.fromMark = function( mark ) {
		var found = mark.findInBuffer();

		if( found > -1 ){
			// automatically destroy the mark from the buffer
			mark.destroy();
			// `found` will still be valid for a manual splice
			return this._vo.splice( found, this._vo.length );
		}

		return [];
	};

	Buffer.prototype.spliceMark = function( mark, numToRemove, add ){
		var found = mark.findInBuffer();

		if( found > -1 ){
			mark.destroy();
			arguments[0] = found;
			return this._vo.splice.apply( this._vo, arguments );
		}

		return [];
	};

	Buffer.prototype.empty = function() {
		return this._vo.splice( 0, this._vo.length );
	};

	Buffer.prototype.push = function( buffer ) {
		return this._vo.push( buffer );
	};

	Buffer.prototype.pushConcat = function( buffer ){
		var buffers;
		if (Array.isArray(buffer)) {
			buffers = buffer;
		} else if ( arguments.length > 1 ) {
			buffers = Array.prototype.slice.call( arguments );
		} else {
			buffers = [buffer];
		}

		for (var i = 0; i < buffers.length; i++) {
			this._vo.push( buffers[i] );
		}

		return this.__vo;
	}

	Buffer.prototype.indexOf = function( str ){

		for( var i = 0; i < this._vo.length; i++ ){
			if(
				( str.test && this._vo[i] && this._vo[i].search(str) > -1 )
				|| this._vo[i] == str
			){
				return i;
			}
		}

		return -1;
	}

	Buffer.prototype.lastIndexOf = function( str ){
		var i = this._vo.length;

		while( --i >= 0 ){
			if(
				( str.test && this._vo[i] && this._vo[i].search(str) > -1 )
				|| this._vo[i] == str
			){
				return i;
			}
		}

		return -1;
	}

	Buffer.prototype.splice = function(){
		return this._vo.splice.apply( this._vo, arguments );
	}

	Buffer.prototype.index = function( idx ){
		return this._vo[ idx ];
	}

	Buffer.prototype.flush = function() {
		return this.empty().join( "" );
	};

	Buffer.prototype.toString = Buffer.prototype.toHtmlString = function(){
		// not using flush because then console.log( tpl() ) would artificially
		// affect the output
		return this._vo.join( "" );
	}

	// BUFFER MANIPULATION
	///////////////////////////////////////////////////////////////////////////

	///////////////////////////////////////////////////////////////////////////
	// MARKS
	// These can be used to manipulate the existing entries in the rendering
	// context. For an example, see the highlight helper.

	var Mark = vash['Mark'] = function( buffer, debugName ){
		this.uid = '[VASHMARK-'
			+ ~~( Math.random() * 10000000 )
			+ (debugName ? ':' + debugName : '')
			+ ']';
		this.markedIndex = 0;
		this.buffer = buffer;
		this.destroyed = false;
	}

	var reMark = Mark.re = /\[VASHMARK\-\d{1,8}(?::[\s\S]+?)?]/g

	// tests if a string has a mark-like uid within it
	Mark.uidLike = function( str ){
		return (str || '').search( reMark ) > -1;
	}

	Mark.prototype.destroy = function(){

		var found = this.findInBuffer();

		if( found > -1 ){
			this.buffer.splice( found, 1 );
			this.markedIndex = -1;
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

		// The mark may be within a string due to string shenanigans. If this is
		// true this is bad, because all the Mark manipulation commands assume
		// that the Mark is the only content at that index in the buffer, which
		// means that splice commands will result in lost content.
		var escaped = this.uid.replace(/(\[|\])/g, '\\$1');
		var re = new RegExp(escaped);
		return this.markedIndex = this.buffer.indexOf( re );
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

		e.vashlineno = lineno;
		e.vashcharno = chr;
		e.message = 'Problem while rendering template at line '
			+ lineno + ', character ' + chr
			+ '.\nOriginal message: ' + e.message + '.'
			+ '\nContext: \n\n' + contextStr + '\n\n';

		throw e;
	};

	helpers['reportError'] = function() {
		this.constructor.reportError.apply( this, arguments );
	};

	// ERROR REPORTING
	///////////////////////////////////////////////////////////////////////////

	///////////////////////////////////////////////////////////////////////////
	// VASH.LINK
	// Take a compiled string or function and "link" it to the current vash
	// runtime. This is necessary to allow instantiation of `Helpers` and
	// proper decompilation via `toClientString`.
	//
	// If `options.asHelper` and `options.args` are defined, the `cmpFunc` is
	// interpreted as a compiled helper, and is attached to `vash.helpers` at
	// a property name equal to `options.asHelper`.

	vash['link'] = function( cmpFunc, options ){

		// TODO: allow options.filename to be used as sourceUrl?

		var  originalFunc
			,cmpOpts;

		if( !options.args ){
			// every template has these arguments
			options.args = [options.modelName, options.helpersName, '__vopts', 'vash'];
		}

		if( typeof cmpFunc === 'string' ){
			originalFunc = cmpFunc;

			try {
				// do not pollute the args array for later attachment to the compiled
				// function for later decompilation/linking
				cmpOpts = options.args.slice();
				cmpOpts.push(cmpFunc);
				cmpFunc = Function.apply(null, cmpOpts);
			} catch(e) {
				// TODO: add flag to reportError to know if it's at compile time or runtime
				helpers.reportError(e, 0, 0, originalFunc, /\n/);
			}
		}

		// need this to enable decompilation / relinking
		cmpFunc.options = {
			 simple: options.simple
			,modelName: options.modelName
			,helpersName: options.helpersName
		}

		var linked;

		if( options.asHelper ){

			cmpFunc.options.args = options.args;
			cmpFunc.options.asHelper = options.asHelper;

			linked = function(){
				return cmpFunc.apply(this, slice.call(arguments));
			}

			helpers[options.asHelper] = linked;

		} else {

			linked = function( model, opts ){
				if( options.simple ){
					var ctx = {
						 buffer: []
						,escape: Helpers.prototype.escape
						,raw: Helpers.prototype.raw
					}
					return cmpFunc( model, ctx, opts, vash );
				}

				opts = divineRuntimeTplOptions( model, opts );
				return cmpFunc( model, (opts && opts.context) || new Helpers( model ), opts, vash );
			}
		}

		// show the template-specific code, instead of the generic linked function
		linked['toString'] = function(){ return cmpFunc.toString(); }

		// shortcut to show the actual linked function
		linked['_toString'] = function(){ return Function.prototype.toString.call(linked) }

		linked['toClientString'] = function(){
			return 'vash.link( '
				+ cmpFunc.toString() + ', '
				+ JSON.stringify( cmpFunc.options ) + ' )';
		}

		return linked;
	}

	// given a model and options, allow for various tpl signatures and options:
	// ( model, {} )
	// ( model, function onRenderEnd(){} )
	// ( model )
	// and model.onRenderEnd
	function divineRuntimeTplOptions( model, opts ){

		// allow for signature: model, callback
		if( typeof opts === 'function' ) {
			opts = { onRenderEnd: opts };
		}

		// allow for passing in onRenderEnd via model
		if( model && model.onRenderEnd ){
			opts = opts || {};

			if( !opts.onRenderEnd ){
				opts.onRenderEnd = model.onRenderEnd;
			}

			delete model.onRenderEnd;
		}

		// ensure options can be referenced
		if( !opts ){
			opts = {};
		}

		return opts;
	}

	// shortcut for compiled helpers
	var slice = Array.prototype.slice;

	// VASH.LINK
	///////////////////////////////////////////////////////////////////////////

	///////////////////////////////////////////////////////////////////////////
	// TPL CACHE

	vash['lookup'] = function( path, model ){
		var tpl = vash.helpers.tplcache[path];
		if( !tpl ){ throw new Error('Could not find template: ' + path); }
		if( model ){ return tpl(model); }
		else return tpl;
	};

	vash['install'] = function( path, tpl ){
		var cache = vash.helpers.tplcache;
		if( typeof tpl === 'string' ){
			if( !vash.compile ){ throw new Error('vash.install(path, [string]) is not available in the standalone runtime.') }
			tpl = vash.compile(tpl);
		} else if( typeof path === 'object' ){
			tpl = path;
			Object.keys(tpl).forEach(function(path){
				cache[path] = tpl[path];
			});
			return cache;
		}
		return cache[path] = tpl;
	};

	vash['uninstall'] = function( path ){
		var  cache = vash.helpers.tplcache
			,deleted = false;

		if( typeof path === 'string' ){
			return delete cache[path];
		} else {
			Object.keys(cache).forEach(function(key){
				if( cache[key] === path ){ deleted = delete cache[key]; }
			})
			return deleted;
		}
	};

}());
/*jshint strict:false, asi:true, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */
;(function(){

	var helpers = vash.helpers;

	// Trim whitespace from the start and end of a string
	helpers.trim = function(val){
		return val.replace(/^\s*|\s*$/g, '');
	}

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

		// The only required options are:
		//
		// settings: {
		//     views: ''
		// }

		// extend works from right to left, using first arg as target
		options = vQuery.extend( {}, vash.config, options || {} );

		var browser = helpers.config.browser
			,tpl

		if( !browser && options.settings && options.settings.views ){
			// this will really only have an effect on windows
			filepath = path.normalize( filepath );

			if( filepath.indexOf( path.normalize( options.settings.views ) ) === -1 ){
				// not an absolute path
				filepath = path.join( options.settings.views, filepath );
			}

			if( !path.extname( filepath ) ){
				filepath += '.' + ( options.settings['view engine'] || 'vash' )
			}
		}

		// TODO: auto insert 'model' into arguments
		try {
			// if browser, tpl must exist in tpl cache
			tpl = options.cache || browser
				? helpers.tplcache[filepath] || ( helpers.tplcache[filepath] = vash.compile(fs.readFileSync(filepath, 'utf8')) )
				: vash.compile( fs.readFileSync(filepath, 'utf8') )

			cb && cb(null, tpl);
		} catch(e) {
			cb && cb(e, null);
		}
	}

	vash.renderFile = function(filepath, options, cb){

		vash.loadFile(filepath, options, function(err, tpl){
			// auto setup an `onRenderEnd` callback to seal the layout
			var prevORE = options.onRenderEnd;

			cb( err, !err && tpl(options, function(err, ctx){
				ctx.finishLayout()
				if( prevORE ) prevORE(err, ctx);
			}) );
		})
	}

	helpers._ensureLayoutProps = function(){
		this.appends = this.appends || {};
		this.prepends = this.prepends || {};
		this.blocks = this.blocks || {};

		this.blockMarks = this.blockMarks || {};
	}

	helpers.finishLayout = function(){
		this._ensureLayoutProps();

		var self = this, name, marks, blocks, prepends, appends, injectMark, m, content

		// each time `.block` is called, a mark is added to the buffer and
		// the `blockMarks` stack. Find the newest/"highest" mark on the stack
		// for each named block, and insert the rendered content (prepends, block, appends)
		// in place of that mark

		for( name in this.blockMarks ){

			marks = this.blockMarks[name];

			prepends = this.prepends[name];
			blocks = this.blocks[name];
			appends = this.appends[name];

			injectMark = marks.pop();

			// mark current point in buffer in prep to grab rendered content
			m = this.buffer.mark();

			prepends && prepends.forEach(function(p){ self.buffer.pushConcat( p ); });

			// a block might never have a callback defined, e.g. is optional
			// with no default content
			block = blocks.pop();
			block && this.buffer.pushConcat( block );

			appends && appends.forEach(function(a){ self.buffer.pushConcat( a ); });

			// grab rendered content
			content = this.buffer.fromMark( m )

			// Join, but split out the VASHMARKS so further buffer operations are still
			// sane. Join is required to prevent max argument errors when large templates
			// are being used.
			content = compactContent(content);

			// Prep for apply, ensure the right location (mark) is used for injection.
			content.unshift( injectMark, 0 );
			this.buffer.spliceMark.apply( this.buffer, content );
		}

		for( name in this.blockMarks ){

			// kill all other marks registered as blocks
			this.blockMarks[name].forEach(function(m){ m.destroy(); });
		}

		// this should only be able to happen once
		delete this.blockMarks;
		delete this.prepends;
		delete this.blocks;
		delete this.appends;

		// and return the whole thing
		return this.toString();
	}

	// Given an array, condense all the strings to as few array elements
	// as possible, while preserving `Mark`s as individual elements.
	function compactContent(content) {
		var re = vash.Mark.re;
		var parts = [];
		var str = '';

		content.forEach(function(part) {
			if (re.exec(part)) {
				parts.push(str, part);
				str = '';
			} else {
				// Ensure `undefined`s are not `toString`ed
				str += (part || '');
			}
		});

		// And don't forget the rest.
		parts.push(str);

		return parts;
	}

	helpers.extend = function(path, ctn){
		var  self = this
			,buffer = this.buffer
			,origModel = this.model
			,layoutCtx;

		this._ensureLayoutProps();

		// this is a synchronous callback
		vash.loadFile(path, this.model, function(err, tpl){

			// any content that is outside of a block but within an "extend"
			// callback is completely thrown away, as the destination for such
			// content is undefined
			var start = self.buffer.mark();

			ctn(self.model);

			// ... and just throw it away
			var  content = self.buffer.fromMark( start )
				// TODO: unless it's a mark id? Removing everything means a block
				// MUST NOT be defined in an extend callback
				//,filtered = content.filter( vash.Mark.uidLike )

			//self.buffer.push( filtered );

			// `isExtending` is necessary because named blocks in the layout
			// will be interpreted after named blocks in the content. Since
			// layout named blocks should only be used as placeholders in the
			// event that their content is redefined, `block` must know to add
			// the defined content at the head or tail or the block stack.
			self.isExtending = true;
			tpl( self.model, { context: self } );
			self.isExtending = false;
		});

		this.model = origModel;
	}

	helpers.include = function(name, model){

		var  self = this
			,buffer = this.buffer
			,origModel = this.model;

		// TODO: should this be in a new context? Jade looks like an include
		// is not shared with parent context

		// this is a synchronous callback
		vash.loadFile(name, this.model, function(err, tpl){
			tpl( model || self.model, { context: self } );
		});

		this.model = origModel;
	}

	helpers.block = function(name, ctn){
		this._ensureLayoutProps();

		var  self = this
			// ensure that we have a list of marks for this name
			,marks = this.blockMarks[name] || ( this.blockMarks[name] = [] )
			// ensure a list of blocks for this name
			,blocks = this.blocks[name] || ( this.blocks[name] = [] )
			,start
			,content;

		// render out the content immediately, if defined, to attempt to grab
		// "dependencies" like other includes, blocks, etc
		if( ctn ){
			start = this.buffer.mark();
			ctn( this.model );
			content = this.buffer.fromMark( start );

			// add rendered content to named list of blocks
			if( content.length && !this.isExtending ){
				blocks.push( content );
			}

			// if extending the rendered content must be allowed to be redefined
			if( content.length && this.isExtending ){
				blocks.unshift( content );
			}
		}

		// mark the current location as "where this block will end up"
		marks.push( this.buffer.mark( 'block-' + name ) );
	}

	helpers._handlePrependAppend = function( type, name, ctn ){
		this._ensureLayoutProps();

		var start = this.buffer.mark()
			,content
			,stack = this[type]
			,namedStack = stack[name] || ( stack[name] = [] )

		ctn( this.model );
		content = this.buffer.fromMark( start );

		namedStack.push( content );
	}

	helpers.append = function(name, ctn){
		this._handlePrependAppend( 'appends', name, ctn );
	}

	helpers.prepend = function(name, ctn){
		this._handlePrependAppend( 'prepends', name, ctn );
	}

}());
