
var debug = require('debug');

var tks = require('./tokens');
var nodestuff = require('./nodestuff');

var ProgramNode = require('./nodes/program');
var TextNode = require('./nodes/text');
var MarkupNode = require('./nodes/markup');
var MarkupContentNode = require('./nodes/markupcontent');
var MarkupAttributeNode = require('./nodes/markupattribute');
var ExpressionNode = require('./nodes/expression');
var ExplicitExpressionNode = require('./nodes/explicitexpression');
var IndexExpressionNode = require('./nodes/indexexpression');
var LocationNode = require('./nodes/location');
var BlockNode = require('./nodes/block');
var CommentNode = require('./nodes/comment');

function Parser() {
  this.lg = debug('vash:parser');
  this.tokens = [];
  this.deferredTokens = [];
  this.node = null;
  this.stack = [];
  this.previousWasEscape = false;
}

module.exports = Parser;

Parser.prototype.write = function(tokens) {
  if (!Array.isArray(tokens)) tokens = [tokens];
  this.tokens.unshift.apply(this.tokens, tokens.reverse());
}

Parser.prototype.read = function() {
  if (!this.tokens.length && !this.deferredTokens.length) return null;

  if (!this.node) {
    this.openNode(new ProgramNode());
  }

  var curr = this.deferredTokens.pop() || this.tokens.pop();
  var next = this.deferredTokens.pop() || this.tokens.pop();

  var dispatch = 'continue' + this.node.constructor.name;

  this.lg('Read: %s', dispatch);
  this.lg('  curr %s', curr);
  this.lg('  next %s', next);

  if (this.previousWasEscape) {
    this.lg('  Previous token was an escaping backslash');
  }

  var consumed = this[dispatch](this.node, curr, next, this.previousWasEscape);

  if (next) {
    // Next may be undefined when about to run out of tokens.
    this.deferredTokens.push(next);
  }

  if (!consumed) {
    this.lg('Deferring curr %s', curr);
    this.deferredTokens.push(curr);
  } else {

    if (!this.previousWasEscape && curr.type === tks.BACKSLASH) {
      this.previousWasEscape = true;
    } else {
      this.previousWasEscape = false;
    }

  }
}

