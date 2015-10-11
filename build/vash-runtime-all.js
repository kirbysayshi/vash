!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.vash=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
var debug = _dereq_('debug')
var lg = debug('vash:main');

var Lexer = _dereq_('./lib/lexer');
var Parser = _dereq_('./lib/parser');
var codegen = _dereq_('./lib/codegen');
var runtime = _dereq_('./runtime');
var helperbatch = _dereq_('./lib/helperbatch');
var copyrtl = _dereq_('./lib/util/copyrtl');

// Attach all runtime exports to enable backwards compatible behavior,
// like `vash.install` to still be accessible in a full build.
_dereq_('./lib/helpers');
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

exports.version = _dereq_('./package.json').version;

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
},{"./lib/codegen":2,"./lib/helperbatch":4,"./lib/helpers":6,"./lib/lexer":9,"./lib/parser":24,"./lib/util/copyrtl":26,"./package.json":29,"./runtime":30,"debug":28}],2:[function(_dereq_,module,exports){

var debug = _dereq_('debug');
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
    + dbgstart(node, opts)
    + tagOpen
    + values
    + tagClose
    + dbgend(node, opts)
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
},{"debug":28}],3:[function(_dereq_,module,exports){

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
},{}],4:[function(_dereq_,module,exports){

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

},{}],5:[function(_dereq_,module,exports){
var helpers = _dereq_('../../runtime').helpers;

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
},{"../../runtime":30}],6:[function(_dereq_,module,exports){
_dereq_('./trim');
_dereq_('./highlight');
_dereq_('./layout');
module.exports = _dereq_('../../runtime');
},{"../../runtime":30,"./highlight":5,"./layout":7,"./trim":8}],7:[function(_dereq_,module,exports){
var helpers = _dereq_('../../runtime').helpers;
var copyrtl = _dereq_('../util/copyrtl');

// For now, using the layout helpers requires a full build. For now.
var vash = _dereq_('../../index');
module.exports = vash;

///////////////////////////////////////////////////////////////////////////
// LAYOUT HELPERS

// semi hacky guard to prevent non-nodejs erroring
if( typeof window === 'undefined' ){
  var  fs = _dereq_('fs')
    ,path = _dereq_('path')
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

},{"../../index":1,"../../runtime":30,"../util/copyrtl":26,"fs":"liyfGr","path":"TJ6g6r"}],8:[function(_dereq_,module,exports){
var helpers = _dereq_('../../runtime').helpers;

// Trim whitespace from the start and end of a string
helpers.trim = function(val){
  return val.replace(/^\s*|\s*$/g, '');
}
},{"../../runtime":30}],9:[function(_dereq_,module,exports){
var debug = _dereq_('debug');
var tokens = _dereq_('./tokens');

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

},{"./tokens":25,"debug":28}],10:[function(_dereq_,module,exports){
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
},{}],11:[function(_dereq_,module,exports){
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
},{}],12:[function(_dereq_,module,exports){
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
},{}],13:[function(_dereq_,module,exports){
var Node = module.exports = function ExpressionNode() {
  this.type = 'VashExpression';
  this.values = [];
  this.startloc = null;
  this.endloc = null;
}
},{}],14:[function(_dereq_,module,exports){
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
},{}],15:[function(_dereq_,module,exports){
module.exports = function LocationNode() {
  this.line = 1;
  this.column = 0;
}
},{}],16:[function(_dereq_,module,exports){
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
},{}],17:[function(_dereq_,module,exports){
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
},{}],18:[function(_dereq_,module,exports){
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
},{}],19:[function(_dereq_,module,exports){
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
},{}],20:[function(_dereq_,module,exports){
module.exports = function ProgramNode() {
  this.type = 'VashProgram';
  this.body = [];
}
},{}],21:[function(_dereq_,module,exports){

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
},{}],22:[function(_dereq_,module,exports){
module.exports = function TextNode() {
  this.type = 'VashText';
  this.value = '';
  this.startloc = null;
  this.endloc = null;
}
},{}],23:[function(_dereq_,module,exports){
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

},{}],24:[function(_dereq_,module,exports){

var debug = _dereq_('debug');

var tks = _dereq_('./tokens');
var nodestuff = _dereq_('./nodestuff');
var error = _dereq_('./error');
var namer = _dereq_('./util/fn-namer');

var ProgramNode = namer(_dereq_('./nodes/program'));
var TextNode = namer(_dereq_('./nodes/text'));
var MarkupNode = namer(_dereq_('./nodes/markup'));
var MarkupCommentNode = namer(_dereq_('./nodes/markupcomment'));
var MarkupContentNode = namer(_dereq_('./nodes/markupcontent'));
var MarkupAttributeNode = namer(_dereq_('./nodes/markupattribute'));
var ExpressionNode = namer(_dereq_('./nodes/expression'));
var ExplicitExpressionNode = namer(_dereq_('./nodes/explicitexpression'));
var IndexExpressionNode = namer(_dereq_('./nodes/indexexpression'));
var LocationNode = namer(_dereq_('./nodes/location'));
var BlockNode = namer(_dereq_('./nodes/block'));
var CommentNode = namer(_dereq_('./nodes/comment'));
var RegexNode = namer(_dereq_('./nodes/regex'));

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
      (next.type === tks.IDENTIFIER
        && ahead
        && (
          ahead.type === tks.GT_SIGN
          || ahead.type === tks.WHITESPACE
          || ahead.type === tks.NEWLINE
          || ahead.type === tks.AT
          || ahead.type === tks.UNARY_OPERATOR
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

  var pnw = this.previousNonWhitespace;

  if (
    curr.type === tks.FORWARD_SLASH
    && !node._waitingForEndQuote
    && pnw
    && pnw.type !== tks.IDENTIFIER
    && pnw.type !== tks.NUMERAL
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
    curr.type === tks.AT
    && (next.type === tks.BLOCK_KEYWORD
      || next.type === tks.BRACE_OPEN
      || next.type === tks.FUNCTION)
  ) {
    // Backwards compatibility, allowing for @for() { @for() { @{ } } }
    valueNode = this.openNode(new BlockNode(), node.values);
    updateLoc(valueNode, curr);
    // TODO: shouldn't this need a more accurate target (tail, values, head)?
    return true;
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

  if (curr.val === node._waitingForEndQuote) {
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


},{"./error":3,"./nodes/block":10,"./nodes/comment":11,"./nodes/explicitexpression":12,"./nodes/expression":13,"./nodes/indexexpression":14,"./nodes/location":15,"./nodes/markup":16,"./nodes/markupattribute":17,"./nodes/markupcomment":18,"./nodes/markupcontent":19,"./nodes/program":20,"./nodes/regex":21,"./nodes/text":22,"./nodestuff":23,"./tokens":25,"./util/fn-namer":27,"debug":28}],25:[function(_dereq_,module,exports){
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
  , 'PERIOD', (/^(\.)/)
  , 'NEWLINE', function(){
    var token = this.scan(/^(\n)/, exports.NEWLINE);
    if(token){
      this.lineno++;
      this.charno = 0;
    }
    return token;
  }
  , 'WHITESPACE', (/^(\s+)/)
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
},{}],26:[function(_dereq_,module,exports){
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
},{}],27:[function(_dereq_,module,exports){
var lg = _dereq_('debug')('vash:fn-namer');
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
},{"debug":28}],28:[function(_dereq_,module,exports){

/**
 * Expose `debug()` as the module.
 */

module.exports = debug;

/**
 * Create a debugger with the given `name`.
 *
 * @param {String} name
 * @return {Type}
 * @api public
 */

function debug(name) {
  if (!debug.enabled(name)) return function(){};

  return function(fmt){
    fmt = coerce(fmt);

    var curr = new Date;
    var ms = curr - (debug[name] || curr);
    debug[name] = curr;

    fmt = name
      + ' '
      + fmt
      + ' +' + debug.humanize(ms);

    // This hackery is required for IE8
    // where `console.log` doesn't have 'apply'
    window.console
      && console.log
      && Function.prototype.apply.call(console.log, console, arguments);
  }
}

/**
 * The currently active debug mode names.
 */

debug.names = [];
debug.skips = [];

/**
 * Enables a debug mode by name. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} name
 * @api public
 */

debug.enable = function(name) {
  try {
    localStorage.debug = name;
  } catch(e){}

  var split = (name || '').split(/[\s,]+/)
    , len = split.length;

  for (var i = 0; i < len; i++) {
    name = split[i].replace('*', '.*?');
    if (name[0] === '-') {
      debug.skips.push(new RegExp('^' + name.substr(1) + '$'));
    }
    else {
      debug.names.push(new RegExp('^' + name + '$'));
    }
  }
};

/**
 * Disable debug output.
 *
 * @api public
 */

debug.disable = function(){
  debug.enable('');
};

/**
 * Humanize the given `ms`.
 *
 * @param {Number} m
 * @return {String}
 * @api private
 */

debug.humanize = function(ms) {
  var sec = 1000
    , min = 60 * 1000
    , hour = 60 * min;

  if (ms >= hour) return (ms / hour).toFixed(1) + 'h';
  if (ms >= min) return (ms / min).toFixed(1) + 'm';
  if (ms >= sec) return (ms / sec | 0) + 's';
  return ms + 'ms';
};

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

debug.enabled = function(name) {
  for (var i = 0, len = debug.skips.length; i < len; i++) {
    if (debug.skips[i].test(name)) {
      return false;
    }
  }
  for (var i = 0, len = debug.names.length; i < len; i++) {
    if (debug.names[i].test(name)) {
      return true;
    }
  }
  return false;
};

/**
 * Coerce `val`.
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

// persist

try {
  if (window.localStorage) debug.enable(localStorage.debug);
} catch(e){}

},{}],29:[function(_dereq_,module,exports){
module.exports={
  "name": "vash",
  "description": "Razor syntax for JS templating",
  "version": "0.10.0",
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
    "prepublish": "npm run test && npm run build",
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

},{}],30:[function(_dereq_,module,exports){

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

},{"./lib/error":3,"./package.json":29}]},{},[6])
(6)
});