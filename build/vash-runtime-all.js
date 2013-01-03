/**
 * Vash - JavaScript Template Parser, v0.5.15-1896
 *
 * https://github.com/kirbysayshi/vash
 *
 * Copyright (c) 2012 Andrew Petersen
 * MIT License (LICENSE)
 */
 
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
		return this.buffer.toString();
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
		if( buffer instanceof Array ) {
			this._vo.push.apply( this._vo, buffer );
		} else if ( arguments.length > 1 ) {
			this._vo.push.apply( this._vo, Array.prototype.slice.call( arguments ));
		} else {
			this._vo.push( buffer );
		}
	};

	Buffer.prototype.indexOf = function( str ){

		for( var i = 0; i < this._vo.length; i++ ){
			if( this._vo[i] == str ){
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

	var reMark = /\[VASHMARK\-\d{1,8}(?::[\s\S]+?)?]/g

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

	// ERROR REPORTING
	///////////////////////////////////////////////////////////////////////////

	///////////////////////////////////////////////////////////////////////////
	// VASH.LINK
	// Reconstitute precompiled functions

	vash['link'] = function( cmpFunc, modelName, helpersName ){

		var joined;

		if( typeof cmpFunc === 'string' ){
			joined = cmpFunc;
			try {
				cmpFunc = new Function(modelName, helpersName, '__vopts', 'vash', joined);
			} catch(e){
				helpers.reportError(e, 0, 0, joined, /\n/);
			}
		}

		// need this to enable `vash.batch` to reconstitute
		cmpFunc.options = { modelName: modelName, helpersName: helpersName };

		var linked = function( model, opts ){

			// allow for signature: model, callback
			if( typeof opts === 'function' ) {
				opts = { onRenderEnd: opts };
			}

			opts = opts || {};

			// allow for passing in onRenderEnd via model
			if( model && model.onRenderEnd && opts && !opts.onRenderEnd ){
				opts.onRenderEnd = model.onRenderEnd;
			}

			if( model && model.onRenderEnd ){
				delete model.onRenderEnd;
			}

			return cmpFunc( model, (opts && opts.context) || new Helpers( model ), opts, vash );
		};

		linked.toString = function(){
			return cmpFunc.toString();
		};

		linked.toClientString = function(){
			return 'vash.link( ' + cmpFunc.toString() + ', "' + modelName + '", "' + helpersName + '" )';
		};

		return linked;
	};

	// VASH.LINK
	///////////////////////////////////////////////////////////////////////////

	///////////////////////////////////////////////////////////////////////////
	// TPL CACHE

	vash.lookup = function( path, model ){
		var tpl = vash.helpers.tplcache[path];
		if( !tpl ){ throw new Error('Could not find template: ' + path); }
		if( model ){ return tpl(model); }
		else return tpl;
	};

	vash.install = function( path, tpl ){
		var cache = vash.helpers.tplcache;
		if( typeof tpl === 'string' ){
			if( !vash.compile ){ throw new Error('vash.install(path, [string]) is not available in the standalone runtime.') }
			tpl = vash.compile(tpl);
		}
		return cache[path] = tpl;
	};

	vash.uninstall = function( path ){
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

			cb( err, tpl(options, function(err, ctx){
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

			prepends && prepends.forEach(function(p){ self.buffer.push( p ); });

			// a block might never have a callback defined, e.g. is optional
			// with no default content
			block = blocks.pop();
			block && this.buffer.push( block );

			appends && appends.forEach(function(a){ self.buffer.push( a ); });

			// grab rendered content
			content = this.buffer.fromMark( m );

			// inject it at the right position (mark)...
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
