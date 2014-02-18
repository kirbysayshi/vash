
var debug = require('debug');

var tks = require('./lexer');

var ProgramNode = require('./nodes/program');
var TextNode = require('./nodes/text');
var MarkupNode = require('./nodes/markup');
var MarkupAttributeNode = require('./nodes/markupattribute');
var ExpressionNode = require('./nodes/expression');
var ExplicitExpressionNode = require('./nodes/explicitexpression');
var LocationNode = require('./nodes/location');
var BlockNode = require('./nodes/block');

function Parser() {
  this.lg = debug('vash:parser');
  this.tokens = [];
  this.deferredTokens = [];
  this.node = null;
  this.stack = [];
}

module.exports = Parser;

Parser.prototype.write = function(tokens) {
  if (!Array.isArray(tokens)) tokens = [tokens];
  this.tokens.unshift.apply(this.tokens, tokens.reverse());
}

Parser.prototype.read = function() {
  if (!this.tokens.length) return false;

  if (!this.node) {
    this.openNode(new ProgramNode());
  }

  var curr = this.deferredTokens.pop() || this.tokens.pop();
  var next = this.deferredTokens.pop() || this.tokens.pop();

  var dispatch = 'continue' + this.node.constructor.name;

  this.lg('Read: %s', dispatch);
  this.lg('curr %s', curr);
  this.lg('next %s', next);

  var consumed = this[dispatch](this.node, curr, next);

  this.deferredTokens.push(next);

  if (!consumed) {
    this.lg('Deferring curr %s', curr);
    this.deferredTokens.push(curr);
  }
}

Parser.prototype.openNode = function(node) {
  this.stack.push(node);
  this.lg('Opened node %s from %s',
    node.type, (this.node ? this.node.type : null));
  this.node = node;

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

  // Program is always root.
  if (last.type === 'VashProgram') {
    this.stack.push(last);
  }

  this.lg('Closing node %s, returning to node %s',
    node.type, last.type)

  this.node = last;
}


Parser.prototype.continueProgramNode = function(node, curr, next) {

  var valueNode = node.body[node.body.length-1];

  if (curr.type === tks.AT && next.type === tks.PAREN_OPEN) {
    valueNode = new ExplicitExpressionNode();
    this.openNode(valueNode);
    node.body.push(valueNode);
    return false;
  }

  if (curr.type === tks.HTML_TAG_OPEN) {
    valueNode = new MarkupNode();
    this.openNode(valueNode);
    node.body.push(valueNode);
    return false;
  }

  // Default

  if (!valueNode || valueNode.type !== 'VashText') {
    valueNode = new TextNode();
    node.body.push(valueNode);
    updateLoc(valueNode, curr);
  }

  appendTextValue(valueNode, curr);
  updateLoc(valueNode, curr);

  return true;
}

Parser.prototype.continueMarkupNode = function(node, curr, next) {
  var valueNode = node.values[node.values.length-1];
  var tagName;

  if (!node.name) {

    tagName = extractTagName(curr);
    node.name = tagName;
    updateLoc(node, curr);

    if (
      tagName
      && tagName[0] === '@'
      && curr.type === tks.HTML_TAG_OPEN
    ) {
      // We have a <@expression ...>
      valueNode = new ExpressionNode();
      node.expression = valueNode;
      this.openNode(valueNode);
      updateLoc(valueNode, curr);

      // HACK.
      var hack = new TextNode();
      hack.value += tagName.substring(1);
      valueNode.values.push(hack);
    }

    return true;
  }

  if (curr.type === tks.GT_SIGN) {
    node._finishedOpen = true;
    return true;
  }

  if (
    curr.type === tks.HTML_TAG_VOID_CLOSE
    || curr.type === tks.HTML_TAG_CLOSE
  ) {
    this.closeNode(node);
    updateLoc(node, curr);
    return true;
  }

  if (
    curr.type === tks.WHITESPACE
    && !node._finishedOpen
    && next.type !== tks.HTML_TAG_VOID_CLOSE
  ) {
    // enter attribute
    valueNode = new MarkupAttributeNode();
    this.openNode(valueNode);
    node.attributes.push(valueNode);
    return true;
  }

  // @something
  if (curr.type === tks.AT && node._finishedOpen) {
    valueNode = new ExpressionNode();
    updateLoc(valueNode, curr);
    this.openNode(valueNode);
    node.values.push(valueNode);
    return true;
  }

  // Default

  if (!valueNode || valueNode.type !== 'VashText') {
    valueNode = new TextNode();
    updateLoc(valueNode, curr);
    node.values.push(valueNode);
  }

  appendTextValue(valueNode, curr);
  updateLoc(valueNode, curr);
  return true;
}

