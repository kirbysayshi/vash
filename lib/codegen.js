
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
