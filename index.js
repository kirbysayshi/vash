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