Parser.prototype.continueMarkupAttributeNode = function(node, curr, next) {

  var valueNode;

  if (curr.type === tks.AT) {
    // To expression

    valueNode = new ExpressionNode();

    if (!node._finishedLeft) {
      node.left.push(valueNode);
    } else {
      node.right.push(valueNode);
    }

    updateLoc(valueNode, curr);
    this.openNode(valueNode);
    return true;
  }

  // End of left, value only
  if (curr.type === tks.WHITESPACE && !node._expectRight) {
    node._finishedLeft = true;
    updateLoc(node, curr);
    this.closeNode(node);
    return false; // defer
  }

  // End of left.
  if (curr.type === tks.EQUAL_SIGN) {
    node._finishedLeft = true;
    node._expectRight = true;
    return true;
  }

  // Beginning of quoted value.
  if (
    node._expectRight
    && !node.rightIsQuoted
    && (curr.type === tks.DOUBLE_QUOTE
    || curr.type === tks.SINGLE_QUOTE)
  ) {
    node.rightIsQuoted = curr.val;
    return true;
  }

  // End of quoted value.
  if (node.rightIsQuoted === curr.val) {
    updateLoc(node, curr);
    this.closeNode(node);
    return true;
  }

  // Default

  var leftValueNode = node.left[node.left.length-1];
  var rightValueNode = node.right[node.right.length-1];

  if (!node._finishedLeft) {
    if (!leftValueNode || leftValueNode.type !== 'VashText') {
      leftValueNode = new TextNode();
      node.left.push(leftValueNode);
    }

    valueNode = leftValueNode;
  } else {
    if (!rightValueNode || rightValueNode.type !== 'VashText') {
      rightValueNode = new TextNode();
      node.right.push(rightValueNode);
    }

    valueNode = rightValueNode;
  }

  appendTextValue(valueNode, curr);
  updateLoc(valueNode, curr);

  return true;
}

Parser.prototype.continueExpressionNode = function(node, curr, next) {
  var valueNode = node.values[node.values.length-1];

  if (curr.type === tks.PAREN_OPEN) {
    valueNode = new ExplicitExpressionNode();
    this.openNode(valueNode);
    node.values.push(valueNode);
    return false;
  }

  if (curr.type === tks.HARD_PAREN_OPEN) {
    valueNode = new IndexExpressionNode();
    node.values.push(valueNode);
    this.openNode(valueNode);
    return false;
  }

  // Default
  // Consume only specific cases, otherwise close.

  if (
    curr.type === tks.IDENTIFIER
    || (curr.type === tks.PERIOD && next.type === tks.IDENTIFIER)
  ) {
    if (!valueNode) {
      valueNode = new TextNode();
      node.values.push(valueNode);
      updateLoc(valueNode, curr);
    }

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
    curr.type === tks.AT && node.values.length === 0
    ||
    curr.type === tks.PAREN_OPEN && node.values.length === 0
  ) {
    // This is the beginning of the explicit (mark as consumed)
    updateLoc(node, curr);
    return true;
  }

  if (curr.type === tks.PAREN_OPEN && !node._waitingForEndQuote) {
    // New explicit expression
    valueNode = new ExplicitExpressionNode();
    node.values.push(valueNode);
    updateLoc(valueNode, curr);
    this.openNode(valueNode);
    // And do nothing with the token (mark as consumed)
    return true;
  }

  if (curr.type === tks.PAREN_CLOSE && !node._waitingForEndQuote) {
    // Close current explicit expression
    updateLoc(node, curr);
    this.closeNode(node);
    // And do nothing with the token (mark as consumed)
    return true;
  }

  if (curr.type === tks.FUNCTION && !node._waitingForEndQuote) {
    valueNode = new BlockNode();
    node.values.push(valueNode);
    updateLoc(valueNode, curr);
    this.openNode(valueNode);
    return false;
  }

  if (curr.val === node._waitingForEndQuote) {
    node._waitingForEndQuote = null;
    valueNode += curr.val;
    updateLoc(valueNode, curr);
    return true;
  }

  // Default
  if (!valueNode || valueNode.type !== 'VashText') {
    valueNode = new TextNode();
    node.values.push(valueNode);
  }

  appendTextValue(valueNode, curr);
  updateLoc(valueNode, curr);
  return true;
}

Parser.prototype.continueBlockNode = function(node, curr, next) {

  var valueNode = node.values[node.values.length-1];

  if (
    curr.type === tks.BRACE_OPEN
    && !node._reachedOpenBrace
    && !node._waitingForEndQuote
    && !node._withinCommentLine
  ) {
    node._reachedOpenBrace = true;
    return true;
  }

  if (curr.type === tks.BRACE_OPEN) {
    valueNode = new BlockNode();
    updateLoc(valueNode, curr);
    node.values.push(valueNode);
    return false;
  }

  if (
    curr.type === tks.BRACE_CLOSE
    && !node._reachedCloseBrace
    && !node._waitingForEndQuote
    && !node._withinCommentLine
  ) {
    updateLoc(node, curr);
    this.closeNode(node);
    return true;
  }

  if (
    curr.type === tks.HTML_TAG_OPEN
    && !node._waitingForEndQuote
    && !node._withinCommentLine
  ) {
    valueNode = new MarkupNode();
    updateLoc(valueNode, curr);
    node.values.push(valueNode);
    this.openNode(valueNode);
    return false;
  }

  // Default

  var attachmentPoint;

  if (node._reachedOpenBrace && node._reachedCloseBrace) {
    attachmentPoint = node.tail;
  } else if (!node._reachedOpenBrace) {
    attachmentPoint = node.head;
  } else {
    attachmentPoint = node.values;
  }

  valueNode = attachmentPoint[attachmentPoint.length-1];

  if (!valueNode || valueNode.type !== 'VashText') {
    valueNode = new TextNode();
    attachmentPoint.push(valueNode);
    updateLoc(valueNode, curr);
  }

  appendTextValue(valueNode, curr);
  return true;
}

function updateLoc(node, token) {
  var loc;
  loc = new LocationNode();
  loc.line = token.line;
  loc.column = token.chr;

  if (!node.startloc) {
    node.startloc = loc;
  }

  node.endloc = loc;
}

function extractTagName(token) {
  var match = token.val.match(/^<(\s*@?[a-zA-Z]+)/);
  if (!match) {
    var msg = 'Attempted to extract tag name from '
      + token + ' but failed';
    throw new Error(msg);
  }

  return match[1].trim();
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