var util = require('util');
var Lexer = require('./lexer');
var Parser = require('./parser');

var input = ''
+ '@(what)\n'
+ '<img />\n'
+ '<!DOCTYPE html>\n'
+ 'Hello, content.\n'
+ '<p @model.attr data-bind="and-how: @model.who <@(model.what)">\n'
+ '@(function() { <p>)</p> })\n'
+ '@model.things.forEach(function(thing) {\n'
+ '  <span class=\'what\'>@thing.name</span>\n'
+ '  <@model.how>YEP</@model.how>\n'
+ '  (function() {\n'
+ '    <p></p>\n'
+ '  }())\n'
+ '})\n'
+ '<@model.sometag>what</@model.sometag>\n'
+ '@{ var a = "what"; <span>insideblock</span> }\n'
+ '<silly>@model.what[0]("who")["and"]</silly>\n'
+ '@("what"[0] + (function() { return { hey: \'hey\' } })["hey"])\n'
+ '</p>\n'

var l = new Lexer();

l.write(input);
var tokens = l.read();

var p = new Parser();
p.write(tokens);
for(var i = 0; i < 280; i++) {
  p.read();
}

console.log(util.inspect(p.stack[0], { depth: null, colors: true }));

//var traverse = require('./traverse');
//traverse(p.stack[0], {
//  enter: function(node) { console.log('ENTER', node.type, node.parent ? node.parent.type : null) },
//  leave: function(node) { console.log('LEAVE', node.type, node.parent ? node.parent.type : null) }
//});

var codegen = require('./codegen');
var compiled = codegen(p.stack[0], { htmlEscape: true, helpersName: 'html' });
console.log(compiled);