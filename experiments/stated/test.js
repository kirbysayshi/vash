var util = require('util');
var Lexer = require('./lexer');
var Parser = require('./parser');

var input = ''
+ '@(model.what)\n'
+ '<img />\n'
+ '<!DOCTYPE html>\n'
+ 'Hello, content.\n'
+ '@for(var i = 0; i < 1; i++) { <i></i> }\n'
+ '<p @model.attr data-bind="and-how: @model.who <@(model.what)">\n'
+ '@switch(model.what) {\n'
+ '  case "hello":\n'
+ '    <img src="hello" />\n'
+ '    break;\n'
+ '  default:\n'
+ '    <link href="hello">\n'
+ '    break;\n'
+ '}\n'
+ '@(function() { <p>)</p> }())\n'
+ '@model.things.forEach(function(thing) {\n'
+ '  if(true) { <b></b> } else <i></i>\n'
+ '  <span class=\'what\'>@thing.name</span>\n'
+ '  <@model.how>YEP</@model.how>\n'
+ '  (function(arg) {\n'
+ '    <p>@arg</p>\n'
+ '  }("arg"))\n'
+ '})\n'
+ '<@model.sometag>what</@model.sometag>\n'
+ '@{ var a = "what"; <span>insideblock</span> }\n'
+ '<silly>@model.fns[0]("who")["and"]</silly>\n'
+ '@("what"[0] + (function() { return { hey: \'hey\' } }())["hey"])\n'
+ '</p>\n'

var testModel = {
  what: 'what',
  attr: 'htmlattribute',
  who: 'who',
  how: 'how',
  things: [{ name: 'thingname' }],
  sometag: 'htmltag',
  fns: [function(arg) {
    return { and: 'and' }
  }]
}

var expectedOutput = ''
+ 'what\n'
+ '<img />\n'
+ '<!DOCTYPE html>\n'
+ 'Hello, content.\n'
+ '<i></i>\n' // this new line is included because PROGRAM is like MARKUP
+ '<p htmlattribute data-bind="and-how: who <what">\n'
+ '<link href="hello">\n'
+ '<p>)</p>\n'
+ '<b></b><span class=\'what\'>thingname</span><how>YEP</how><p>arg</p>\n'
+ '<htmltag>what</htmltag>\n'
+ '<span>insideblock</span>\n'
+ '<silly>and</silly>\n'
+ 'whey\n'
+ '</p>\n'

var opts = {
  // Compiler Options
  htmlEscape: true,
  helpersName: 'html',
  modelName: 'model',
  source: input,

  // Runtime options
  asHelper: false,
  args: null
}

var l = new Lexer();

l.write(input);
var tokens = l.read();

var p = new Parser();
p.write(tokens);
var more = true;
while(more !== null) more = p.read();

console.log(util.inspect(p.stack[0], { depth: null, colors: true }));

//var traverse = require('./traverse');
//traverse(p.stack[0], {
//  enter: function(node) { console.log('ENTER', node.type, node.parent ? node.parent.type : null) },
//  leave: function(node) { console.log('LEAVE', node.type, node.parent ? node.parent.type : null) }
//});

var codegen = require('./codegen');
var compiled = codegen(p.stack[0], opts);
console.log(compiled);
var runtime = require('./runtime');
var tpl = runtime.link(compiled, opts);

require('colors');
var diff = require('diff');

console.log(tpl(testModel));

var d = diff.diffWords(expectedOutput, tpl(testModel))

d.forEach(function(part){
  // green for additions, red for deletions
  // grey for common parts
  var color = part.added ? 'green' :
    part.removed ? 'red' : 'grey';
  process.stderr.write(part.value[color]);
});
