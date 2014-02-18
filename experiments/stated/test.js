var util = require('util');
var Lexer = require('./lexer');
var Parser = require('./parser');

var input = ''
+ '@(what)\n'
+ '<img />\n'
+ '<!DOCTYPE html>\n'
+ 'Hello, content.\n'
+ '<p @model.attr data-bind="and-how: @model.who <@(model.what)">\n'
+ '@model.things.forEach(function(thing) {\n'
+ '  <span>@thing.name</span>\n'
+ '  <@model.how>YEP</@model.how>\n'
+ '  @(function() {\n'
+ '    <p></p>\n'
+ '  }())\n'
+ '});\n'
+ '<@model.sometag>what</@model.sometag>\n'
+ '@{ var a = "what"; <span>insideblock</span> }\n'
+ '</p>\n'

var l = new Lexer();

l.write(input);
var tokens = l.read();

var p = new Parser();
p.write(tokens);
for(var i = 0; i < 100; i++) {
  p.read();
}

console.log(util.inspect(p.stack[0], { depth: null, colors: true }));