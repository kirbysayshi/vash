var helpers = require('../../runtime').helpers;
var copyrtl = require('../util/copyrtl');

// For now, using the layout helpers requires a full build. For now.
var vash = require('../../index');
module.exports = vash;

///////////////////////////////////////////////////////////////////////////
// LAYOUT HELPERS

// semi hacky guard to prevent non-nodejs erroring
// switched from window not existing to global existing
// to avoid conflict with Jest where window is always defined(!)
if( typeof global !== 'undefined' ){
  var  fs = require('fs')
    ,path = require('path')
}

// TRUE implies that all TPLS are loaded and waiting in cache
helpers.config.browser = false;

vash.loadFile = function(filepath, options, cb){

  // options are passed in via Express
  // {
  //   settings:
  //   {
  //      env: 'development',
  //    'jsonp callback name': 'callback',
  //    'json spaces': 2,
  //    views: '/Users/drew/Dropbox/js/vash/test/fixtures/views',
  //    'view engine': 'vash'
  //   },
  //   _locals: [Function: locals],
  //   cache: false
  // }

  // The only required options are:
  //
  // settings: {
  //     views: ''
  // }

  options = copyrtl({}, vash.config, options || {});

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

vash.renderFile = vash.__express = function(filepath, options, cb){

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

  var self = this, name, marks, blocks, prepends, appends, injectMark, m, content, block

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

    if (err) throw err;

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
    if (err) throw err;
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
