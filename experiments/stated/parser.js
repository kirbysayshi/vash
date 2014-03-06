
var debug = require('debug');

var tks = require('./tokens');
var nodestuff = require('./nodestuff');
var error = require('./error');

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
var RegexNode = require('./nodes/regex');

function Parser() {
  this.lg = debug('vash:parser');
  this.tokens = [];
  this.deferredTokens = [];
  this.node = null;
  this.stack = [];
  this.inputText = '';
  this.previousWasEscape = false;
  this.previousNonWhitespace = null
}

module.exports = Parser;

Parser.prototype.decorateError = function(err, line, column) {
  err.message = 'at template line ' + line
    + ', column ' + column + ': '
    + err.message + '\n'
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

    if (curr.type !== tks.WHITESPACE) {
      this.previousNonWhitespace = curr;
    }

    // Poor man's ASI.
    if (curr.type === tks.NEWLINE) {
      this.previousNonWhitespace = null;
    }

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
      msg = 'Found unclosed ' + node.type + '.\n\n'
        + 'Node: ' + JSON.stringify(node, null, '  ');
      throw this.decorateError(
        new Error(msg),
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
    this.flag(node, '_waitingForClose', true)
    updateLoc(node, curr);
    return true;
  }

  if (curr.type === tks.AT_STAR_CLOSE && node._waitingForClose) {
    this.flag(node, '_waitingForClose', null)
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
    && curr.type !== tks.NEWLINE
    && curr.type !== tks.HTML_TAG_VOID_CLOSE
  ) {

    // Assume tag name

    if (curr.type === tks.AT) {
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

  // </
  if (curr.type === tks.HTML_TAG_CLOSE) {
    this.flag(node, '_waitingForFinishedClose', true);
    return true;
  }

  if (curr.type === tks.HTML_TAG_VOID_CLOSE) {
    this.closeNode(node);
    this.flag(node, 'isVoid', true);
    this.flag(node, 'voidClosed', true);
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
    this.flag(node, '_finishedLeft', true);
    updateLoc(node, curr);
    this.closeNode(node);
    return false; // defer
  }

  // End of left.
  if (curr.type === tks.EQUAL_SIGN) {
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

Parser.prototype.continueMarkupContentNode = function(node, curr, next) {
  var valueNode = ensureTextNode(node.values);

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
    this.lg('Now waiting for end quote with value %s', curr.val);
    this.flag(node, '_waitingForEndQuote', curr.val);
    appendTextValue(valueNode, curr);
    return true;
  }

  if (
    curr.val === node._waitingForEndQuote
    && !previousWasEscape
  ) {
    this.flag(node, '_waitingForEndQuote', null);
    this.lg('Happy to find end quote with value %s', curr.val);
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
    this.flag(node, '_reachedOpenBrace', true);
    this.flag(node, 'hasBraces', true);
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
    this.flag(node, '_reachedCloseBrace', true);
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
    if (
      (node.hasBraces && node._reachedCloseBrace)
      || !node._reachedOpenBrace
    ) {
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
    curr.type === tks.AT
    && next.type === tks.IDENTIFIER
    && !node._waitingForEndQuote
    && !node._withinCommentLine
  ) {

    if (node._reachedCloseBrace) {
      this.closeNode(node);
      return false;
    } else {
      // @for() { @i } used to be valid.
      var msg = '@expressions are only valid within'
        + ' markup tags (<p>@exp</p>),'
        + ' text tags (<text>@exp</text>), or'
        + ' @ escapes (@:@exp\\n) ';
      console.error('Warning: '
        + this.decorateError(new Error(msg), curr.line, curr.chr).message);
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
