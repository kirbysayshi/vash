!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.vash=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){

exports.context = function(input, lineno, columnno, linebreak) {
  linebreak = linebreak || '!LB!';

  var lines = input.split(linebreak)
    , contextSize = lineno === 0 && columnno === 0 ? lines.length - 1 : 3
    , start = Math.max(0, lineno - contextSize)
    , end = Math.min(lines.length, lineno + contextSize);

  return lines
    .slice(start, end)
    .map(function(line, i, all){
      var curr = i + start + 1;

      return (curr === lineno ? '  > ' : '    ')
        + (curr < 10 ? ' ' : '')
        + curr
        + ' | '
        + line;
    }).join('\n');
}
},{}],2:[function(_dereq_,module,exports){
module.exports={
  "name": "vash",
  "description": "Razor syntax for JS templating",
  "version": "0.8.2",
  "author": "Andrew Petersen <senofpeter@gmail.com>",
  "homepage": "https://github.com/kirbysayshi/vash",
  "bin": {
    "vash": "./bin/vash"
  },
  "keywords": [
    "razor",
    "parser",
    "template",
    "express"
  ],
  "repository": {
    "type": "git",
    "url": "git://github.com/kirbysayshi/vash"
  },
  "main": "index.js",
  "engines": {
    "node": ">= 0.8"
  },
  "scripts": {
    "coverage": "VASHPATH=../../index.js VASHRUNTIMEPATH=../../runtime.js browserify -t envify -t coverify test/vows/vash.test.js | node | coverify",
    "build": "browserify index.js --standalone vash > build/vash.js && browserify --standalone vash runtime.js > build/vash-runtime.js && browserify --standalone vash --external fs --external path lib/helpers/index.js > build/vash-runtime-all.js",
    "test": "VASHPATH=../../index.js VASHRUNTIMEPATH=../../runtime.js vows test/vows/vash.*.js --spec",
    "docs": "scripts/docs.sh",
    "docs-dev": "scripts/docs-dev.sh"
  },
  "dependencies": {
    "commander": "~1.1.1",
    "uglify-js": "1.0.6",
    "debug": "^0.7.4"
  },
  "devDependencies": {
    "browserify": "^3.33.0",
    "coverify": "~1.0.6",
    "envify": "^1.2.1",
    "jshint": "0.8.0",
    "marked": "~0.2.8",
    "semver": "~1",
    "uglify-js": "^2.4.13",
    "vows": "^0.8.1"
  }
}

},{}],3:[function(_dereq_,module,exports){

var error = _dereq_('./lib/error');
var runtime = {
  version: _dereq_('./package.json').version
};

var helpers = runtime['helpers'];

module.exports = runtime;

function Helpers( model ) {
  this.buffer = new Buffer();
  this.model  = model;
  this.options = null; // added at render time

  this.vl = 0;
  this.vc = 0;
};

runtime['helpers']
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
  var func = function() { return val; };

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

var Mark = runtime['Mark'] = function( buffer, debugName ){
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

  // The mark may be within a string due to block manipulation shenanigans.
  var escaped = this.uid.replace(/(\[|\])/g, '\\$1');
  var re = new RegExp(escaped);
  return this.markedIndex = this.buffer.indexOf( re );
}

// MARKS
///////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////
// ERROR REPORTING

// Liberally modified from https://github.com/visionmedia/jade/blob/master/jade.js
helpers.constructor.reportError = function(e, lineno, chr, orig, lb, atRenderTime){

  lb = lb || '!LB!';

  var contextStr = error.context(orig, lineno, chr, lb);

  e.vashlineno = lineno;
  e.vashcharno = chr;
  e.message = 'Problem while '
    + (atRenderTime ? 'rendering' : 'compiling')
    + ' template at line '
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
// interpreted as a compiled helper, and is attached to `runtime.helpers` at
// a property name equal to `options.asHelper`.

runtime['link'] = function( cmpFunc, options ){

  // TODO: allow options.filename to be used as sourceUrl?

  var  originalFunc
    ,cmpOpts;

  if( !options.args ){
    // every template has these arguments
    options.args = [options.modelName, options.helpersName, '__vopts', 'runtime'];
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
      helpers.reportError(e, 0, 0, originalFunc, /\n/, false);
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
        return cmpFunc( model, ctx, opts, runtime );
      }

      opts = divineRuntimeTplOptions( model, opts );
      return cmpFunc( model, (opts && opts.context) || new Helpers( model ), opts, runtime );
    }
  }

  // show the template-specific code, instead of the generic linked function
  linked['toString'] = function(){ return cmpFunc.toString(); }

  // shortcut to show the actual linked function
  linked['_toString'] = function(){ return Function.prototype.toString.call(linked) }

  // This assumes a vash global, and should be deprecated.
  // TODO: @deprecate
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

runtime['lookup'] = function( path, model ){
  var tpl = runtime.helpers.tplcache[path];
  if( !tpl ){ throw new Error('Could not find template: ' + path); }
  if( model ){ return tpl(model); }
  else return tpl;
};

runtime['install'] = function( path, tpl ){
  var cache = runtime.helpers.tplcache;
  if( typeof tpl === 'string' ){
    // Super hacky: if the calling context has a `compile` function,
    // then `this` is likely full vash. This is simply for backwards
    // compatibility.
    // TODO: @deprecate
    if ( typeof this.compile === 'function') {
      tpl = this.compile(tpl);
    } else {
      throw new Error('.install(path, [string]) is not available in the standalone runtime.');
    }
  } else if( typeof path === 'object' ){
    tpl = path;
    Object.keys(tpl).forEach(function(path){
      cache[path] = tpl[path];
    });
    return cache;
  }
  return cache[path] = tpl;
};

runtime['uninstall'] = function( path ){
  var  cache = runtime.helpers.tplcache
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

},{"./lib/error":1,"./package.json":2}]},{},[3])
(3)
});