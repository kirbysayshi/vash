
var debug = require('debug');
var lg = debug('vash:codegen');

var gens = {}

gens.VashProgram = function(node, opts, generate) {
  return node.body.map(generate).join('');
}

gens.VashExplicitExpression = function(node, opts, generate) {
  var str = node.values.map(generate).join('');
  return '(' + maybeHTMLEscape(node, opts, str) + ')';
}

gens.VashExpression = function(node, opts, generate) {
  var str = node.values.map(generate).join('');
  if (parentIsContent(node)) {
    str = bewrap(maybeHTMLEscape(node, opts, str));
  }
  return str;
}

gens.VashMarkup = function(node, opts, generate) {
  var name = node.expression
    ? node.expression.values.map(generate).join('')
    : bcwrap(node.name);
  return ''
    + bcwrap('<')
    + name
    + bcwrap(node.attributes.length ? ' ' : '')
    + node.attributes.map(generate).join(' ')
    + (node.isVoid
      ? bcwrap(node.voidClosed ? ' />' : '>')
      : bcwrap('>')
        + node.values.map(generate).join('')
        + bcwrap('</')
        + name
        + bcwrap('>'))
}

gens.VashMarkupAttribute = function(node, opts, generate) {
  var quote = node.rightIsQuoted
    ? node.rightIsQuoted
    : '';
  quote = escapeMarkupContent(quote);
  return node.left.map(generate).join('')
    + (node.right.length
      ?   bcwrap('=' + quote)
        + node.right.map(generate).join('')
        + bcwrap(quote)
      : '');
}

gens.VashBlock = function(node, opts, generate) {
  return node.head.map(generate).join('')
    + '{'
    + node.values.map(generate).join('')
    + '}'
    + node.tail.map(generate).join('');
}

gens.VashIndexExpression = function(node, opts, generate) {
  var str = node.values.map(generate).join('');
  return '[' + str + ']';
}

gens.VashText = function(node, opts, generate) {
  return parentIsContent(node)
    ? bcwrap(escapeMarkupContent(node.value))
    : node.value;
}

function escapeMarkupContent(str) {
  return str
    .replace(/(')/, '\\$1')
    .replace(/\n/g, '\\n');
}

var BUFFER_HEAD = '\n__vbuffer.push(';
var BUFFER_TAIL = ');\n';

// buffer content wrap
function bcwrap(str) {
  return BUFFER_HEAD + '\'' + str + '\'' + BUFFER_TAIL;
}

// buffer expression wrap
function bewrap(str) {
  return BUFFER_HEAD + str + BUFFER_TAIL;
}

function parentIsContent(node) {
  return node.parent.type === 'VashMarkup'
    || node.parent.type === 'VashMarkupAttribute'
    || node.parent.type === 'VashProgram';
}

function maybeHTMLEscape(node, opts, str) {
  if (parentIsContent(node) && opts.htmlEscape) {
    return opts.helpersName + '.escape(' + str + ').toHtmlString()';
  } else {
    return str;
  }
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
      return gen(opts, child);
    }
  }

  return condenseContent(gen(opts, node));
}

module.exports = generate;