# Vash, the 60 billion double-dollar template-maker

Vash is an implementation of the [Razor](http://www.asp.net/webmatrix/tutorials/2-introduction-to-asp-net-web-programming-using-the-razor-syntax) templating syntax in JavaScript. A cheat sheet can be found on [Phil Haack's Blog](http://haacked.com/archive/2011/01/06/razor-syntax-quick-reference.aspx). I call this a "template-maker" because it's not a framework, and it's not a templating engine. Vash does one thing, and one thing only: turn a string template into a compiled JS function!

Here's a quick example:

	// compile template
	var itemTpl = vash.compile( '<li data-description="@desc.name">This is item number: @number.</li>' );
	
	// generate using some data 
	var out = itemTpl({ desc: { name: 'templating functions seem to breed' }, number: 2 });
	
	// dump it
	console.log( out )
	
	// outputs:
	<li data-description="templating functions seem to breed">This is item number: 2.</li>

There are many more examples in the unit tests, located in `test/vash.test.js`. Stand-alone examples are coming soon!

## Neat Stuff

* __Full-blown parser / lexer__: Use the parsed tokens for whatever you'd like!
* __Works in Browser or in Node__: Comes with built in Express support, and also works clientside in all browsers >= IE6 (!) and up.
* __Speed__: It's on par with [doT](https://github.com/olado/doT) when rendering with `vash.config.useWith = false` (see test/SPEED.txt, test/vash.speed.js for now). For me, this is "good enough" `:)`.
* __Small-ish__: it's about 7k (2.5k gzipped) using the closure compiler on advanced.
* __Portability__: the compiled template functions are completely self-contained with no external dependencies, allowing you to compile your templates on the server, and only output the compiled versions! [Here's an example](https://gist.github.com/1022323) of how you might do that as part of your build process (the script uses doT, but you get the idea).
* __No dependencies__: Vash itself has no external dependencies, aside from using [Vows](http://vowsjs.org/) for testing.
* __Complete__: Vash supports approximately 100% of the actual Razor syntax, all the things you actually use. See below for what it doesn't support.

# BUILD

	cd GIT/vash

	# one time
	touch support/buildnum
	0 > support/buildnum

	node support/build.js && node test/vash.test.js
	// creates build/vash.js and build/vash.min.js 

# USAGE

### vash.compile(templateString, [options])

Vash has one public method, `vash.compile()`. It accepts a string template, and returns a function that, when executed, returns a generated string template. The compiled function accepts one parameter, `model`, which is the object that should be used to populate the template. 

`options` is an optional parameter that can be used to override the global `vash.config`.

## OPTIONS

### vash.config.useWith = true(default)/false

If `vash.config.useWith` is set to `true`, then Vash will wrap a `with` block around the contents of the compiled function. Set to `false`, changes how you must write your templates, and is best explained with an example:

	// vash.config.useWith == true
	<li>@description</li>

vs

	// vash.config.useWith == false
	<li>@model.description</li>

Rendering is the same regardless:

	compiledTpl( { description: 'I am a banana!' } );
	// outputs:
	// <li>I'm a banana!</li>

The default is `false`.

Tech note: using a `with` block comes at a severe performance penalty (at least 25x slower!). Using `with` is mostly to support the cleanest syntax as possible.

### vash.config.modelName = "model"

If `vash.config.useWith` is set to `false`, then this property is used to determine what the name of the default internal variable will be. Example:

	// vash.config.useWith == false
	<li>@model.description</li>

vs

	// vash.config.useWith == false
	// vash.config.modelName == 'whatwhat'
	<li>@whatwhat.description</li>

Again, rendering is the same regardless:

	compiledTpl( { description: 'I am a banana!' } );
	// outputs:
	// <li>I'm a banana!</li>

# Express Support

	var 
		 vash = require('vash')
		,express = require('express')
		,app = express.createServer();

	app.configure(function(){	
		app.use(app.router);
		app.use(express.static(__dirname + '/fixtures/public'));
		app.use(express.bodyParser());
		app.set('views', __dirname + '/views');
		app.set('view engine', 'vash')
		app.register('vash', vash);
	})

Full example coming soon.

# Errata

Since this is JavaScript and not C#, there are a few superfluous aspects of Razor that are not implemented, and most likely never will be. Here is a list of unimplemented Razor features:

* `@foreach`: this is not a JavaScript keyword, and while some code generation could take place, it's tough. Deal. `:)`
* `@helper`: I believe that this keyword requires more of a View Engine than a template maker. This is outside the realm of Vash, but could be included with some type of Vash Engine.
* `@using`: JS just doesn't work that way.

# Current Test Results

	node support/build.js && node test/vash.test.js
	································································· 
	✓ OK » 65 honored (0.037s)

# Why Vash?

The original name of this syntax is Razor, implying that it is as stripped down as possible (see [Occam's Razor](http://en.wikipedia.org/wiki/Occam's_razor)), and so a friend and I started riffing on it. Below is the stream of connected thoughts:

 	> razor...
	> precision, surgical, steel
	> tanto
	> wakizashi
		> WK.tpl()
		> japanese emoticons?
		> _$8 is a valid JS identifier
		> mootools has $$ 
			> double dollars 
			> the 60 billion double dollar man 
				> Vash the Stampede! 
				> vash.tpl()
					> Very Awesome Scripted HTML
					> ...maybe just vash

# TODO

* refactor tests to take advantage of Vows' awesomeness
* add possiblity for useWith configuration from within template? special keyword?

# License

MIT

	Copyright (C) 2011 by Andrew Petersen

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in
	all copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	THE SOFTWARE.
