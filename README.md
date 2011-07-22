# Vash, the 60 billion double-dollar template-maker

Vash is an implementation of the [Razor](http://www.asp.net/webmatrix/tutorials/2-introduction-to-asp-net-web-programming-using-the-razor-syntax) templating syntax in JavaScript. A cheat sheet can be found on [Phil Haack's Blog](http://haacked.com/archive/2011/01/06/razor-syntax-quick-reference.aspx). I call this a "template-maker" because it's not a framework, and it's not a templating engine. Vash does one thing, and one thing only: turn a string template into a compiled JS function!

Here's a quick example:

	// compile template
	var itemTpl = vash.tpl( '<li data-description="@desc.name">This is item number: @number.</li>' );
	
	// generate using some data 
	var out = itemTpl({ desc: { name: 'templating functions seem to breed' }, number: 2 });
	
	// dump it
	console.log( out )
	
	// outputs:
	<li data-description="templating functions seem to breed">This is item number: 2.</li>

There are many more examples in the unit tests, located in `test/vash.test.js`. Stand-alone examples are coming soon!

## Neat Stuff

* __Speed__: It's on par with [doT](https://github.com/olado/doT) when rendering with `vash.config.useWith = false` (see test/SPEED.txt, test/vash.speed.js for now). For me, this is "good enough" `:)`.
* __Small__: it's about 4.5k (2k gzipped) using the closure compiler on advanced.
* __Portability__: the compiled template functions are completely self-contained with no external dependencies, allowing you to compile your templates on the server, and only output the compiled versions! [Here's an example](https://gist.github.com/1022323) of how you might do that as part of your build process (the script uses doT, but you get the idea).
* __No dependencies__: Vash itself has no external dependencies, aside from using [Vows](http://vowsjs.org/) for testing.
* __Complete__: Vash supports approximately 100% of the actual Razor syntax, all the things you actually use. See below for what it doesn't support.

# USAGE

	// include src/vash.js somewhere on the page...

	console.log(vash)
	
	vash
		tpl: function(string, useWith){}
		config: {
			useWith: true
			modelName: "model"
		}
		_generate: function(){} // internal, only public to aid testing
		_parse: function(){} // internal, only public to aid testing

### vash.tpl(templateString, [useWith])

Vash has one public method, `vash.tpl()`. It accepts a string template, and returns a function that, when executed, returns a generated string template. The compiled function accepts one parameter, `model`, which is the object that should be used to populate the template. 

`useWith` is an optional parameter that can be used to override the global `vash.config.useWith`.

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

The default is `true`.

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

# Errata

Since this is JavaScript and not C#, there are a few superfluous aspects of Razor that are not implemented, and most likely never will be. Here is a list of unimplemented Razor features:

* `@foreach`: this is not a JavaScript keyword, and while some code generation could take place, it's tough. Deal. `:)`
* `@helper`: I believe that this keyword requires more of a View Engine than a template maker. This is outside the realm of Vash, but could be included with some type of Vash Engine.

# Current Test Results

	node test/vash.test.js 
	··············································· 
	✓ OK » 47 honored (0.017s)


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
					> maybe just vash

# TODO

* make npm package
* avoid pushing new buffer if it's blank
* implement mode stack for @{} blocks, to avoid extra {} in code generation?
* for each mode, encapsulate into constructor function, each with own buffer, each gets pushed onto master stack
* refactor to remove repeated code (mode switches, mostly)
* change regexes to straight string compares where possible for speed (probably not necessary anymore)
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
