
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

