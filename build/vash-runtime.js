/**
 * Vash - JavaScript Template Parser, v0.5.13-1803
 *
 * https://github.com/kirbysayshi/vash
 *
 * Copyright (c) 2012 Andrew Petersen
 * MIT License (LICENSE)
 */
 
/*jshint strict:false, asi: false, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */
;(function(){

	vash = typeof vash === 'undefined' ? {} : vash;

	if(!vash.compile && typeof define === 'function' && define['amd']){
		define(function(){ return vash }); // AMD
	} else if(!vash.compile && typeof module === 'object' && module['exports']){
		module['exports'] = vash; // NODEJS
	} else if(!vash.compile){
		window['vash'] = vash; // BROWSER
	}

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
	// VASH.LINK
	// Reconstitute precompiled functions

	vash['link'] = function( cmpFunc, Helpers ){
		Helpers = Helpers || vash.helpers.constructor;

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

			return cmpFunc( model, (opts && opts.context) || new Helpers( model ), opts );
		}

		linked.toString = function(){
			return cmpFunc.toString();
		}

		linked.toClientString = function(){
			return 'vash.link( ' + cmpFunc.toString() + ' )';
		}

		return linked;
	}

	// VASH.LINK
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
