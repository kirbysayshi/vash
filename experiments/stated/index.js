var Lexer = require('./lexer');
var Parser = require('./parser');
var codegen = require('./codegen');
var runtime = require('./runtime');

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

exports.compileStream = function() {
  // This could eventually handle waiting until a `null`
  // is pushed into the lexer, etc.
  throw new Error('NotImplemented');
}

exports.compile = function(markup, options) {

  if(markup === '' || typeof markup !== 'string') {
    throw new Error('Empty or non-string cannot be compiled');
  }

  options = options || {};

  var opts = {};
  Object.keys(exports.config).forEach(function(prop) {
    opts[prop] = options[prop] || exports.config[prop];
  });

  var l = new Lexer();

  l.write(markup);
  var tokens = l.read();

  var p = new Parser();
  p.write(tokens);
  var more = true;
  while(more !== null) more = p.read();

  // Stash the original input (new lines normalized by the lexer).
  opts.source = l.originalInput;

  p.lg(p.dumpAST());

  var compiled = codegen(p.stack[0], opts);
  var tpl = runtime.link(compiled, opts);

  return tpl;
}