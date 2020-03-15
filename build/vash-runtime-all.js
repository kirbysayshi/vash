(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.vash = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var debug = require('debug')
var lg = debug('vash:main');

var Lexer = require('./lib/lexer');
var Parser = require('./lib/parser');
var codegen = require('./lib/codegen');
var runtime = require('./runtime');
var helperbatch = require('./lib/helperbatch');
var copyrtl = require('./lib/util/copyrtl');

// Attach all runtime exports to enable backwards compatible behavior,
// like `vash.install` to still be accessible in a full build.
require('./lib/helpers');
copyrtl(exports, runtime);

exports.config = {

  // Parser Options
  favorText: false,
  // TODO: are these even needed with proper codegen?
  saveAT: false,
  saveTextTag: false,

  // Compiler Options
  useWith: false,
  htmlEscape: true,
  helpersName: 'html',
  modelName: 'model',
  debug: true,
  source: null,
  simple: false,

  // Runtime options
  asHelper: false,
  args: null // Internal, for compiled helpers
}

exports.version = require('./package.json').version;

exports.compileStream = function() {
  // This could eventually handle waiting until a `null`
  // is pushed into the lexer, etc.
  throw new Error('NotImplemented');
}

exports.compile = function(markup, options) {

  if(markup === '' || typeof markup !== 'string') {
    throw new Error('Empty or non-string cannot be compiled');
  }

  var opts = copyrtl({}, exports.config, options || {});

  var l = new Lexer();

  l.write(markup);
  var tokens = l.read();

  var p = new Parser(opts);
  p.write(tokens);
  var more = true;
  while(more !== null) more = p.read();

  p.checkStack();

  // Stash the original input (new lines normalized by the lexer).
  opts.source = l.originalInput;

  p.lg(p.dumpAST());

  var compiled = codegen(p.stack[0], opts);
  lg(compiled);
  var tpl = runtime.link(compiled, opts);

  return tpl;
}

///////////////////////////////////////////////////////////////////////////
// VASH.COMPILEHELPER
//
// Allow multiple helpers to be compiled as templates, for helpers that
// do a lot of markup output.
//
// Takes a template such as:
//
//    vash.helpers.p = function(text){
//      <p>@text</p>
//    }
//
// And compiles it. The template is then added to `vash.helpers`.
//
// Returns the compiled templates as named properties of an object.
//
// This is string manipulation at its... something. It grabs the arguments
// and function name using a regex, not actual parsing. Definitely error-
// prone, but good enough. This is meant to facilitate helpers with complex
// markup, but if something more advanced needs to happen, a plain helper
// can be defined and markup added using the manual Buffer API.
exports['compileHelper'] = helperbatch.bind(null, 'helper', exports.compile);

///////////////////////////////////////////////////////////////////////////
// VASH.COMPILEBATCH
//
// Allow multiple templates to be contained within the same string.
// Templates are separated via a sourceURL-esque string:
//
// //@batch = tplname/or/path
//
// The separator is forgiving in terms of whitespace:
//
// // @      batch=tplname/or/path
//
// Is just as valid.
//
// Returns the compiled templates as named properties of an object.
exports['compileBatch'] = exports['batch'] = helperbatch.bind(null, 'batch', exports.compile);
},{"./lib/codegen":2,"./lib/helperbatch":4,"./lib/helpers":6,"./lib/lexer":9,"./lib/parser":24,"./lib/util/copyrtl":26,"./package.json":35,"./runtime":36,"debug":30}],2:[function(require,module,exports){

var debug = require('debug');
var lg = debug('vash:codegen');

var gens = {}

gens.VashProgram = function(node, opts, generate) {
  return node.body.map(generate).join('');
}

gens.VashExplicitExpression = function(node, opts, generate) {
  var str = node.values.map(generate).join('');
  str = '(' + maybeHTMLEscape(node, opts, str) + ')';
  if (parentIsContent(node)) {
    str = bewrap(str);
  }
  return str;
}

gens.VashExpression = function(node, opts, generate) {
  var str = node.values.map(generate).join('');
  str = bewrap(maybeHTMLEscape(node, opts, str));
  return str;
}

gens.VashRegex = function(node, opts, generate) {
  var str = node.values.map(generate).join('');
  str = maybeHTMLEscape(node, opts, str);
  if (parentIsContent(node)) {
    str = bewrap(str);
  }
  return str;
}

gens.VashMarkup = function(node, opts, generate) {
  var isText = node.name === 'text';
  var name = node.name ? bcwrap(node.name) : '';
  var tagNameValue = name
    + (node.expression ? generate(node.expression) : '');

  var tagOpen = ''
    + bcwrap('<')
    + tagNameValue
    + bcwrap(node.attributes.length ? ' ' : '')
    + node.attributes.map(generate).join(bcwrap(' '))

  var values;
  var tagClose;

  if (node.isVoid) {
    tagOpen += bcwrap(node.voidClosed ? ' />' : '>');
    values = '';
    tagClose = '';
  } else {
    tagOpen += bcwrap('>');
    values = node.values.map(generate).join('');
    tagClose = node.isClosed ? bcwrap('</') + tagNameValue + bcwrap('>') : '';
  }

  if (isText) {
    tagOpen = tagClose = '';
  }

  return ''
    + (parentIsExpression(node) ? '(function () {' : '')
    + dbgstart(node, opts)
    + tagOpen
    + values
    + tagClose
    + dbgend(node, opts)
    + (parentIsExpression(node) ? '}())' : '')
}

gens.VashMarkupAttribute = function(node, opts, generate) {
  var quote = node.rightIsQuoted || '';
  quote = escapeMarkupContent(quote);
  return ''
    + dbgstart(node, opts)
    + node.left.map(generate).join('')
    + (node.right.length || node.rightIsQuoted
      ?   bcwrap('=' + quote)
        + node.right.map(generate).join('')
        + bcwrap(quote)
      : '')
    + dbgend(node, opts);
}

gens.VashMarkupContent = function(node, opts, generate) {
  return ''
    + dbgstart(node, opts)
    + node.values.map(generate).join('')
    + dbgend(node, opts);
}

gens.VashMarkupComment = function(node, opts, generate) {
  return ''
    + bcwrap('<!--')
    + dbgstart(node, opts)
    + node.values.map(generate).join('')
    + dbgend(node, opts)
    + bcwrap('-->');
}

gens.VashBlock = function(node, opts, generate) {
  var hasValues = node.values.length > 0;
  var unsafeForDbg = node.keyword === 'switch'
    || !node.name
    || !hasValues;
  var openBrace = hasValues || node.hasBraces
    ? '{' + (unsafeForDbg ? '' : dbgstart(node, opts))
    : '';
  var closeBrace = hasValues || node.hasBraces
    ? (unsafeForDbg ? '' : dbgend(node, opts)) + '}'
    : '';
  return ''
    + (node.keyword ? node.keyword : '')
    + node.head.map(generate).join('')
    + openBrace
    + node.values.map(generate).join('')
    + closeBrace
    + node.tail.map(generate).join('');
}

gens.VashIndexExpression = function(node, opts, generate) {
  var str = node.values.map(generate).join('');
  return '[' + str + ']';
}

gens.VashText = function(node, opts, generate) {
  if (!node.value.length) return '';
  return parentIsContent(node)
    ? ''
      + dbgstart(node, opts)
      + bcwrap(escapeMarkupContent(node.value))
      + dbgend(node, opts)
    : node.value;
}

gens.VashComment = function(node, opts, generate) {
  return '';
}

var reQuote = /(['"])/g;
var reEscapedQuote = /\\+(["'])/g;
var reLineBreak = /\n/g;
var reHelpersName = /HELPERSNAME/g;
var reModelName = /MODELNAME/g;
var reOriginalMarkup = /ORIGINALMARKUP/g;

function escapeMarkupContent(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(reQuote, '\\$1')
    .replace(reLineBreak, '\\n');
}

var BUFFER_HEAD = '\n__vbuffer.push(';
var BUFFER_TAIL = ');\n';

// buffer content wrap
function bcwrap(str) {
  return BUFFER_HEAD + '\'' + str.replace(/\n/, '\\n') + '\'' + BUFFER_TAIL;
}

// buffer expression wrap
function bewrap(str) {
  return BUFFER_HEAD + str + BUFFER_TAIL;
}

function parentIsContent(node) {
  return node.parent.type === 'VashMarkup'
    || node.parent.type === 'VashMarkupContent'
    || node.parent.type === 'VashMarkupComment'
    || node.parent.type === 'VashMarkupAttribute'
    || node.parent.type === 'VashProgram';
}

function parentIsExpression(node) {
  return node.parent.type === 'VashExpression'
    || node.parent.type === 'VashExplicitExpression'
    || node.parent.type === 'VashIndexExpression';
}

function dbgstart(node, opts) {
  return opts.debug
    ? ''
      + opts.helpersName + '.vl = ' + node.startloc.line + ', '
      + opts.helpersName + '.vc = ' + node.startloc.column + '; \n'
    : '';
}

function dbgend(node, opts) {
  return opts.debug
    ? ''
      + opts.helpersName + '.vl = ' + node.endloc.line + ', '
      + opts.helpersName + '.vc = ' + node.endloc.column + '; \n'
    : '';
}

function maybeHTMLEscape(node, opts, str) {
  if (parentIsContent(node) && opts.htmlEscape) {
    return opts.helpersName + '.escape(' + str + ').toHtmlString()';
  } else {
    return str;
  }
}

function replaceDevTokens(str, opts){
  return str
    .replace( reHelpersName, opts.helpersName )
    .replace( reModelName, opts.modelName );
}

function head(opts){
  var str = ''
    + (opts.debug ? 'try { \n' : '')
    + 'var __vbuffer = HELPERSNAME.buffer; \n'
    + 'HELPERSNAME.options = __vopts; \n'
    + 'MODELNAME = MODELNAME || {}; \n'
    + (opts.useWith ? 'with( MODELNAME ){ \n' : '');

  str = replaceDevTokens(str, opts);
  return str;
}

function helperHead(opts){
  var str = ''
    + (opts.debug ? 'try { \n' : '')
    + 'var __vbuffer = this.buffer; \n'
    + 'var MODELNAME = this.model; \n'
    + 'var HELPERSNAME = this; \n';

  str = replaceDevTokens(str, opts);
  return str;
}

function tail(opts){
  var str = ''
    + (opts.simple
      ? 'return HELPERSNAME.buffer.join(""); \n'
      : ';(__vopts && __vopts.onRenderEnd && __vopts.onRenderEnd(null, HELPERSNAME)); \n'
        + 'return (__vopts && __vopts.asContext) \n'
        + '  ? HELPERSNAME \n'
        + '  : HELPERSNAME.toString(); \n' )
    + (opts.useWith ? '} \n' : '')
    + (opts.debug ? '} catch( e ){ \n'
      + '  HELPERSNAME.reportError( e, HELPERSNAME.vl, HELPERSNAME.vc, "ORIGINALMARKUP", "!LB!", true ); \n'
      + '} \n' : '');

  str = replaceDevTokens(str, opts)
    .replace(reOriginalMarkup, escapeForDebug(opts.source));

  return str;
}

 function helperTail(opts){
  var str = ''
    + (opts.debug ? '} catch( e ){ \n'
      + '  HELPERSNAME.reportError( e, HELPERSNAME.vl, HELPERSNAME.vc, "ORIGINALMARKUP", "!LB!", true ); \n'
      + '} \n' : '');

  str = replaceDevTokens(str, opts)
    .replace(reOriginalMarkup, escapeForDebug(opts.source));

  return str;
}

function escapeForDebug( str ){
  return str
    .replace(reLineBreak, '!LB!')
    .replace(reQuote, '\\$1')
    .replace(reEscapedQuote, '\\$1')
}

// Not necessary, but provides faster execution when not in debug mode
// and looks nicer.
function condenseContent(str) {
  return str
    .replace(/'\);\n+__vbuffer.push\('/g, '')
    .replace(/\n+/g, '\n');
}

function generate(node, opts) {

  function gen(opts, node) {
    lg('Entering ' + node.type);
    var str = gens[node.type](node, opts, genChild);
    lg('Leaving ' + node.type);
    return str;

    function genChild(child) {
      if (!child.parent) child.parent = node;
      lg('Generating child type %s of parent type %s', child.type, node.type)
      return gen(opts, child);
    }
  }

  var generated = gen(opts, node);

  var body;
  if(!opts.asHelper){
    body = head(opts) + generated + tail(opts);
  } else {
    body = helperHead(opts) + generated + helperTail(opts);
  }

  return opts.debug
    ? body
    : condenseContent(body);
}

module.exports = generate;

},{"debug":30}],3:[function(require,module,exports){

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
},{}],4:[function(require,module,exports){

var slice = Array.prototype.slice

  , reHelperFuncHead = /vash\.helpers\.([^= ]+?)\s*=\s*function([^(]*?)\(([^)]*?)\)\s*{/
  , reHelperFuncTail = /\}$/

  , reBatchSeparator = /^\/\/\s*@\s*batch\s*=\s*(.*?)$/

// The logic for compiling a giant batch of templates or several
// helpers is nearly exactly the same. The only difference is the
// actual compilation method called, and the regular expression that
// determines how the giant string is split into named, uncompiled
// template strings.
module.exports = function compile(type, compile, str, options){

  var separator = type === 'helper'
    ? reHelperFuncHead
    : reBatchSeparator;

  var tpls = splitByNamedTpl(separator, str, function(ma, name){
    return name.replace(/^\s+|\s+$/, '');
  }, type === 'helper' ? true : false);

  if(tpls){
    Object.keys(tpls).forEach(function(path){
      tpls[path] = type === 'helper'
        ? compileSingleHelper(compile, tpls[path], options)
        : compile('@{' + tpls[path] + '}', options);
    });

    tpls.toClientString = function(){
      return Object.keys(tpls).reduce(function(prev, curr){
        if(curr === 'toClientString'){
          return prev;
        }
        return prev + tpls[curr].toClientString() + '\n';
      }, '')
    }
  }

  return tpls;
}

// Given a separator regex and a function to transform the regex result
// into a name, take a string, split it, and group the rejoined strings
// into an object.
// This is useful for taking a string, such as
//
//    // tpl1
//    what what
//    and more
//
//    // tpl2
//    what what again
//
// and returning:
//
//    {
//      tpl1: 'what what\nand more\n',
//      tpl2: 'what what again'
//    }
var splitByNamedTpl = function(reSeparator, markup, resultHandler, keepSeparator){

  var  lines = markup.split(/[\n\r]/g)
    ,tpls = {}
    ,paths = []
    ,currentPath = ''

  lines.forEach(function(line, i){

    var  pathResult = reSeparator.exec(line)
      ,handlerResult = pathResult ? resultHandler.apply(pathResult, pathResult) : null

    if(handlerResult){
      currentPath = handlerResult;
      tpls[currentPath] = [];
    }

    if((!handlerResult || keepSeparator) && line){
      tpls[currentPath].push(line);
    }
  });

  Object.keys(tpls).forEach(function(key){
    tpls[key] = tpls[key].join('\n');
  })

  return tpls;
}

var compileSingleHelper = function(compile, str, options){

  options = options || {};

    // replace leading/trailing spaces, and parse the function head
  var  def = str.replace(/^[\s\n\r]+|[\s\n\r]+$/, '').match(reHelperFuncHead)
    // split the function arguments, kill all whitespace
    ,args = def[3].split(',').map(function(arg){ return arg.replace(' ', '') })
    ,name = def[1]
    ,body = str
      .replace( reHelperFuncHead, '' )
      .replace( reHelperFuncTail, '' )

  // Wrap body in @{} to simulate it actually being inside a function
  // definition, since we manually stripped it. Without this, statements
  // such as `this.what = "what";` that are at the beginning of the body
  // will be interpreted as markup.
  body = '@{' + body + '}';

  // `args` and `asHelper` inform `vash.compile/link` that this is a helper
  options.args = args;
  options.asHelper = name;
  return compile(body, options);
}

},{}],5:[function(require,module,exports){
var helpers = require('../../runtime').helpers;

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
  cb( this.model );

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

},{"../../runtime":36}],6:[function(require,module,exports){
require('./trim');
require('./highlight');
require('./layout');
module.exports = require('../../runtime');
},{"../../runtime":36,"./highlight":5,"./layout":7,"./trim":8}],7:[function(require,module,exports){
(function (global){
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

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../../index":1,"../../runtime":36,"../util/copyrtl":26,"fs":"fs","path":"path"}],8:[function(require,module,exports){
var helpers = require('../../runtime').helpers;

// Trim whitespace from the start and end of a string
helpers.trim = function(val){
  return val.replace(/^\s*|\s*$/g, '');
}
},{"../../runtime":36}],9:[function(require,module,exports){
var debug = require('debug');
var tokens = require('./tokens');

// This pattern and basic lexer code were originally from the
// Jade lexer, but have been modified:
// https://github.com/visionmedia/jade/blob/master/lib/lexer.js

function VLexer(){
  this.lg = debug('vash:lexer');
  this.input = '';
  this.originalInput = '';
  this.lineno = 1;
  this.charno = 0;
}

module.exports = VLexer;

VLexer.prototype = {

  write: function(input) {
    var normalized = input.replace(/\r\n|\r/g, '\n');

    // Kill BOM if this is the first chunk.
    if (this.originalInput.length == 0) {
      normalized = normalized.replace(/^\uFEFF/, '');
    }

    this.input += normalized;
    this.originalInput += normalized;
    return true;
  },

  read: function() {
    var out = []
      , result;
    while(this.input.length) {
      result = this.advance();
      if (result) {
        out.push(result);
        this.lg('Read %s at line %d, column %d with content %s',
          result.type, result.line, result.chr, result.val.replace(/(\n)/, '\\n'));
      }
    }
    return out;
  },

  scan: function(regexp, type){
    var captures, token;
    if (captures = regexp.exec(this.input)) {
      this.input = this.input.substr((captures[1].length));

      token = {
        type: type
        ,line: this.lineno
        ,chr: this.charno
        ,val: captures[1] || ''
        ,toString: function(){
          return '[' + this.type
            + ' (' + this.line + ',' + this.chr + '): '
            + this.val.replace(/(\n)/, '\\n') + ']';
        }
      };

      this.charno += captures[0].length;
      return token;
    }
  }

  ,advance: function() {

    var i, name, test, result;

    for(i = 0; i < tokens.tests.length; i += 2){
      test = tokens.tests[i+1];
      test.displayName = tokens.tests[i];

      if(typeof test === 'function'){
        // assume complex callback
        result = test.call(this);
      }

      if(typeof test.exec === 'function'){
        // assume regex
        result = this.scan(test, tokens.tests[i]);
      }

      if( result ){
        return result;
      }
    }
  }
}

},{"./tokens":25,"debug":30}],10:[function(require,module,exports){
var Node = module.exports = function BlockNode() {
  this.type = 'VashBlock';
  this.keyword = null;
  this.head = [];
  this.values = [];
  this.tail = [];
  this.hasBraces = null;
  this.startloc = null;
  this.endloc = null;

  this._reachedOpenBrace = false;
  this._reachedCloseBrace = false;
  this._withinCommentLine = false;
  this._waitingForEndQuote = null;
}

Node.prototype.endOk = function() {
  var gradeSchool = this.hasBraces
    && (!this._reachedOpenBrace || !this._reachedCloseBrace);

  return (gradeSchool || this._withinCommentLine || this._waitingForEndQuote)
    ? false
    : true;
}
},{}],11:[function(require,module,exports){
var Node = module.exports = function CommentNode() {
  this.type = 'VashComment';
  this.values = [];
  this.startloc = null;
  this.endloc = null;

  this._waitingForClose = null;
}

Node.prototype.endOk = function() {
  return this._waitingForClose
    ? false
    : true;
}
},{}],12:[function(require,module,exports){
var Node = module.exports = function ExplicitExpressionNode() {
  this.type = 'VashExplicitExpression';
  this.values = [];
  this.startloc = null;
  this.endloc = null;

  this._waitingForParenClose = null;
  this._waitingForEndQuote = null;
}

Node.prototype.endOk = function() {
  return this._waitingForEndQuote || this._waitingForParenClose
    ? false
    : true;
}
},{}],13:[function(require,module,exports){
var Node = module.exports = function ExpressionNode() {
  this.type = 'VashExpression';
  this.values = [];
  this.startloc = null;
  this.endloc = null;
}
},{}],14:[function(require,module,exports){
var Node = module.exports = function IndexExpressionNode() {
  this.type = 'VashIndexExpression';
  this.values = [];
  this.startloc = null;
  this.endloc = null;

  this._waitingForEndQuote = null;
  this._waitingForHardParenClose = null;
}

Node.prototype.endOk = function() {
  return (this._waitingForEndQuote || this._waitingForHardParenClose)
    ? false
    : true;
}
},{}],15:[function(require,module,exports){
module.exports = function LocationNode() {
  this.line = 1;
  this.column = 0;
}
},{}],16:[function(require,module,exports){
var Node = module.exports = function MarkupNode() {
  this.type = 'VashMarkup';
  this.name = null;
  this.expression = null; // or ExpressionNode
  this.attributes = [];
  this.values = [];
  this.isVoid = false;
  this.voidClosed = false;
  this.isClosed = false;
  this.startloc = null;
  this.endloc = null;

  this._finishedOpen = false;
  // Waiting for the finishing > of the </close>
  this._waitingForFinishedClose = false;
}

var voids = module.exports.voids = [

  // Just a little bit of cheating.
  '!DOCTYPE', '!doctype', 'doctype',

  // From the spec
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
];

Node.isVoid = function(name) {
  return voids.indexOf(name) > -1;
}

// HTML5 allows these to be non-closed.
// http://www.whatwg.org/specs/web-apps/current-work/multipage/tree-construction.html#generate-implied-end-tags
var implieds = [
  'dd', 'dt', 'li', 'option', 'optgroup', 'p', 'rp', 'rt'
]

Node.isImplied = function(name) {
  return implieds.indexOf(name) > -1;
}

Node.prototype.endOk = function() {

  if (
    this._finishedOpen
    && (this.isClosed || this.voidClosed)
  ) {
    return true;
  }

  return false;
}
},{}],17:[function(require,module,exports){
var Node = module.exports = function MarkupAttributeNode() {
  this.type = 'VashMarkupAttribute';
  this.left = [];
  this.right = [];
  this.rightIsQuoted = false;
  this.startloc = null;
  this.endloc = null;

  this._finishedLeft = false;
  this._expectRight = false;
}

Node.prototype.endOk = function() {
  // TODO: this should include expecting right + found quotes or not.
  return this._finishedLeft
    ? true
    : false;
}
},{}],18:[function(require,module,exports){
var Node = module.exports = function MarkupCommentNode() {
  this.type = 'VashMarkupComment';
  this.values = [];
  this.startloc = null;
  this.endloc = null;

  this._finishedOpen = false
  this._waitingForClose = null;
}

Node.prototype.endOk = function() {
  return this._waitingForClose || this._finishedOpen
    ? false
    : true;
}
},{}],19:[function(require,module,exports){
var Node = module.exports = function MarkupContentNode() {
  this.type = 'VashMarkupContent';
  this.values = [];
  this.startloc = null;
  this.endloc = null;

  this._waitingForNewline = null;
}

Node.prototype.endOk = function() {
  return this._waitingForNewline
    ? false
    : true;
}
},{}],20:[function(require,module,exports){
module.exports = function ProgramNode() {
  this.type = 'VashProgram';
  this.body = [];
}
},{}],21:[function(require,module,exports){

// Need to handle:
// if (true) /abc/.test()
// if (/abc/.test('what'))
// @(/abc/.exec('abc'))
// @{ var re = /abc/gi; }
// if (a/b) {}
// @(a/=b) // Previous is IDENTIFIER or WHITESPACE

var Node = module.exports = function RegexNode() {
  this.type = 'VashRegex';
  this.values = [];
  this.startloc = null;
  this.endloc = null;

  this._waitingForForwardSlash = null;
  this._waitingForFlags = null;
}

Node.prototype.endOk = function() {
  return this._waitingForForwardSlash || this._waitingForFlags
    ? false
    : true;
}
},{}],22:[function(require,module,exports){
module.exports = function TextNode() {
  this.type = 'VashText';
  this.value = '';
  this.startloc = null;
  this.endloc = null;
}
},{}],23:[function(require,module,exports){
function clean(node) {
  return Object.keys(node).reduce(function(out, key) {
    var value = node[key];
    if (key[0] !== '_' && typeof value !== 'function') {
      if (Array.isArray(value)) {
        out[key] = value.map(clean);
      } else {
        out[key] = value;
      }
    }
    return out;
  }, {});
}

exports.clean = clean;

},{}],24:[function(require,module,exports){

var debug = require('debug');

var tks = require('./tokens');
var nodestuff = require('./nodestuff');
var error = require('./error');
var namer = require('./util/fn-namer');

var ProgramNode = namer(require('./nodes/program'));
var TextNode = namer(require('./nodes/text'));
var MarkupNode = namer(require('./nodes/markup'));
var MarkupCommentNode = namer(require('./nodes/markupcomment'));
var MarkupContentNode = namer(require('./nodes/markupcontent'));
var MarkupAttributeNode = namer(require('./nodes/markupattribute'));
var ExpressionNode = namer(require('./nodes/expression'));
var ExplicitExpressionNode = namer(require('./nodes/explicitexpression'));
var IndexExpressionNode = namer(require('./nodes/indexexpression'));
var LocationNode = namer(require('./nodes/location'));
var BlockNode = namer(require('./nodes/block'));
var CommentNode = namer(require('./nodes/comment'));
var RegexNode = namer(require('./nodes/regex'));

function Parser(opts) {
  this.lg = debug('vash:parser');
  this.tokens = [];
  this.deferredTokens = [];
  this.node = null;
  this.stack = [];
  this.inputText = '';
  this.opts = opts || {};
  this.previousNonWhitespace = null
}

module.exports = Parser;

Parser.prototype.decorateError = function(err, line, column) {
  err.message = ''
    + err.message
    + ' at template line ' + line
    + ', column ' + column + '\n\n'
    + 'Context: \n'
    + error.context(this.inputText, line, column, '\n')
    + '\n';

  return err;
}

Parser.prototype.write = function(tokens) {
  if (!Array.isArray(tokens)) tokens = [tokens];
  this.inputText += tokens.map(function(tok) { return tok.val; }).join('');
  this.tokens.unshift.apply(this.tokens, tokens.reverse());
}

Parser.prototype.read = function() {
  if (!this.tokens.length && !this.deferredTokens.length) return null;

  if (!this.node) {
    this.openNode(new ProgramNode());
    this.openNode(new MarkupNode(), this.node.body);
    this.node._finishedOpen = true;
    this.node.name = 'text';
    updateLoc(this.node, { line: 0, chr: 0 })
    this.openNode(new MarkupContentNode(), this.node.values);
    updateLoc(this.node, { line: 0, chr: 0 })
  }

  var curr = this.deferredTokens.pop() || this.tokens.pop();

  // To find this value we must search through both deferred and
  // non-deferred tokens, since there could be more than just 3
  // deferred tokens.
  // nextNonWhitespaceOrNewline
  var nnwon = null;

  for (var i = this.deferredTokens.length-1; i >= 0; i--) {
    if (
      nnwon
      && nnwon.type !== tks.WHITESPACE
      && nnwon.type !== tks.NEWLINE
    ) break;
    nnwon = this.deferredTokens[i];
  }

  for (var i = this.tokens.length-1; i >= 0; i--) {
    if (
      nnwon
      && nnwon.type !== tks.WHITESPACE
      && nnwon.type !== tks.NEWLINE
    ) break;
    nnwon = this.tokens[i];
  }

  var next = this.deferredTokens.pop() || this.tokens.pop();
  var ahead = this.deferredTokens.pop() || this.tokens.pop();

  var dispatch = 'continue' + this.node.constructor.name;

  this.lg('Read: %s', dispatch);
  this.lg('  curr %s', curr);
  this.lg('  next %s', next);
  this.lg('  ahead %s', ahead);
  this.lg('  nnwon %s', nnwon);

  if (curr._considerEscaped) {
    this.lg('  Previous token was marked as escaping');
  }

  var consumed = this[dispatch](this.node, curr, next, ahead, nnwon);

  if (ahead) {
    // ahead may be undefined when about to run out of tokens.
    this.deferredTokens.push(ahead);
  }

  if (next) {
    // Next may be undefined when about to run out of tokens.
    this.deferredTokens.push(next);
  }

  if (!consumed) {
    this.lg('Deferring curr %s', curr);
    this.deferredTokens.push(curr);
  } else {

    if (curr.type !== tks.WHITESPACE) {
      this.lg('set previousNonWhitespace %s', curr);
      this.previousNonWhitespace = curr;
    }

    // Poor man's ASI.
    if (curr.type === tks.NEWLINE) {
      this.lg('set previousNonWhitespace %s', null);
      this.previousNonWhitespace = null;
    }

    if (!curr._considerEscaped && curr.type === tks.BACKSLASH) {
      next._considerEscaped = true;
    }
  }
}

Parser.prototype.checkStack = function() {
  // Throw if something is unclosed that should be.
  var i = this.stack.length-1;
  var node;
  var msg;
  // A full AST is always:
  // Program, Markup, MarkupContent, ...
  while(i >= 2) {
    node = this.stack[i];
    if (node.endOk && !node.endOk()) {
      // Attempt to make the error readable
      delete node.values;
      msg = 'Found unclosed ' + node.type;
      var err = new Error(msg);
      err.name = 'UnclosedNodeError';
      throw this.decorateError(
        err,
        node.startloc.line,
        node.startloc.column);
    }
    i--;
  }
}

// This is purely a utility for debugging, to more easily inspect
// what happened while parsing something.
Parser.prototype.flag = function(node, name, value) {
  var printVal = (value && typeof value === 'object')
    ? value.type
    : value;
  this.lg('Flag %s on node %s was %s now %s',
    name, node.type, node[name], printVal);
  node[name] = value;
}

Parser.prototype.dumpAST = function() {
  if (!this.stack.length) {
    var msg = 'No AST to dump.';
    throw new Error(msg);
  }

  return JSON.stringify(this.stack[0], null, '  ');
}

Parser.prototype.openNode = function(node, opt_insertArr) {
  this.stack.push(node);
  this.lg('Opened node %s from %s',
    node.type, (this.node ? this.node.type : null));
  this.node = node;

  if (opt_insertArr) {
    opt_insertArr.push(node);
  }

  return node;
}

Parser.prototype.closeNode = function(node) {
  var toClose = this.stack[this.stack.length-1];
  if (node !== toClose) {
    var msg = 'InvalidCloseAction: '
      + 'Expected ' + node.type + ' in stack, instead found '
      + toClose.type;
    throw new Error(msg);
  }

  this.stack.pop();
  var last = this.stack[this.stack.length-1];

  this.lg('Closing node %s (%s), returning to node %s',
    node.type, node.name, last.type)

  this.node = last;
}

Parser.prototype.continueCommentNode = function(node, curr, next) {
  var valueNode = ensureTextNode(node.values);

  if (curr.type === tks.AT_STAR_OPEN && !node._waitingForClose) {
    this.flag(node, '_waitingForClose', tks.AT_STAR_CLOSE)
    updateLoc(node, curr);
    return true;
  }

  if (curr.type === node._waitingForClose) {
    this.flag(node, '_waitingForClose', null)
    updateLoc(node, curr);
    this.closeNode(node);
    return true;
  }

  if (curr.type === tks.DOUBLE_FORWARD_SLASH && !node._waitingForClose){
    this.flag(node, '_waitingForClose', tks.NEWLINE);
    updateLoc(node, curr);
    return true;
  }

  appendTextValue(valueNode, curr);
  return true;
}

Parser.prototype.continueMarkupNode = function(node, curr, next) {
  var valueNode = node.values[node.values.length-1];

  if (curr.type === tks.LT_SIGN && !node._finishedOpen) {
    updateLoc(node, curr);
    return true;
  }

  if (
    !node._finishedOpen
    && curr.type !== tks.GT_SIGN
    && curr.type !== tks.LT_SIGN
    && curr.type !== tks.WHITESPACE
    && curr.type !== tks.NEWLINE
    && curr.type !== tks.HTML_TAG_VOID_CLOSE
  ) {

    // Assume tag name

    if (
      curr.type === tks.AT
      && !curr._considerEscaped
      && next
      && next.type === tks.AT
    ) {
      next._considerEscaped = true;
      return true;
    }

    if (curr.type === tks.AT && !curr._considerEscaped) {
      this.flag(node, 'expression', this.openNode(new ExpressionNode()));
      updateLoc(node.expression, curr);
      return true;
    }

    node.name = node.name
      ? node.name + curr.val
      : curr.val;
    updateLoc(node, curr);
    return true;
  }

  if (curr.type === tks.GT_SIGN && !node._waitingForFinishedClose) {
    this.flag(node, '_finishedOpen', true);

    if (MarkupNode.isVoid(node.name)) {
      this.flag(node, 'isVoid', true);
      this.closeNode(node);
      updateLoc(node, curr);
    } else {
      valueNode = this.openNode(new MarkupContentNode(), node.values);
      updateLoc(valueNode, curr);
    }

    return true;
  }

  if (curr.type === tks.GT_SIGN && node._waitingForFinishedClose) {
    this.flag(node, '_waitingForFinishedClose', false);
    this.closeNode(node);
    updateLoc(node, curr);
    return true;
  }

  // </VOID
  if (
    curr.type === tks.HTML_TAG_CLOSE
    && next
    && next.type === tks.IDENTIFIER
    && MarkupNode.isVoid(next.val)
  ) {
    throw newUnexpectedClosingTagError(this, curr, curr.val + next.val);
  }

  // </
  if (curr.type === tks.HTML_TAG_CLOSE) {
    this.flag(node, '_waitingForFinishedClose', true);
    this.flag(node, 'isClosed', true);
    return true;
  }

  // -->
  if (curr.type === tks.HTML_COMMENT_CLOSE) {
    this.flag(node, '_waitingForFinishedClose', false);
    this.closeNode(node);
    return false;
  }

  if (curr.type === tks.HTML_TAG_VOID_CLOSE) {
    this.closeNode(node);
    this.flag(node, 'isVoid', true);
    this.flag(node, 'voidClosed', true);
    this.flag(node, 'isClosed', true);
    updateLoc(node, curr);
    return true;
  }

  if (node._waitingForFinishedClose) {
    this.lg('Ignoring %s while waiting for closing GT_SIGN',
      curr);
    return true;
  }

  if (
    (curr.type === tks.WHITESPACE || curr.type === tks.NEWLINE)
    && !node._finishedOpen
    && next.type !== tks.HTML_TAG_VOID_CLOSE
    && next.type !== tks.GT_SIGN
    && next.type !== tks.NEWLINE
    && next.type !== tks.WHITESPACE
  ) {
    // enter attribute
    valueNode = this.openNode(new MarkupAttributeNode(), node.attributes);
    updateLoc(valueNode, curr);
    return true;
  }

  // Whitespace between attributes should be ignored.
  if (
    (curr.type === tks.WHITESPACE || curr.type === tks.NEWLINE)
    && !node._finishedOpen
  ) {
    updateLoc(node, curr);
    return true;
  }

  // Can't really have non-markupcontent within markup, so implicitly open
  // a node. #68.
  if (node._finishedOpen) {
    valueNode = this.openNode(new MarkupContentNode(), this.node.values);
    updateLoc(valueNode, curr);
    return false; // defer
  }

  // Default

  //valueNode = ensureTextNode(node.values);
  //appendTextValue(valueNode, curr);
  //return true;
}

Parser.prototype.continueMarkupAttributeNode = function(node, curr, next) {

  var valueNode;

  if (
    curr.type === tks.AT
    && !curr._considerEscaped
    && next
    && next.type === tks.AT
  ) {
    next._considerEscaped = true;
    return true;
  }

  if (curr.type === tks.AT && !curr._considerEscaped) {
    // To expression

    valueNode = this.openNode(new ExpressionNode(), !node._finishedLeft
      ? node.left
      : node.right);

    updateLoc(valueNode, curr);
    return true;
  }

  // End of left, value only
  if (
    !node._expectRight
    && (curr.type === tks.WHITESPACE
      || curr.type === tks.GT_SIGN
      || curr.type === tks.HTML_TAG_VOID_CLOSE)
  ) {
    this.flag(node, '_finishedLeft', true);
    updateLoc(node, curr);
    this.closeNode(node);
    return false; // defer
  }

  // End of left.
  if (curr.type === tks.EQUAL_SIGN && !node._finishedLeft) {
    this.flag(node, '_finishedLeft', true);
    this.flag(node, '_expectRight', true);
    return true;
  }

  // Beginning of quoted value.
  if (
    node._expectRight
    && !node.rightIsQuoted
    && (curr.type === tks.DOUBLE_QUOTE
    || curr.type === tks.SINGLE_QUOTE)
  ) {
    this.flag(node, 'rightIsQuoted', curr.val);
    return true;
  }

  // End of quoted value.
  if (node.rightIsQuoted === curr.val) {
    updateLoc(node, curr);
    this.closeNode(node);
    return true;
  }

  // Default

  if (!node._finishedLeft) {
    valueNode = ensureTextNode(node.left);
  } else {
    valueNode = ensureTextNode(node.right);
  }

  appendTextValue(valueNode, curr);
  return true;
}

Parser.prototype.continueMarkupContentNode = function(node, curr, next, ahead) {
  var valueNode = ensureTextNode(node.values);

  if (curr.type === tks.HTML_COMMENT_OPEN) {
    valueNode = this.openNode(new MarkupCommentNode(), node.values);
    updateLoc(valueNode, curr);
    return false;
  }

  if (curr.type === tks.HTML_COMMENT_CLOSE) {
    updateLoc(node, curr);
    this.closeNode(node);
    return false;
  }

  if (curr.type === tks.AT_COLON && !curr._considerEscaped) {
    this.flag(node, '_waitingForNewline', true);
    updateLoc(valueNode, curr);
    return true;
  }

  if (curr.type === tks.NEWLINE && node._waitingForNewline === true) {
    this.flag(node, '_waitingForNewline', false);
    appendTextValue(valueNode, curr);
    updateLoc(node, curr);
    this.closeNode(node);
    return true;
  }

  if (
    curr.type === tks.AT
    && !curr._considerEscaped
    && next.type === tks.BRACE_OPEN
  ) {
    valueNode = this.openNode(new BlockNode(), node.values);
    updateLoc(valueNode, curr);
    return true;
  }

  if (
    curr.type === tks.AT
    && !curr._considerEscaped
    && (next.type === tks.BLOCK_KEYWORD
      || next.type === tks.FUNCTION)
  ) {
    valueNode = this.openNode(new BlockNode(), node.values);
    updateLoc(valueNode, curr);
    return true;
  }

  // Mark @@: or @@ as escaped.
  if (
    curr.type === tks.AT
    && !curr._considerEscaped
    && next
    && (
      next.type === tks.AT_COLON
      || next.type === tks.AT
      || next.type === tks.AT_STAR_OPEN
    )
  ) {
    next._considerEscaped = true;
    return true;
  }

  // @something
  if (curr.type === tks.AT && !curr._considerEscaped) {
    valueNode = this.openNode(new ExpressionNode(), node.values);
    updateLoc(valueNode, curr);
    return true;
  }

  if (curr.type === tks.AT_STAR_OPEN && !curr._considerEscaped) {
    this.openNode(new CommentNode(), node.values);
    return false;
  }

  var parent = this.stack[this.stack.length-2];

  // If this MarkupContent is the direct child of a block, it has no way to
  // know when to close. So in this case it should assume a } means it's
  // done. Or if it finds a closing html tag, of course.
  if (
    curr.type === tks.HTML_TAG_CLOSE
    || (curr.type === tks.BRACE_CLOSE
      && parent && parent.type === 'VashBlock')
  ) {
    this.closeNode(node);
    updateLoc(node, curr);
    return false;
  }

  if (
    curr.type === tks.LT_SIGN
    && next
    && (
      // If next is an IDENTIFIER, then try to ensure that it's likely an HTML
      // tag, which really can only be something like:
      // <identifier>
      // <identifer morestuff (whitespace)
      // <identifier\n
      // <identifier@
      // <identifier-
      // <identifier:identifier // XML namespaces etc etc
      (next.type === tks.IDENTIFIER
        && ahead
        && (
          ahead.type === tks.GT_SIGN
          || ahead.type === tks.WHITESPACE
          || ahead.type === tks.NEWLINE
          || ahead.type === tks.AT
          || ahead.type === tks.UNARY_OPERATOR
          || ahead.type === tks.COLON
        )
      )
      || next.type === tks.AT)
  ) {
    // TODO: possibly check for same tag name, and if HTML5 incompatible,
    // such as p within p, then close current.
    valueNode = this.openNode(new MarkupNode(), node.values);
    updateLoc(valueNode, curr);
    return false;
  }

  // Ignore whitespace if the direct parent is a block. This is for backwards
  // compatibility with { @what() }, where the ' ' between ) and } should not
  // be included as content. This rule should not be followed if the
  // whitespace is contained within an @: escape or within favorText mode.
  if (
    curr.type === tks.WHITESPACE
    && !node._waitingForNewline
    && !this.opts.favorText
    && parent
    && parent.type === 'VashBlock'
  ) {
    return true;
  }

  appendTextValue(valueNode, curr);
  return true;
}

Parser.prototype.continueMarkupCommentNode = function(node, curr, next) {
  var valueNode = node.values[node.values.length-1];

  if (curr.type === tks.HTML_COMMENT_OPEN) {
    this.flag(node, '_finishedOpen', true);
    this.flag(node, '_waitingForClose', tks.HTML_COMMENT_CLOSE);
    updateLoc(node, curr);
    valueNode = this.openNode(new MarkupContentNode(), node.values);
    return true;
  }

  if (curr.type === tks.HTML_COMMENT_CLOSE && node._finishedOpen) {
    this.flag(node, '_waitingForClose', null);
    updateLoc(node, curr);
    this.closeNode(node);
    return true;
  }

  valueNode = ensureTextNode(node.values);
  appendTextValue(valueNode, curr);
  return true;
}

Parser.prototype.continueExpressionNode = function(node, curr, next) {
  var valueNode = node.values[node.values.length-1];
  var pnw = this.previousNonWhitespace;

  if (
    curr.type === tks.AT
    && next.type === tks.HARD_PAREN_OPEN
  ) {
    // LEGACY: @[], which means a legacy escape to content.
    updateLoc(node, curr);
    this.closeNode(node);
    return true;
  }

  if (curr.type === tks.PAREN_OPEN) {
    this.openNode(new ExplicitExpressionNode(), node.values);
    return false;
  }

  if (
    curr.type === tks.HARD_PAREN_OPEN
    && node.values[0]
    && node.values[0].type === 'VashExplicitExpression'
  ) {
    // @()[0], hard parens should be content
    updateLoc(node, curr);
    this.closeNode(node);
    return false;
  }

  if (
    curr.type === tks.HARD_PAREN_OPEN
    && next.type === tks.HARD_PAREN_CLOSE
  ) {
    // [], empty index should be content (php forms...)
    updateLoc(node, curr);
    this.closeNode(node);
    return false;
  }

  if (curr.type === tks.HARD_PAREN_OPEN) {
    this.openNode(new IndexExpressionNode(), node.values);
    return false;
  }

  if (
    curr.type === tks.FORWARD_SLASH
    && pnw
    && pnw.type === tks.AT
  ) {
    this.openNode(new RegexNode(), node.values)
    return false;
  }

  // Default
  // Consume only specific cases, otherwise close.

  if (curr.type === tks.PERIOD && next && next.type === tks.IDENTIFIER) {
    valueNode = ensureTextNode(node.values);
    appendTextValue(valueNode, curr);
    return true;
  }

  if (curr.type === tks.IDENTIFIER) {

    if (node.values.length > 0 && valueNode && valueNode.type !== 'VashText') {
      // Assume we just ended an explicit expression.
      this.closeNode(node);
      return false;
    }

    valueNode = ensureTextNode(node.values);
    appendTextValue(valueNode, curr);
    return true;
  } else {
    this.closeNode(node);
    return false;
  }
}

Parser.prototype.continueExplicitExpressionNode = function(node, curr, next) {

  var valueNode = node.values[node.values.length-1];

  if (
    node.values.length === 0
    && (curr.type === tks.AT || curr.type === tks.PAREN_OPEN)
    && !node._waitingForParenClose
  ) {
    // This is the beginning of the explicit (mark as consumed)
    this.flag(node, '_waitingForParenClose', true);
    updateLoc(node, curr);
    return true;
  }

  if (curr.type === tks.PAREN_OPEN && !node._waitingForEndQuote) {
    // New explicit expression
    valueNode = this.openNode(new ExplicitExpressionNode(), node.values);
    updateLoc(valueNode, curr);
    // And do nothing with the token (mark as consumed)
    return true;
  }

  if (curr.type === tks.PAREN_CLOSE && !node._waitingForEndQuote) {
    // Close current explicit expression
    this.flag(node, '_waitingForParenClose', false);
    updateLoc(node, curr);
    this.closeNode(node);
    // And do nothing with the token (mark as consumed)
    return true;
  }

  if (curr.type === tks.FUNCTION && !node._waitingForEndQuote) {
    valueNode = this.openNode(new BlockNode(), node.values);
    updateLoc(valueNode, curr);
    return false;
  }

  if (
    curr.type === tks.LT_SIGN
    && next.type === tks.IDENTIFIER
    && !node._waitingForEndQuote
  ) {
    // Markup within expression
    valueNode = this.openNode(new MarkupNode(), node.values);
    updateLoc(valueNode, curr);
    return false;
  }

  var pnw = this.previousNonWhitespace;

  if (
    curr.type === tks.FORWARD_SLASH
    && !node._waitingForEndQuote
    && pnw
    && pnw.type !== tks.IDENTIFIER
    && pnw.type !== tks.NUMERAL
    && pnw.type !== tks.PAREN_CLOSE
  ) {
    valueNode = this.openNode(new RegexNode(), node.values);
    updateLoc(valueNode, curr);
    return false;
  }

  // Default
  valueNode = ensureTextNode(node.values);

  if (
    !node._waitingForEndQuote
    && (curr.type === tks.SINGLE_QUOTE || curr.type === tks.DOUBLE_QUOTE)
  ) {
    this.flag(node, '_waitingForEndQuote', curr.val);
    appendTextValue(valueNode, curr);
    return true;
  }

  if (
    curr.val === node._waitingForEndQuote
    && !curr._considerEscaped
  ) {
    this.flag(node, '_waitingForEndQuote', null);
    appendTextValue(valueNode, curr);
    return true;
  }

  appendTextValue(valueNode, curr);
  return true;
}

Parser.prototype.continueRegexNode = function(node, curr, next) {
  var valueNode = ensureTextNode(node.values);

  if (
    curr.type === tks.FORWARD_SLASH
    && !node._waitingForForwardSlash
    && !curr._considerEscaped
  ) {
    // Start of regex.
    this.flag(node, '_waitingForForwardSlash', true);
    appendTextValue(valueNode, curr);
    return true;
  }

  if (
    curr.type === tks.FORWARD_SLASH
    && node._waitingForForwardSlash
    && !curr._considerEscaped
  ) {
    // "End" of regex.
    this.flag(node, '_waitingForForwardSlash', null);
    this.flag(node, '_waitingForFlags', true);
    appendTextValue(valueNode, curr);
    return true;
  }

  if (node._waitingForFlags) {
    this.flag(node, '_waitingForFlags', null);
    this.closeNode(node);

    if (curr.type === tks.IDENTIFIER) {
      appendTextValue(valueNode, curr);
      return true;
    } else {
      return false;
    }
  }

  if (
    curr.type === tks.BACKSLASH
    && !curr._considerEscaped
  ) {
    next._considerEscaped = true;
  }

  appendTextValue(valueNode, curr);
  return true;
}

Parser.prototype.continueBlockNode = function(node, curr, next, ahead, nnwon) {

  var valueNode = node.values[node.values.length-1];

  if (curr.type === tks.AT_STAR_OPEN) {
    this.openNode(new CommentNode(), node.body);
    return false;
  }

  if (curr.type === tks.DOUBLE_FORWARD_SLASH && !node._waitingForEndQuote) {
    this.openNode(new CommentNode(), node.body);
    return false;
  }

  if (
    curr.type === tks.AT_COLON
    && (!node.hasBraces || node._reachedOpenBrace)
  ) {
    valueNode = this.openNode(new MarkupContentNode(), node.values);
    return false;
  }

  if (
    (curr.type === tks.BLOCK_KEYWORD || curr.type === tks.FUNCTION)
    && !node._reachedOpenBrace
    && !node.keyword
  ) {
    this.flag(node, 'keyword', curr.val);
    return true;
  }

  if (
    (curr.type === tks.BLOCK_KEYWORD || curr.type === tks.FUNCTION)
    && !node._reachedOpenBrace
  ) {
    // Assume something like if (test) expressionstatement;
    this.flag(node, 'hasBraces', false);
    valueNode = this.openNode(new BlockNode(), node.values);
    updateLoc(valueNode, curr);
    return false;
  }

  if (
    (curr.type === tks.BLOCK_KEYWORD || curr.type === tks.FUNCTION)
    && !node._reachedCloseBrace
    && node.hasBraces
    && !node._waitingForEndQuote
  ) {
    valueNode = this.openNode(new BlockNode(), node.values);
    updateLoc(valueNode, curr);
    return false;
  }

  if (
    (curr.type === tks.BLOCK_KEYWORD || curr.type === tks.FUNCTION)
    && node._reachedCloseBrace
    && !node._waitingForEndQuote
  ) {
    valueNode = this.openNode(new BlockNode(), node.tail);
    updateLoc(valueNode, curr);
    return false;
  }

  if (
    curr.type === tks.BRACE_OPEN
    && !node._reachedOpenBrace
    && !node._waitingForEndQuote
  ) {
    this.flag(node, '_reachedOpenBrace', true);
    this.flag(node, 'hasBraces', true);
    if (this.opts.favorText) {
      valueNode = this.openNode(new MarkupContentNode(), node.values);
      updateLoc(valueNode, curr);
    }
    return true;
  }

  if (
    curr.type === tks.BRACE_OPEN
    && !node._waitingForEndQuote
  ) {
    valueNode = this.openNode(new BlockNode(), node.values);
    updateLoc(valueNode, curr);
    return false;
  }

  if (
    curr.type === tks.BRACE_CLOSE
    && node.hasBraces
    && !node._reachedCloseBrace
    && !node._waitingForEndQuote
  ) {
    updateLoc(node, curr);
    this.flag(node, '_reachedCloseBrace', true);

    // Try to leave whitespace where it belongs, and allow `else {` to
    // be continued as the tail of this block.
    if (
      nnwon
      && nnwon.type !== tks.BLOCK_KEYWORD
    ) {
      this.closeNode(node);
    }

    return true;
  }

  if (
    curr.type === tks.BRACE_CLOSE
    && !node.hasBraces
  ) {
    // Probably something like:
    // @{ if() <span></span> }
    this.closeNode(node);
    updateLoc(node, curr);
    return false;
  }

  if (
    curr.type === tks.LT_SIGN
    && (next.type === tks.AT || next.type === tks.IDENTIFIER)
    && !node._waitingForEndQuote
    && node._reachedCloseBrace
  ) {
    this.closeNode(node);
    updateLoc(node, curr);
    return false;
  }

  if (
    curr.type === tks.LT_SIGN
    && (next.type === tks.AT || next.type === tks.IDENTIFIER)
    && !node._waitingForEndQuote
    && !node._reachedCloseBrace
  ) {
    valueNode = this.openNode(new MarkupNode(), node.values);
    updateLoc(valueNode, curr);
    return false;
  }

  if (curr.type === tks.HTML_TAG_CLOSE) {
    if (
      (node.hasBraces && node._reachedCloseBrace)
      || !node._reachedOpenBrace
    ) {
      updateLoc(node, curr);
      this.closeNode(node);
      return false;
    }

    // This is likely an invalid markup configuration, something like:
    // @if(bla) { <img></img> }
    // where <img> is an implicit void. Try to help the user in this
    // specific case.
    if (
      next
      && next.type === tks.IDENTIFIER
      && MarkupNode.isVoid(next.val)
    ){
      throw newUnexpectedClosingTagError(this, curr, curr.val + next.val);
    }
  }

  if (
    curr.type === tks.AT && next.type === tks.PAREN_OPEN
  ) {
    // Backwards compatibility, allowing for @for() { @(exp) }
    valueNode = this.openNode(new ExpressionNode(), node.values);
    updateLoc(valueNode, curr);
    return true;
  }

  var attachmentNode;

  if (node._reachedOpenBrace && node._reachedCloseBrace) {
    attachmentNode = node.tail;
  } else if (!node._reachedOpenBrace) {
    attachmentNode = node.head;
  } else {
    attachmentNode = node.values;
  }

  valueNode = attachmentNode[attachmentNode.length-1];

  if (
    curr.type === tks.AT
    && (next.type === tks.BLOCK_KEYWORD
      || next.type === tks.BRACE_OPEN
      || next.type === tks.FUNCTION)
  ) {
    // Backwards compatibility, allowing for @for() { @for() { @{ } } }
    valueNode = this.openNode(new BlockNode(), attachmentNode);
    updateLoc(valueNode, curr);
    return true;
  }

  if (
    curr.type === tks.AT
    && next.type === tks.IDENTIFIER
    && !node._waitingForEndQuote
  ) {

    if (node._reachedCloseBrace) {
      this.closeNode(node);
      return false;
    } else {
      // something like @for() { @i }
      valueNode = this.openNode(new MarkupContentNode(), attachmentNode);
      updateLoc(valueNode, curr);
      return false;
    }
  }

  if (
    curr.type !== tks.BLOCK_KEYWORD
    && curr.type !== tks.PAREN_OPEN
    && curr.type !== tks.WHITESPACE
    && curr.type !== tks.NEWLINE
    && node.hasBraces
    && node._reachedCloseBrace
  ) {
    // Handle if (test) { } content
    updateLoc(node, curr);
    this.closeNode(node);
    return false;
  }

  if (curr.type === tks.PAREN_OPEN) {
    valueNode = this.openNode(new ExplicitExpressionNode(), attachmentNode);
    updateLoc(valueNode, curr);
    return false;
  }

  valueNode = ensureTextNode(attachmentNode);

  if (
    curr.val === node._waitingForEndQuote
    && !curr._considerEscaped
  ) {
    this.flag(node, '_waitingForEndQuote', null);
    appendTextValue(valueNode, curr);
    return true;
  }

  if (
    !node._waitingForEndQuote
    && (curr.type === tks.DOUBLE_QUOTE || curr.type === tks.SINGLE_QUOTE)
  ) {
    this.flag(node, '_waitingForEndQuote', curr.val);
    appendTextValue(valueNode, curr);
    return true;
  }

  var pnw = this.previousNonWhitespace;

  if (
    curr.type === tks.FORWARD_SLASH
    && !node._waitingForEndQuote
    && pnw
    && pnw.type !== tks.IDENTIFIER
    && pnw.type !== tks.NUMERAL
    && pnw.type !== tks.PAREN_CLOSE
  ) {
    // OH GAWD IT MIGHT BE A REGEX.
    valueNode = this.openNode(new RegexNode(), attachmentNode);
    updateLoc(valueNode, curr);
    return false;
  }

  appendTextValue(valueNode, curr);
  return true;
}

// These are really only used when continuing on an expression (for now):
// @model.what[0]()
// And apparently work for array literals...
Parser.prototype.continueIndexExpressionNode = function(node, curr, next) {
  var valueNode = node.values[node.values.length-1];

  if (node._waitingForEndQuote) {
    if (curr.val === node._waitingForEndQuote) {
      this.flag(node, '_waitingForEndQuote', null);
    }

    appendTextValue(valueNode, curr);
    return true;
  }

  if (
    curr.type === tks.HARD_PAREN_OPEN
    && !valueNode
  ) {
    this.flag(node, '_waitingForHardParenClose', true);
    updateLoc(node, curr);
    return true;
  }

  if (curr.type === tks.HARD_PAREN_CLOSE) {
    this.flag(node, '_waitingForHardParenClose', false);
    this.closeNode(node);
    updateLoc(node, curr);
    return true;
  }

  if (curr.type === tks.PAREN_OPEN) {
    valueNode = this.openNode(new ExplicitExpressionNode(), node.values);
    updateLoc(valueNode, curr);
    return false;
  }

  valueNode = ensureTextNode(node.values);

  if (!node._waitingForEndQuote
    && (curr.type === tks.DOUBLE_QUOTE
    || curr.type === tks.SINGLE_QUOTE)
  ) {
    this.flag(node, '_waitingForEndQuote', curr.val);
    appendTextValue(valueNode, curr);
    return true;
  }

  // Default.

  appendTextValue(valueNode, curr);
  return true;
}

function updateLoc(node, token) {
  var loc;
  loc = new LocationNode();
  loc.line = token.line;
  loc.column = token.chr;

  if (node.startloc === null) {
    node.startloc = loc;
  }

  node.endloc = loc;
}

function ensureTextNode(valueList) {
  var valueNode = valueList[valueList.length-1];

  if (!valueNode || valueNode.type !== 'VashText') {
    valueNode = new TextNode();
    valueList.push(valueNode);
  }

  return valueNode;
}

function appendTextValue(textNode, token) {
  if (!('value' in textNode)) {
    var msg = 'Expected TextNode but found ' + textNode.type
      + ' when appending token ' + token;
    throw new Error(msg);
  }

  textNode.value += token.val;
  updateLoc(textNode, token);
}

function newUnexpectedClosingTagError(parser, tok, tagName) {
  var err = new Error(''
    + 'Found a closing tag for a known void HTML element: '
    + tagName + '.');
  err.name = 'UnexpectedClosingTagError';
  return parser.decorateError(
    err,
    tok.line,
    tok.chr);
}


},{"./error":3,"./nodes/block":10,"./nodes/comment":11,"./nodes/explicitexpression":12,"./nodes/expression":13,"./nodes/indexexpression":14,"./nodes/location":15,"./nodes/markup":16,"./nodes/markupattribute":17,"./nodes/markupcomment":18,"./nodes/markupcontent":19,"./nodes/program":20,"./nodes/regex":21,"./nodes/text":22,"./nodestuff":23,"./tokens":25,"./util/fn-namer":27,"debug":30}],25:[function(require,module,exports){
// The order of these is important, as it is the order in which
// they are run against the input string.
// They are separated out here to allow for better minification
// with the least amount of effort from me. :)

// Any function instead of regex is called with the lexer as the
// context.

// NOTE: this is an array, not an object literal! The () around
// the regexps are for the sake of the syntax highlighter in my
// editor... sublimetext2

var TESTS = [

  // A real email address is considerably more complex, and unfortunately
  // this complexity makes it impossible to differentiate between an address
  // and an AT expression.
  //
  // Instead, this regex assumes the only valid characters for the user portion
  // of the address are alphanumeric, period, and %. This means that a complex email like
  // who-something@example.com will be interpreted as an email, but incompletely. `who-`
  // will be content, while `something@example.com` will be the email address.
  //
  // However, this is "Good Enough"© :).
    'EMAIL', (/^([a-zA-Z0-9.%]+@[a-zA-Z0-9.\-]+\.(?:[a-z]{2}|co\.uk|com|edu|net|org))\b/)

  , 'AT_STAR_OPEN', (/^(@\*)/)
  , 'AT_STAR_CLOSE', (/^(\*@)/)


  , 'AT_COLON', (/^(@\:)/)
  , 'AT', (/^(@)/)


  , 'PAREN_OPEN', (/^(\()/)
  , 'PAREN_CLOSE', (/^(\))/)


  , 'HARD_PAREN_OPEN', (/^(\[)/)
  , 'HARD_PAREN_CLOSE', (/^(\])/)


  , 'BRACE_OPEN', (/^(\{)/)
  , 'BRACE_CLOSE', (/^(\})/)


  , 'HTML_TAG_VOID_CLOSE', (/^(\/>)/)
  , 'HTML_TAG_CLOSE', (/^(<\/)/)
  , 'HTML_COMMENT_OPEN', (/^(<!--+)/)
  , 'HTML_COMMENT_CLOSE', (/^(--+>)/)
  , 'LT_SIGN', (/^(<)/)
  , 'GT_SIGN', (/^(>)/)

  , 'ASSIGNMENT_OPERATOR', (/^(\|=|\^=|&=|>>>=|>>=|<<=|-=|\+=|%=|\/=|\*=)\b/) // Also =
  , 'EQUALITY_OPERATOR', (/^(===|==|!==|!=)\b/)
  , 'BITWISE_SHIFT_OPERATOR', (/^(<<|>>>|>>)/)
  , 'UNARY_OPERATOR', (/^(delete\b|typeof\b|void|\+\+|--|\+|-|~|!)/)
  , 'RELATIONAL_OPERATOR', (/^(<=|>=|instanceof|in)\b/) // Also <, >
  , 'BINARY_LOGICAL_OPERATOR', (/^(&&|\|\|)\b/)
  , 'BINARY_BITWISE_OPERATOR', (/^(&|\^|\|)\b/)
  , 'NEW_OPERATOR', (/^(new)\b/)
  , 'COMMA_OPERATOR', (/^(,)/)

  , 'EQUAL_SIGN', (/^(=)/)
  , 'COLON', (/^(:)/)
  , 'PERIOD', (/^(\.)/)
  , 'NEWLINE', function(){
    var token = this.scan(/^(\n)/, exports.NEWLINE);
    if(token){
      this.lineno++;
      this.charno = 0;
    }
    return token;
  }
  , 'WHITESPACE', (/^([^\S\n]+)/) // http://stackoverflow.com/a/3469155
  , 'FUNCTION', (/^(function)(?![\d\w])/)
  , 'BLOCK_KEYWORD', (/^(catch|do|else if|else|finally|for|function|goto|if|switch|try|while|with)(?![\d\w])/)
  , 'KEYWORD', (/^(break|case|continue|instanceof|return|var)(?![\d\w])/)
  , 'IDENTIFIER', (/^([_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*)/)

  , 'DOUBLE_FORWARD_SLASH', (/^(\/\/)/)

  , 'FORWARD_SLASH', (/^(\/)/)

  , 'BACKSLASH', (/^(\\)/)
  , 'EXCLAMATION_POINT', (/^(!)/)
  , 'DOUBLE_QUOTE', (/^(\")/)
  , 'SINGLE_QUOTE', (/^(\')/)

  , 'NUMERAL', (/^([0-9])/)
  , 'CONTENT', (/^([^\s])/)

];

exports.tests = TESTS;

// Export all the tokens as constants.
for(var i = 0; i < TESTS.length; i += 2) {
  exports[TESTS[i]] = TESTS[i];
}
},{}],26:[function(require,module,exports){
module.exports = function(obj) {
  // extend works from right to left, using first arg as target
  var next, i, p;

  for(i = 1; i < arguments.length; i++){
    next = arguments[i];

    for(p in next){
      obj[p] = next[p];
    }
  }

  return obj;
}
},{}],27:[function(require,module,exports){
var lg = require('debug')('vash:fn-namer');
var reName = /^function\s+([A-Za-z0-9_]+)\s*\(/;

module.exports = function(fn) {
  if (fn.name) {
    lg('bailing, found .name %s', fn.name);
    return fn;
  }
  var fnstr = fn.toString();
  var match = reName.exec(fnstr);
  if (!match) {
    lg('bailing, could not match within %s', fnstr);
    return fn;
  }
  fn.name = match[1];
  lg('set .name as %s', fn.name);
  return fn;
}
},{"debug":30}],28:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(
      uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
    ))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],29:[function(require,module,exports){
(function (Buffer){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var customInspectSymbol =
  (typeof Symbol === 'function' && typeof Symbol.for === 'function')
    ? Symbol.for('nodejs.util.inspect.custom')
    : null

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    var proto = { foo: function () { return 42 } }
    Object.setPrototypeOf(proto, Uint8Array.prototype)
    Object.setPrototypeOf(arr, proto)
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  Object.setPrototypeOf(buf, Buffer.prototype)
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw new TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof SharedArrayBuffer !== 'undefined' &&
      (isInstance(value, SharedArrayBuffer) ||
      (value && isInstance(value.buffer, SharedArrayBuffer)))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Object.setPrototypeOf(Buffer.prototype, Uint8Array.prototype)
Object.setPrototypeOf(Buffer, Uint8Array)

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  Object.setPrototypeOf(buf, Buffer.prototype)

  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}
if (customInspectSymbol) {
  Buffer.prototype[customInspectSymbol] = Buffer.prototype.inspect
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += hexSliceLookupTable[buf[i]]
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  Object.setPrototypeOf(newBuf, Buffer.prototype)

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  } else if (typeof val === 'boolean') {
    val = Number(val)
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

// Create lookup table for `toString('hex')`
// See: https://github.com/feross/buffer/issues/219
var hexSliceLookupTable = (function () {
  var alphabet = '0123456789abcdef'
  var table = new Array(256)
  for (var i = 0; i < 16; ++i) {
    var i16 = i * 16
    for (var j = 0; j < 16; ++j) {
      table[i16 + j] = alphabet[i] + alphabet[j]
    }
  }
  return table
})()

}).call(this,require("buffer").Buffer)
},{"base64-js":28,"buffer":29,"ieee754":32}],30:[function(require,module,exports){
(function (process){
/* eslint-env browser */

/**
 * This is the web browser implementation of `debug()`.
 */

exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = localstorage();

/**
 * Colors.
 */

exports.colors = [
	'#0000CC',
	'#0000FF',
	'#0033CC',
	'#0033FF',
	'#0066CC',
	'#0066FF',
	'#0099CC',
	'#0099FF',
	'#00CC00',
	'#00CC33',
	'#00CC66',
	'#00CC99',
	'#00CCCC',
	'#00CCFF',
	'#3300CC',
	'#3300FF',
	'#3333CC',
	'#3333FF',
	'#3366CC',
	'#3366FF',
	'#3399CC',
	'#3399FF',
	'#33CC00',
	'#33CC33',
	'#33CC66',
	'#33CC99',
	'#33CCCC',
	'#33CCFF',
	'#6600CC',
	'#6600FF',
	'#6633CC',
	'#6633FF',
	'#66CC00',
	'#66CC33',
	'#9900CC',
	'#9900FF',
	'#9933CC',
	'#9933FF',
	'#99CC00',
	'#99CC33',
	'#CC0000',
	'#CC0033',
	'#CC0066',
	'#CC0099',
	'#CC00CC',
	'#CC00FF',
	'#CC3300',
	'#CC3333',
	'#CC3366',
	'#CC3399',
	'#CC33CC',
	'#CC33FF',
	'#CC6600',
	'#CC6633',
	'#CC9900',
	'#CC9933',
	'#CCCC00',
	'#CCCC33',
	'#FF0000',
	'#FF0033',
	'#FF0066',
	'#FF0099',
	'#FF00CC',
	'#FF00FF',
	'#FF3300',
	'#FF3333',
	'#FF3366',
	'#FF3399',
	'#FF33CC',
	'#FF33FF',
	'#FF6600',
	'#FF6633',
	'#FF9900',
	'#FF9933',
	'#FFCC00',
	'#FFCC33'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

// eslint-disable-next-line complexity
function useColors() {
	// NB: In an Electron preload script, document will be defined but not fully
	// initialized. Since we know we're in Chrome, we'll just detect this case
	// explicitly
	if (typeof window !== 'undefined' && window.process && (window.process.type === 'renderer' || window.process.__nwjs)) {
		return true;
	}

	// Internet Explorer and Edge do not support colors.
	if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
		return false;
	}

	// Is webkit? http://stackoverflow.com/a/16459606/376773
	// document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
	return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
		// Is firebug? http://stackoverflow.com/a/398120/376773
		(typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
		// Is firefox >= v31?
		// https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
		(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
		// Double check webkit in userAgent just in case we are in a worker
		(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
	args[0] = (this.useColors ? '%c' : '') +
		this.namespace +
		(this.useColors ? ' %c' : ' ') +
		args[0] +
		(this.useColors ? '%c ' : ' ') +
		'+' + module.exports.humanize(this.diff);

	if (!this.useColors) {
		return;
	}

	const c = 'color: ' + this.color;
	args.splice(1, 0, c, 'color: inherit');

	// The final "%c" is somewhat tricky, because there could be other
	// arguments passed either before or after the %c, so we need to
	// figure out the correct index to insert the CSS into
	let index = 0;
	let lastC = 0;
	args[0].replace(/%[a-zA-Z%]/g, match => {
		if (match === '%%') {
			return;
		}
		index++;
		if (match === '%c') {
			// We only are interested in the *last* %c
			// (the user may have provided their own)
			lastC = index;
		}
	});

	args.splice(lastC, 0, c);
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */
function log(...args) {
	// This hackery is required for IE8/9, where
	// the `console.log` function doesn't have 'apply'
	return typeof console === 'object' &&
		console.log &&
		console.log(...args);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */
function save(namespaces) {
	try {
		if (namespaces) {
			exports.storage.setItem('debug', namespaces);
		} else {
			exports.storage.removeItem('debug');
		}
	} catch (error) {
		// Swallow
		// XXX (@Qix-) should we be logging these?
	}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */
function load() {
	let r;
	try {
		r = exports.storage.getItem('debug');
	} catch (error) {
		// Swallow
		// XXX (@Qix-) should we be logging these?
	}

	// If debug isn't set in LS, and we're in Electron, try to load $DEBUG
	if (!r && typeof process !== 'undefined' && 'env' in process) {
		r = process.env.DEBUG;
	}

	return r;
}

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage() {
	try {
		// TVMLKit (Apple TV JS Runtime) does not have a window object, just localStorage in the global context
		// The Browser also has localStorage in the global context.
		return localStorage;
	} catch (error) {
		// Swallow
		// XXX (@Qix-) should we be logging these?
	}
}

module.exports = require('./common')(exports);

const {formatters} = module.exports;

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

formatters.j = function (v) {
	try {
		return JSON.stringify(v);
	} catch (error) {
		return '[UnexpectedJSONParseError]: ' + error.message;
	}
};

}).call(this,require('_process'))
},{"./common":31,"_process":34}],31:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 */

function setup(env) {
	createDebug.debug = createDebug;
	createDebug.default = createDebug;
	createDebug.coerce = coerce;
	createDebug.disable = disable;
	createDebug.enable = enable;
	createDebug.enabled = enabled;
	createDebug.humanize = require('ms');

	Object.keys(env).forEach(key => {
		createDebug[key] = env[key];
	});

	/**
	* Active `debug` instances.
	*/
	createDebug.instances = [];

	/**
	* The currently active debug mode names, and names to skip.
	*/

	createDebug.names = [];
	createDebug.skips = [];

	/**
	* Map of special "%n" handling functions, for the debug "format" argument.
	*
	* Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
	*/
	createDebug.formatters = {};

	/**
	* Selects a color for a debug namespace
	* @param {String} namespace The namespace string for the for the debug instance to be colored
	* @return {Number|String} An ANSI color code for the given namespace
	* @api private
	*/
	function selectColor(namespace) {
		let hash = 0;

		for (let i = 0; i < namespace.length; i++) {
			hash = ((hash << 5) - hash) + namespace.charCodeAt(i);
			hash |= 0; // Convert to 32bit integer
		}

		return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
	}
	createDebug.selectColor = selectColor;

	/**
	* Create a debugger with the given `namespace`.
	*
	* @param {String} namespace
	* @return {Function}
	* @api public
	*/
	function createDebug(namespace) {
		let prevTime;

		function debug(...args) {
			// Disabled?
			if (!debug.enabled) {
				return;
			}

			const self = debug;

			// Set `diff` timestamp
			const curr = Number(new Date());
			const ms = curr - (prevTime || curr);
			self.diff = ms;
			self.prev = prevTime;
			self.curr = curr;
			prevTime = curr;

			args[0] = createDebug.coerce(args[0]);

			if (typeof args[0] !== 'string') {
				// Anything else let's inspect with %O
				args.unshift('%O');
			}

			// Apply any `formatters` transformations
			let index = 0;
			args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
				// If we encounter an escaped % then don't increase the array index
				if (match === '%%') {
					return match;
				}
				index++;
				const formatter = createDebug.formatters[format];
				if (typeof formatter === 'function') {
					const val = args[index];
					match = formatter.call(self, val);

					// Now we need to remove `args[index]` since it's inlined in the `format`
					args.splice(index, 1);
					index--;
				}
				return match;
			});

			// Apply env-specific formatting (colors, etc.)
			createDebug.formatArgs.call(self, args);

			const logFn = self.log || createDebug.log;
			logFn.apply(self, args);
		}

		debug.namespace = namespace;
		debug.enabled = createDebug.enabled(namespace);
		debug.useColors = createDebug.useColors();
		debug.color = selectColor(namespace);
		debug.destroy = destroy;
		debug.extend = extend;
		// Debug.formatArgs = formatArgs;
		// debug.rawLog = rawLog;

		// env-specific initialization logic for debug instances
		if (typeof createDebug.init === 'function') {
			createDebug.init(debug);
		}

		createDebug.instances.push(debug);

		return debug;
	}

	function destroy() {
		const index = createDebug.instances.indexOf(this);
		if (index !== -1) {
			createDebug.instances.splice(index, 1);
			return true;
		}
		return false;
	}

	function extend(namespace, delimiter) {
		const newDebug = createDebug(this.namespace + (typeof delimiter === 'undefined' ? ':' : delimiter) + namespace);
		newDebug.log = this.log;
		return newDebug;
	}

	/**
	* Enables a debug mode by namespaces. This can include modes
	* separated by a colon and wildcards.
	*
	* @param {String} namespaces
	* @api public
	*/
	function enable(namespaces) {
		createDebug.save(namespaces);

		createDebug.names = [];
		createDebug.skips = [];

		let i;
		const split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
		const len = split.length;

		for (i = 0; i < len; i++) {
			if (!split[i]) {
				// ignore empty strings
				continue;
			}

			namespaces = split[i].replace(/\*/g, '.*?');

			if (namespaces[0] === '-') {
				createDebug.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
			} else {
				createDebug.names.push(new RegExp('^' + namespaces + '$'));
			}
		}

		for (i = 0; i < createDebug.instances.length; i++) {
			const instance = createDebug.instances[i];
			instance.enabled = createDebug.enabled(instance.namespace);
		}
	}

	/**
	* Disable debug output.
	*
	* @return {String} namespaces
	* @api public
	*/
	function disable() {
		const namespaces = [
			...createDebug.names.map(toNamespace),
			...createDebug.skips.map(toNamespace).map(namespace => '-' + namespace)
		].join(',');
		createDebug.enable('');
		return namespaces;
	}

	/**
	* Returns true if the given mode name is enabled, false otherwise.
	*
	* @param {String} name
	* @return {Boolean}
	* @api public
	*/
	function enabled(name) {
		if (name[name.length - 1] === '*') {
			return true;
		}

		let i;
		let len;

		for (i = 0, len = createDebug.skips.length; i < len; i++) {
			if (createDebug.skips[i].test(name)) {
				return false;
			}
		}

		for (i = 0, len = createDebug.names.length; i < len; i++) {
			if (createDebug.names[i].test(name)) {
				return true;
			}
		}

		return false;
	}

	/**
	* Convert regexp to namespace
	*
	* @param {RegExp} regxep
	* @return {String} namespace
	* @api private
	*/
	function toNamespace(regexp) {
		return regexp.toString()
			.substring(2, regexp.toString().length - 2)
			.replace(/\.\*\?$/, '*');
	}

	/**
	* Coerce `val`.
	*
	* @param {Mixed} val
	* @return {Mixed}
	* @api private
	*/
	function coerce(val) {
		if (val instanceof Error) {
			return val.stack || val.message;
		}
		return val;
	}

	createDebug.enable(createDebug.load());

	return createDebug;
}

module.exports = setup;

},{"ms":33}],32:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],33:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var w = d * 7;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse(val);
  } else if (type === 'number' && isFinite(val)) {
    return options.long ? fmtLong(val) : fmtShort(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'weeks':
    case 'week':
    case 'w':
      return n * w;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
    default:
      return undefined;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort(ms) {
  var msAbs = Math.abs(ms);
  if (msAbs >= d) {
    return Math.round(ms / d) + 'd';
  }
  if (msAbs >= h) {
    return Math.round(ms / h) + 'h';
  }
  if (msAbs >= m) {
    return Math.round(ms / m) + 'm';
  }
  if (msAbs >= s) {
    return Math.round(ms / s) + 's';
  }
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong(ms) {
  var msAbs = Math.abs(ms);
  if (msAbs >= d) {
    return plural(ms, msAbs, d, 'day');
  }
  if (msAbs >= h) {
    return plural(ms, msAbs, h, 'hour');
  }
  if (msAbs >= m) {
    return plural(ms, msAbs, m, 'minute');
  }
  if (msAbs >= s) {
    return plural(ms, msAbs, s, 'second');
  }
  return ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, msAbs, n, name) {
  var isPlural = msAbs >= n * 1.5;
  return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
}

},{}],34:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],35:[function(require,module,exports){
module.exports={
  "name": "vash",
  "description": "Razor syntax for JS templating",
  "version": "0.13.0",
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
    "node": ">= 0.10"
  },
  "scripts": {
    "prepublishOnly": "npm run test && npm run build",
    "coverage": "VASHPATH=../../index.js VASHRUNTIMEPATH=../../runtime.js browserify -t envify -t coverify test/vows/vash.test.js | node | coverify",
    "build": "browserify index.js --standalone vash > build/vash.js && browserify --standalone vash runtime.js > build/vash-runtime.js && browserify --standalone vash --external fs --external path lib/helpers/index.js > build/vash-runtime-all.js",
    "test": "VASHPATH=../../index.js VASHRUNTIMEPATH=../../runtime.js vows test/vows/vash.*.js --spec",
    "docs": "scripts/docs.sh",
    "docs-dev": "scripts/docs-dev.sh"
  },
  "dependencies": {
    "commander": "^5.0.0",
    "debug": "^4.1.1",
    "uglify-js": "^3.8.0"
  },
  "devDependencies": {
    "browserify": "^16.5.0",
    "coverify": "^1.5.1",
    "envify": "^4.1.0",
    "marked": "^0.8.0",
    "vows": "^0.8.3"
  }
}

},{}],36:[function(require,module,exports){
(function (Buffer){

var error = require('./lib/error');
var runtime = {
  version: require('./package.json').version
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

}).call(this,require("buffer").Buffer)
},{"./lib/error":3,"./package.json":35,"buffer":29}]},{},[6])(6)
});