Parser.prototype.checkStack = function() {
  // Throw if something is unclosed that should be.
  var i = this.stack.length-1;
  var node;
  var msg;
  while(i >= 1) {
    node = this.stack[i];
    if (node.endOk && !node.endOk()) {
      msg = 'Found unclosed ' + node.type + ' starting at line '
        + node.startloc.line + ', column ' + node.startloc.column + '.\n\n'
        + 'Node: ' + JSON.stringify(node, null, '  ');
      throw new Error(msg);
    }
    i--;
  }
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


Parser.prototype.continueProgramNode = function(node, curr, next) {

  var valueNode = node.body[node.body.length-1];

  if (curr.type === tks.AT && next.type === tks.PAREN_OPEN) {
    this.openNode(new ExplicitExpressionNode(), node.body);
    return false;
  }

  if (
    curr.type === tks.AT
    && (next.type === tks.BLOCK_KEYWORD
      || next.type === tks.BRACE_OPEN
      || next.type === tks.FUNCTION)
  ) {
    valueNode = this.openNode(new BlockNode(), node.body);
    updateLoc(valueNode, curr);
    return true;
  }

  if (curr.type === tks.AT) {
    valueNode = this.openNode(new ExpressionNode(), node.body);
    updateLoc(valueNode, curr);
    return true;
  }

  if (curr.type === tks.LT_SIGN) {
    this.openNode(new MarkupNode(), node.body);
    return false;
  }

  // Special case for ProgramNode:
  // allow for keywords to not need to be prefixed with @,
  // like `catch (e) {}`.
  if (curr.type === tks.KEYWORD) {
    this.openNode(new BlockNode(), node.body);
    return false;
  }

  if (curr.type === tks.AT_STAR_OPEN) {
    this.openNode(new CommentNode(), node.body);
    return false;
  }

  // Default

  valueNode = ensureTextNode(node.body);
  appendTextValue(valueNode, curr);
  updateLoc(node, curr);
  return true;
}

Parser.prototype.continueCommentNode = function(node, curr, next) {
  var valueNode = ensureTextNode(node.values);

  if (curr.type === tks.AT_STAR_OPEN && !node._waitingForClose) {
    node._waitingForClose = true;
    updateLoc(node, curr);
    return true;
  }

  if (curr.type === tks.AT_STAR_CLOSE && node._waitingForClose) {
    node._waitingForClose = null;
    updateLoc(node, curr);
    this.closeNode(node);
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
    && curr.type !== tks.HTML_TAG_VOID_CLOSE
  ) {

    // Assume tag name

    if (curr.type === tks.AT) {
      node.expression = this.openNode(new ExpressionNode());
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
    node._finishedOpen = true;

    if (MarkupNode.isVoid(node.name)) {
      node.isVoid = true;
      this.closeNode(node);
      updateLoc(node, curr);
    } else {
      valueNode = this.openNode(new MarkupContentNode(), node.values);
      updateLoc(valueNode, curr);
    }

    return true;
  }

  if (curr.type === tks.GT_SIGN && node._waitingForFinishedClose) {
    node._waitingForFinishedClose = false;
    this.closeNode(node);
    updateLoc(node, curr);
    return true;
  }

  // </
  if (curr.type === tks.HTML_TAG_CLOSE) {
    node._waitingForFinishedClose = true;
    return true;
  }

  if (curr.type === tks.HTML_TAG_VOID_CLOSE) {
    this.closeNode(node);
    node.isVoid = true;
    node.voidClosed = true;
    updateLoc(node, curr);
    return true;
  }

  if (node._waitingForFinishedClose) {
    this.lg('Ignoring %s while waiting for closing GT_SIGN',
      curr);
    return true;
  }

  if (
    curr.type === tks.WHITESPACE
    && !node._finishedOpen
    && next.type !== tks.HTML_TAG_VOID_CLOSE
  ) {
    // enter attribute
    valueNode = this.openNode(new MarkupAttributeNode(), node.attributes);
    updateLoc(valueNode, curr);
    return true;
  }

  // Whitespace between attributes should be ignored.
  if (
    curr.type === tks.WHITESPACE
    && !node._finishedOpen
  ) {
    updateLoc(node, curr);
    return true;
  }

  // Default

  //valueNode = ensureTextNode(node.values);
  //appendTextValue(valueNode, curr);
  //return true;
}

Parser.prototype.continueMarkupAttributeNode = function(node, curr, next) {

  var valueNode;

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
    valueNode = ensureTextNode(node.left);
  } else {
    valueNode = ensureTextNode(node.right);
  }

  appendTextValue(valueNode, curr);
  return true;
}

Parser.prototype.continueMarkupContentNode = function(node, curr, next) {
  var valueNode = ensureTextNode(node.values);

  if (curr.type === tks.AT_COLON && !curr._considerEscaped) {
    node._waitingForNewline = true;
    updateLoc(valueNode, curr);
    return true;
  }

  if (curr.type === tks.NEWLINE && node._waitingForNewline === true) {
    node._waitingForNewline = false;
    appendTextValue(valueNode, curr);
    updateLoc(node, curr);
    this.closeNode(node);
    return true;
  }

  if (
    curr.type === tks.AT
    && next.type === tks.BRACE_OPEN
  ) {
    valueNode = this.openNode(new BlockNode(), node.values);
    updateLoc(valueNode, curr);
    return true;
  }

  if (
    curr.type === tks.AT
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
    && next
    && (next.type === tks.AT_COLON || next.type === tks.AT)
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

  if (curr.type === tks.HTML_TAG_CLOSE) {
    this.closeNode(node);
    updateLoc(node, curr);
    return false;
  }

  if (curr.type === tks.LT_SIGN) {
    // TODO: possibly check for same tag name, and if HTML5 incompatible,
    // such as p within p, then close current.
    valueNode = this.openNode(new MarkupNode(), node.values);
    updateLoc(valueNode, curr);
    return false;
  }

  appendTextValue(valueNode, curr);
  return true;
}

Parser.prototype.continueExpressionNode = function(node, curr, next) {
  var valueNode = node.values[node.values.length-1];

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

Parser.prototype.continueExplicitExpressionNode = function(node, curr, next, previousWasEscape) {

  var valueNode = node.values[node.values.length-1];

  if (
    node.values.length === 0
    && (curr.type === tks.AT || curr.type === tks.PAREN_OPEN)
  ) {
    // This is the beginning of the explicit (mark as consumed)
    node._waitingForParenClose = true;
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
    node._waitingForParenClose = false;
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

  // Default
  valueNode = ensureTextNode(node.values);

  if (
    !node._waitingForEndQuote
    && (curr.type === tks.SINGLE_QUOTE || curr.type === tks.DOUBLE_QUOTE)
  ) {
    this.lg('Now waiting for end quote with value %s', curr.val);
    node._waitingForEndQuote = curr.val;
    appendTextValue(valueNode, curr);
    return true;
  }

  if (
    curr.val === node._waitingForEndQuote
    && !previousWasEscape
  ) {
    node._waitingForEndQuote = null;
    this.lg('Happy to find end quote with value %s', curr.val);
    appendTextValue(valueNode, curr);
    return true;
  }

  appendTextValue(valueNode, curr);
  return true;
}

Parser.prototype.continueBlockNode = function(node, curr, next) {

  var valueNode = node.values[node.values.length-1];

  if (curr.type === tks.AT_STAR_OPEN) {
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
    node.keyword = curr.val;
    return true;
  }

  if (
    (curr.type === tks.BLOCK_KEYWORD || curr.type === tks.FUNCTION)
    && !node._reachedOpenBrace
  ) {
    // Assume something like if (test) expressionstatement;
    node.hasBraces = false;
    valueNode = this.openNode(new BlockNode(), node.values);
    updateLoc(valueNode, curr);
    return false;
  }

  if (
    (curr.type === tks.BLOCK_KEYWORD || curr.type === tks.FUNCTION)
    && !node._reachedCloseBrace
    && node.hasBraces
    && !node._waitingForEndQuote
    && !node._withinCommentLine
  ) {
    valueNode = this.openNode(new BlockNode(), node.values);
    updateLoc(valueNode, curr);
    return false;
  }

  if (
    (curr.type === tks.BLOCK_KEYWORD || curr.type === tks.FUNCTION)
    && node._reachedCloseBrace
    && !node._waitingForEndQuote
    && !node._withinCommentLine
  ) {
    valueNode = this.openNode(new BlockNode(), node.tail);
    updateLoc(valueNode, curr);
    return false;
  }

  if (
    curr.type === tks.BRACE_OPEN
    && !node._reachedOpenBrace
    && !node._waitingForEndQuote
    && !node._withinCommentLine
  ) {
    node._reachedOpenBrace = true;
    node.hasBraces = true;
    return true;
  }

  if (
    curr.type === tks.BRACE_OPEN
    && !node._waitingForEndQuote
    && !node._withinCommentLine
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
    && !node._withinCommentLine
  ) {
    updateLoc(node, curr);
    node._reachedCloseBrace = true;
    //this.closeNode(node);
    return true;
  }

  if (
    curr.type === tks.LT_SIGN
    && (next.type === tks.AT || next.type === tks.IDENTIFIER)
    && !node._waitingForEndQuote
    && !node._withinCommentLine
  ) {
    valueNode = this.openNode(new MarkupNode(), node.values);
    updateLoc(valueNode, curr);
    return false;
  }

  if (curr.type === tks.HTML_TAG_CLOSE) {
    if (node._reachedCloseBrace || !node._reachedOpenBrace) {
      updateLoc(node, curr);
      this.closeNode(node);
      return false;
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
  appendTextValue(valueNode, curr);
  return true;
}

// These are really only used when continuing on an expression (for now):
// @model.what[0]()
Parser.prototype.continueIndexExpressionNode = function(node, curr, next) {
  var valueNode = node.values[node.values.length-1];

  if (node._waitingForEndQuote) {
    if (curr.val === node._waitingForEndQuote) {
      node._waitingForEndQuote = null;
    }

    appendTextValue(valueNode, curr);
    return true;
  }

  if (
    curr.type === tks.HARD_PAREN_OPEN
    && !valueNode
  ) {
    node._waitingForHardParenClose = true;
    updateLoc(node, curr);
    return true;
  }

  if (curr.type === tks.HARD_PAREN_CLOSE) {
    node._waitingForHardParenClose = false;
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
    node._waitingForEndQuote = curr.val;
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