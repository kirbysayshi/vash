<!-- This document was generated from README.vash -->


Vash
====

_"... the 60 billion double-dollar template-maker!"_ ~ The previous README, and no one else, ever.

Vash is a template engine that offers a swift flow between code and content using [Razor Syntax][] <sup id="fnref:razor-ms">
			<a rel="footnote" href="#fn:razor-ms">1</a>
		</sup>. This document <sup id="fnref:this-doc">
			<a rel="footnote" href="#fn:this-doc">2</a>
		</sup> is intended for users of Vash, and also serves as a reference for Vash's implementation of Razor Syntax.

[Razor Syntax]: http://www.asp.net/web-pages/tutorials/basics/2-introduction-to-asp-net-web-programming-using-the-razor-syntax

[![Build Status](https://secure.travis-ci.org/kirbysayshi/vash.png?branch=master)](https://travis-ci.org/kirbysayshi/vash)

[![NPM](https://nodei.co/npm/vash.png)](https://nodei.co/npm/vash/)


- [Features](#features) 
- [Syntax Example](#syntax-example) 
- [Quick Start](#quick-start) 
  - [nodejs](#nodejs) 
  - [express](#express) 
  - [Browser - Vanilla](#browser---vanilla) 
  - [Browser - Browserify et al](#browser---browserify-et-al) 
  - [Browser - RequireJS](#browser---requirejs) 
- [Playground](#playground) 
- [Syntax](#syntax) 
  - [The Transition Character: @](#the-transition-character) 
  - [Expressions](#expressions) 
  - [Advanced Expressions](#advanced-expressions) 
  - [Explicit Expressions](#explicit-expressions) 
  - [Code Blocks](#code-blocks) 
  - [Keyword Blocks](#keyword-blocks) 
  - [Comments](#comments) 
  - [HTML Escaping](#html-escaping) 
  - [Explicit Markup](#explicit-markup) 
- [Configuration](#configuration) 
  - [vash.config.useWith](#vash-config-usewith) 
  - [vash.config.modelName](#vash-config-modelname) 
  - [vash.config.helpersName](#vash-config-helpersname) 
  - [vash.config.htmlEscape](#vash-config-htmlescape) 
  - [vash.config.debug](#vash-config-debug) 
  - [vash.config.debugParser](#vash-config-debugparser) 
  - [vash.config.debugCompiler](#vash-config-debugcompiler) 
  - [vash.config.simple](#vash-config-simple) 
  - [vash.config.favorText](#vash-config-favortext) 
- [Template Options](#template-options) 
  - [asContext](#ascontext) 
  - [onRenderEnd](#onrenderend) 
- [Helper System](#helper-system) 
- [Built-in Helpers](#built-in-helpers) 
  - [vash.helpers.raw](#vash-helpers-raw) 
  - [vash.helpers.escape](#vash-helpers-escape) 
  - [vash.helpers.tplcache](#vash-helpers-tplcache) 
- [Layout Helpers](#layout-helpers) 
  - [vash.helpers.extend](#vash-helpers-extend) 
  - [vash.helpers.block](#vash-helpers-block) 
  - [vash.helpers.append](#vash-helpers-append) 
  - [vash.helpers.prepend](#vash-helpers-prepend) 
  - [vash.helpers.include](#vash-helpers-include) 
- [Compiled Helpers](#compiled-helpers) 
- [Buffer API](#buffer-api) 
- [Precompiling Templates](#precompiling-templates) 
- [Vash Runtime (Browser)](#vash-runtime-browser) 
- [Compile-time API](#compile-time-api) 
  - [vash.compile](#vash-compile) 
  - [vash.compileHelper](#vash-compilehelper) 
  - [vash.compileBatch](#vash-compilebatch) 
- [Runtime API](#runtime-api) 
  - [vash.link](#vash-link) 
  - [vash.lookup](#vash-lookup) 
  - [vash.install](#vash-install) 
  - [vash.uninstall](#vash-uninstall) 
- [vash(1)](#vash-1) 
  - [Installation](#installation) 
  - [--target-namespace](#vash1--target-namespace) 
  - [--property-name](#vash1--property-name) 
  - [--helper](#vash1--helper) 
- [Contributing / Building](#contributing-building) 
- [Getting Help](#getting-help) 
- [Special Thanks](#special-thanks) 
- [License](#license) 


<a name="features"></a>Features 
================

* Mix code and content without ugly delineators, like `<?`, `<%`, or `{{`.
* No new language to learn: Vash is just HTML-aware JavaScript.
* Great with markup, but can be used with nearly any other language as well (even Markdown!).
* Helpers API allows for extensibility and meta programming.
* Works in the browser or in node.
* Comes with a Jade-inspired layout engine (block, include, extend, append/prepend), which even works in the browser.

<a name="syntax-example"></a>Syntax Example 
======================

	<p>How are you @model.name? Today is a sunny day on the planet Gunsmoke.</p>

	<ul class="@(model.active ? 'highlight' : '')">
		@model.forEach(function(m){
			<li>@m.name</li>
		})
	</ul>

<a name="quick-start"></a>Quick Start 
===================

<a name="nodejs"></a>nodejs 
--------------

	var vash = require('vash');
	var tpl = vash.compile('<p>I am a @model.t!</p>');

	var out = tpl({ t: 'template' });
	// <p>I am a template!</p>

<a name="express"></a>express 
--------------------

Check out [vash-express-example][] for a full example of hooking up vash as a view engine for express 3. But it's basically as simple as:

	var express = require('express');

	var app = express();
	app.set('view engine', 'vash');

More information is also available in the [Layout Helpers][] sections.

[vash-express-example]: https://github.com/kirbysayshi/vash-express-example

<a name="browser---vanilla"></a>Browser - Vanilla 
-------------------------

	<script type="text/javascript" src="build/vash.js"></script>

	var tpl = vash.compile( '<p>I am a @model.t!</p>' );
	document.querySelector('#content').innerHTML = tpl({ t: 'template' });

But you should probably be precompiling your templates. See [Precompiling Templates][] for more info. Then you can just include the Vash runtime instead of the entire compiler.

<a name="browser---browserify-et-al"></a>Browser - Browserify et al 
----------------------------------

Just `require` Vash, and compile. If you want something fancier, try [vashify](https://www.npmjs.com/package/vashify)! Then you can directly require any `.vash` file and it will be resolved as compiled template:

	var tpl = require('my-awesome-template.vash');
	document.querySelector('#content').innerHTML = tpl({ t: 'template' });

<a name="browser---requirejs"></a>Browser - RequireJS 
---------------------------

RequireJS support has been recently dropped. However Vash does support CJS environments, so as long as you configure RequireJS to consume Vash as a CJS project (including `node_modules` resolution), everything should work.

<a name="playground"></a>Playground 
==================

Vash now has [a playground][] of sorts at [CodePen.io][]. It uses the current version of `vash.js` from the `build` folder. Fork it to test your own template ideas!

[a playground]: http://codepen.io/kirbysayshi/full/IjrFw
[CodePen.io]: http://codepen.io

<a name="syntax"></a>Syntax 
==============

For the following examples, assume a model is passed into the compiled function. If a model is explicitly defined, it will appear as:

	// model = { what: 'hello!' }

<a name="the-transition-character"></a>The Transition Character: @ 
------------------------------------

Vash uses the `@` symbol to transition between code and markup. To escape and print a literal `@`, use a double `@`, like this: `@@`.

<a name="expressions"></a>Expressions 
-------------------

The most basic usage of Vash is an implicit expression. Vash is smart enough to know what's valid JS and what's not, and can usually do what you want it to do. An expression is an @ followed by a valid JS identifier. This is then interpolated automatically.

input:

	// model = { what: 'hello!' }
	<p>@what</p>

output:

	<p>hello!</p>

The `model` comment is just to show that the object passed into the compiled template contains a key that matches the expression.

To allow for the fastest render time possible, Vash by default requires the model to be addressed explicitly. This is to avoid using a `with` statment in the compiled template, which is approximately 25 times slower. The above example then becomes:

input:

	<p>@model.what</p>

output:

	<p>hello!</p>

As you can see, the output is exactly the same. The name used to reference the model is configurable via [vash.config.modelName][]. Typical values are `model` and `it`.


<a name="advanced-expressions"></a>Advanced Expressions 
----------------------------

Vash typically knows when an expression ends, even when the expression is complex. For example:

input:

	<p>@model.what().who[2]('are you sure')('yes, it\'s ok')( model.complex ? 'FULL POWER' : '' )</p>

This will work just fine, assuming you have a model that actually contains that complexity! I hope you don't, and if so, I feel bad.

Callbacks work as well:

input:

	// model = ['a', 'b']
	@model.forEach(function(item){
		<li>@item</li>
	})

outputs:

	<li>a</li><li>b</li>

Vash also knows the difference between JS dot notation and a period.

input:

	// model = { description: 'living' }
	<p>Plants are @model.description.</p>

output:

	<p>Plants are living.</p>

And empty brackets, because they're not valid JS:

input:

	// model = { formName: 'addresses' }
	<input type="text" name="@model.formName[]" />

output:

	<input type="text" name="addresses[]" />

Email addresses, to an extent, are fine as well. Vash makes a trade-off. It uses the following regex to validate an email address:

	/^([a-zA-Z0-9.%]+@[a-zA-Z0-9.\-]+\.(?:ca|co\.uk|com|edu|net|org))\b/

Email addresses can actually contain many more valid characters, and are [really hard to validate][]. Vash can handle a typical email address with ease:

input:

	<a href="mailto:vash@planetgunsmoke.com">Email Me</a>

output:

	<a href="mailto:vash@planetgunsmoke.com">Email Me</a>

If you have a complex email address that confuses Vash, then you should use an [explicit expression](#explicit-expressions) instead.

[really hard to validate]: http://www.regular-expressions.info/email.html

<a name="explicit-expressions"></a>Explicit Expressions 
----------------------------

An explicit expression is simply an expression that, instead of being composed of `@` and a valid JS identifier, is surrounded by parenthesis.

input:

	<p>@(model.what)</p>

output:

	<p>hello!</p>

Why would you ever need this? Perhaps you want to do something like:

input:

	// model = { hasIceCream: true }
	<p class="@( model.hasIceCream ? 'ice-cream' : '')">Ice Cream</p>

output:

	<p class="ice-cream">Ice Cream</p>

You could even create an anonymous function.

input:

	@(function(type){ return type + ' cream'; }('banana'))

output:

	banana cream

As you can see, Vash does not require a model to be referenced, or even passed in.

<a name="code-blocks"></a>Code Blocks 
-------------------

Sometimes, AGAINST ALL ODDS, a template may need some quick computation of values to avoid repeating yourself. Unlike expressions and explicit expressions, a code block does not directly output. To compare to PHP, expressions are like `<?= $what ?>`, while a code block is like `<? $what = 'what' ?>`.

A code block is simply `@{  }`.

input:

	@{ var rideOn = 'shooting star'; }

output:

That's right, _nothing_! Here's a better example:

input:

	@{
		var total = model.price + model.tax;
	}

	<p>Your total is: $@total</p>

output:

	<p>Your total is: $2.70</p>

Anything is valid within a code block, such as function declarations or even something as complex as defining a prototype. You can also use markup within a code block, and it will behave as expected:

input:

	@{ <p>This works!</p> }

output:

	<p>This works!</p>

A code block just tells Vash, "expect the next stuff to be code until otherwise".

<a name="keyword-blocks"></a>Keyword Blocks 
----------------------

Vash is aware of keywords, and will open a code block automatically for you.

input:

	// model = { type: 'banana' }
	@if(model.type){
		<p>I'm a @model.type!</p>
	} else if(model.name){
		<p>My name is @model.name.</p>
	} else {
		<p>I DON'T KNOW WHO OR WHAT I AM...</p>
	}

output:

	<p>I'm a banana!</p>

This also works for `while`, `for`, `do`, `try/catch`, `with`, `switch`, `function`, and other keywords.

You don't even need to worry about whitespace or newlines:

input:

	// model = 1
	@switch(model){case 1:<p></p>break;case 2:<b></b>break;}

output:

	<p></p>

<a name="comments"></a>Comments 
----------------

Vash also supports comments that are not compiled into the template. These are delineated with `@*` and `*@`

input:

	@* I am a comment that extends
	over multiple lines *@
	<p>BANANA!</p>

output:

	<p>BANANA!</p>

<a name="html-escaping"></a>HTML Escaping 
---------------------

By default, Vash escapes any HTML-like values before outputting them.

input:

	// model = { what: '<img />' }
	<p>@model.what</p>

output:

	<p>&lt;img /&gt;</p>

If you are sure that you trust the content and/or need to display HTML-like values, you can escape the HTML escaping via a call to Vash's [helper system][]: `html.raw`.

input:

	// model = { what: '<img />' }
	<p>@html.raw(model.what)</p>

output:

	<p><img /></p>

This behavior can be disabled using [vash.config.htmlEscape][].

<a name="explicit-markup"></a>Explicit Markup 
-----------------------

Sometimes you may wish to tell Vash that what you're typing is markup or content, as opposed to code. Take the following example:

input:

	// model = ['a']
	@model.forEach(function(item){
		this should be content @item
	})

output:

	(Error when compiling)

In this situation, you have two options. The first is the `@:` (at colon) escape. It tells Vash that until it sees a newline, treat the input as content, not code.

input:

	// model = ['a']
	@model.forEach(function(item){
		@: this should be content @item
	})

output:

	this should be content a

The other option, in the event that more than one line is needed, is by using an imaginary HTML tag named `<text>`. When Vash sees this tag, it switches to content mode, and discards the tag. This means that the tag will never be output.

input:

	// model = ['Indeed!']
	@model.forEach(function(item){
		<text>
			This is some longer content that you
			apparently wanted on multiple lines,
			multiple times! @item
		</text>
	})

output:

	This is some longer content that you
	apparently wanted on multiple lines,
	multiple times! Indeed!

<a name="configuration"></a>Configuration 
=====================

Vash has a few compilation options that are configurable either by setting the relevant value in `vash.config` or by passing in an object with that key/value to [vash.compile][], [vash.compileBatch][], or [vash.compileHelper][].

For example:

	vash.config.debug = true;

Is the global version of:

	vash.compile('<p>My tpl</p>', { debug: true });

<a name="vash-config-usewith"></a>vash.config.useWith 
---------------------------

	Default: false

If `useWith` is set to `true`, then Vash will wrap a `with` block around the contents of the compiled function.

	// vash.config.useWith == true
	<li>@description</li>

vs

	// vash.config.useWith == false
	<li>@model.description</li>

Rendering is the same regardless:

	tpl( { description: 'I am a banana!' } );
	// outputs:
	// <li>I'm a banana!</li>

_Tech note: using a `with` block comes at a severe performance penalty (at least 25x slower!)._

<a name="vash-config-modelname"></a>vash.config.modelName 
-----------------------------

	Default: 'model'

If [vash.config.useWith][] is  `false` (default), then this property is used to determine what the name of the default free variable will be. Example:

	// vash.config.useWith == false
	<li>@model.description</li>

vs

	// vash.config.useWith == false
	// vash.config.modelName == 'whatwhat'
	<li>@whatwhat.description</li>

Again, rendering is the same regardless:

	tpl( { description: 'I am a banana!' } );
	// outputs:
	// <li>I'm a banana!</li>

A common alternative to `model` is `it`.

<a name="vash-config-helpersname"></a>vash.config.helpersName 
-------------------------------

	Default: 'html'

Determines the name of the free variable through which registered helper methods can be reached. Example:

	<li>@html.raw(model.description)</li>

vs

	// vash.config.helpersName == "help";
	<li>@help.raw(model.description)</li>

Again, rendering is the same regardless:

	tpl( { description : '<strong>Raw</strong> content!' } );
	// outputs:
	// <li><strong>Raw</strong> content!</li>

<a name="vash-config-htmlescape"></a>vash.config.htmlEscape 
------------------------------

	Default: true

As of version 0.4x, Vash automatically HTML encodes values generated by an explicit or implicit expression. To disable this behavior, set `htmlEscape` to `false`. For an more in depth example, see [HTML Escaping][].

If a value _should not_ be escaped, simply wrap it in a call to [vash.helpers.raw][].

<a name="vash-config-debug"></a>vash.config.debug 
-------------------------

	Default: true

By default, templates are compiled with extensive debugging information, so if an error is thrown while rendering a template (not compiling), exact location (line, character) information can be given.

Using the following template:

	<p></p>

A template with `debug` set to `true` (default):

	function anonymous(model,html,__vopts,vash) {
		try {
			var __vbuffer = html.buffer;
			html.options = __vopts;
			model = model || {};
			html.vl = 1, html.vc = 0;
			__vbuffer.push('<p>');
			html.vl = 1, html.vc = 3;
			__vbuffer.push('</p>');
			html.vl = 1, html.vc = 7;
			__vbuffer.push('\n');
			(__vopts && __vopts.onRenderEnd && __vopts.onRenderEnd(null, html));
			return (__vopts && __vopts.asContext)
				? html
				: html.toString();
		} catch( e ){
			html.reportError( e, html.vl, html.vc, "<p></p>!LB!" );
		}
	}

And that same template with `debug` set to `false`:

	function anonymous(model,html,__vopts,vash) {
		var __vbuffer = html.buffer;
		html.options = __vopts;
		model = model || {};
		__vbuffer.push('<p></p>\n');
		(__vopts && __vopts.onRenderEnd && __vopts.onRenderEnd(null, html));
		return (__vopts && __vopts.asContext)
			? html
			: html.toString();
	}

As you can see, the difference, especially in code size and instruction size is significant. For production apps, templates should be precompiled with `debug` as `false`.

<a name="vash-config-debugparser"></a>vash.config.debugParser 
-------------------------------

	Default: false

Vash's parser will output useful debugging infomation if `debugParser` is `true`:

* Tokens and what mode they were processed as
* A textual representation of the fully parsed AST

<a name="vash-config-debugcompiler"></a>vash.config.debugCompiler 
---------------------------------

	Default: false

Vash's compiler will output useful debugging information if `debugCompiler` is `true`:

* The text content of the template function before it is passed into [vash.link][] for actual evaluation
* The options passed into the compiler. This is useful for debugging [vash.compileBatch][] and [vash.compileHelper][].

<a name="vash-config-simple"></a>vash.config.simple 
--------------------------

	Default: false

If `true`, the template is compiled in "fast path" mode. This disables several advanced features for the sake of speed:

* [onRenderEnd][] callbacks are completely ignored.
* The [Helper System][] instance normally available within a running template as `html` is no longer an instance of `vash.helpers.constructor`, and thus the entire buffer API and helpers are missing. Instead it is a plain object with the following properties:
  * `buffer`: a plain array
  * `escape`: [vash.helpers.escape][]
  * `raw`: [vash.helpers.raw][]
* The [asContext][] runtime option is completely ignored.
* [vash.config.htmlEscape][], [vash.config.useWith][], and [vash.config.debug][] still behave as expected.

While standard Vash templates are definitely not slow, using `true` for this option decreases render time by 15% - 25% depending on the size of the template.

[vash-benchgraph](https://github.com/kirbysayshi/vash-benchgraph) can be used to show the speed increase:

	node benches.js --tinclude 004.vash,007.vash --vinclude '0.6.2-2482' --chart vashv,ops

<a name="vash-config-favortext"></a>vash.config.favorText 
-----------------------------

	Default: false

When Vash encounters text that directly follows an opening brace of a block, it assumes that unless it encounters an HTML tag, the text is JS code. For example:

	@it.forEach(function(a){
		var b = a; // vash assumes this line is code
	})

When `favorText` is set to `true`, Vash will instead assume that most things are content (not code) unless it's very explicit.

	@it.forEach(function(a){
		var b = a; // vash.config.favorText assumes this line is content
	})

This option is __EXPERIMENTAL__, and should be treated as such. It allows Vash to be used in a context like [Markdown](http://daringfireball.net/projects/markdown/syntax), where HTML tags, which typically help Vash tell the difference between code and content, are rare.

<a name="template-options"></a>Template Options 
========================

These options concern rendering a template, after it has already been compiled. For options related to compiling templates, see [Configuration][].

The compiled templates themselves have three signatures.

	tpl(model) -> string

The most basic form accepts a single argument, `model`, that can be any value: Number, Boolean, Object, Array, undefined, null, etc. It returns the rendered template as a string.

	tpl(model, function(){}) -> string

The second form accepts a function callback as its second parameter, which is called [onRenderEnd][] (see below).

	tpl(model, options) -> string

The third form allows for options in addition to [onRenderEnd][]. There are two options that can affect a template while rendering:

<a name="ascontext"></a>asContext 
-----------------

	tpl(model, { asContext: true }) -> vash.helpers.constructor

This option tells the template that instead of returning a string, it should return the "render context", otherwise known as an instance of `vash.helpers.constructor` ([Helper System][]).

<a name="onrenderend"></a>onRenderEnd 
-------------------

	tpl(model, { onRenderEnd: function(){} }) -> string

This option is effectively a callback for once primary execution of the rendering template has finished. The arguments passed to the callback are: `( err, html )`, where `err` is always `null` (for now), and `html` is the render context (instance of `vash.helpers.constructor`). This callback is not required, and is only called if defined (and has no default definition). The [Layout Helpers][] use this to know when all includes, prepends, appends, blocks, and extend calls have finished.

[onRenderEnd][] can also be defined as a property of the model:

	var model = { hey: 'what', onRenderEnd: function(err, ctx){ ... } }

<a name="helper-system"></a>Helper System 
===============

Vash's primary point of expandability lies in its Helper API. When a template is rendering, there is a free variable avaiable. This variable is, by default, named `html`. This name can be changed with the [vash.config.helpersName][] option. `html` is an instance of the prototype that is attached to `vash.helpers`. It's a bit confusing, but this is how it kind of works:

	var Helpers = function(){}
	vash.helpers = Helpers.prototype;
	vash.helpers.constructor = Helpers;

What this means is that any function that is attached to `vash.helpers` is available within a rendering template via `html`. For example:

	// defined in a JS file or script tag somewhere
	vash.helpers.echo = function(arg){ return arg; }

input:

	<p>@html.echo('hello!')</p>

output:

	<p>hello!</p>

Here is a simple helper that converts text like "This is a holdup!" to "this-is-a-holdup":

	vash.helpers.mdHref = function(text){
		return text
			.toLowerCase()
			.replace(/[^a-zA-Z0-9-_]+/g, '-')
			.replace(/^-+|\n|-+$/g, '');
	}

Notice how it's just JavaScript. Within a template, it could be accessed via `html.mdHref("This is a holdup!")`.

<a name="built-in-helpers"></a>Built-in Helpers 
========================

<a name="vash-helpers-raw"></a>vash.helpers.raw 
------------------------

Available as `html.raw` within an executing template. By default, all content that passes from a model to a template is HTML encoded. In the event that the text is trusted (or is already encoded), wrap the text in this function. For an example, see [HTML Escaping][];

<a name="vash-helpers-escape"></a>vash.helpers.escape 
---------------------------

Available as `html.escape` within an executing template, this is the method Vash uses to HTML encode model values. It can also be used manually.

<a name="vash-helpers-tplcache"></a>vash.helpers.tplcache 
-----------------------------

The `tplcache` is just that, a place to put a global index of templates. This is used primarily for the more "view engine" aspects that Vash provides, as well as a default location for [precompiled templates][--target-namespace] using [vash(1)][].

<a name="layout-helpers"></a>Layout Helpers 
======================

Vash provides a relatively simple but powerful view engine whose API is borrowed directly from [Jade][]. Below is the API, but an example can be found at [vash-express-example][].

Callbacks are used to maintain compatibility with typical JS syntax.

When running in [nodejs][] and using [express][], Vash will automatically resolve and load templates using the same conventions as express itself, specifically [app.engine][]. When in the browser, Vash uses the same rules, but looks in [vash.helpers.tplcache][] instead.

[nodejs]: http://nodejs.org
[express]: http://expressjs.com
[app.engine]: http://expressjs.com/api.html#app.engine
[Jade]: http://jade-lang.com
[vash-express-example]: https://github.com/kirbysayshi/vash-express-example/tree/master/views
[layout.vash]: https://github.com/kirbysayshi/vash-express-example/blob/master/views/layout.vash
[Layout.vash]: https://github.com/kirbysayshi/vash-express-example/blob/master/views/layout.vash



<a name="vash-helpers-extend"></a>vash.helpers.extend 
---------------------------

	vash.helpers.extend(parent_path, cb)

This is Vash's main form of inheritance for view templates. `parent_path` is the location or name of the template to be extended.

A template can define various locations in itself that can be [overridden](#vash-helpers-block) or [added to](#vash-helpers-append). In addition, a template that calls `extend` can even be extended itself!

In the following example, this template extends another named [layout.vash][]. [Layout.vash][] defines an empty [block](#vash-helpers-block) named 'content', which is overrided in this example.

	@html.extend('layout', function(model){
		@html.block('content', function(model){
			<h1 class="name">Welcome to </h1>
		})
	})

_Tech note: due to the way JS scoping works, the `model` parameter of the `cb` function must be explicitely defined as above if it is referenced in the content. This may change in a future version of Vash._


<a name="vash-helpers-block"></a>vash.helpers.block 
--------------------------

	vash.helpers.block(name)

A block is essentially a placeholder within a template that can be overridden via another call to [vash.helpers.block][], or modified using [vash.helpers.append][] and [vash.helpers.prepend][].

	vash.helpers.block(name, cb)

If `cb` is defined, then it becomes default content for the block. The eventual contents of the block can still be overridden by a subsequent call to [vash.helpers.block][] using the same `name` value, either within the current template (silly) or in a template that extends this one using [vash.helpers.extend][]. If [vash.helpers.append][] or [vash.helpers.prepend][] are later called, their content is _added_ to the content defined in `cb`.

	@html.block('main', function(model){
		<p>Hello, I'm default content. It's nice to meet you.</p>
	})

_Tech note: due to the way JS scoping works, the `model` parameter of the `cb` function must be explicitely defined as above if it is referenced in the content. This may change in a future version of Vash._


<a name="vash-helpers-append"></a>vash.helpers.append 
---------------------------

	vash.helpers.append(name, cb)

[vash.helpers.append][] is a way to control the content of a block from within an extending template. In this way, it allows templates to invert control over content "above" them.

An example is a navigation area. Perhaps there is a default navigation list that templates can add to:

	// layout.vash
	<ul>
	@html.block('main-nav', function(model){
		<li><a href="/">Home</a></li>
	})
	</ul>

	// another.vash
	@html.extend('layout', function(model){
		@html.append('main-nav', function(){
			<li><a href="/another">Another Link</a></li>
		})
	})

This would output when fully rendered:

	<li><a href="/">Home</a></li>
	<li><a href="/another">Another Link</a></li>

_Tech note: due to the way JS scoping works, the `model` parameter of the `cb` function must be explicitely defined as above if it is referenced in the content. This may change in a future version of Vash._


<a name="vash-helpers-prepend"></a>vash.helpers.prepend 
----------------------------

	vash.helpers.prepend(name, cb)

[vash.helpers.prepend][] behaves nearly the same as [vash.helpers.append][] except that it places content at the beginning of a block instead of at the end. The previous example, if `prepend` were substituted for `append`, would render as:

	<li><a href="/another">Another Link</a></li>
	<li><a href="/">Home</a></li>

_Tech note: due to the way JS scoping works, the `model` parameter of the `cb` function must be explicitely defined as above if it is referenced in the content. This may change in a future version of Vash._


<a name="vash-helpers-include"></a>vash.helpers.include 
----------------------------

	vash.helpers.include(name, model)

This grabs the template `name` and executes it using `model` as the... model. [vash.helpers.include][] is used to literally include the contents of another template. It is analogous to a "partial" in other view engines. Except that there is a hidden power here... as included templates share the same "view engine scope" as other templates, and can thus call all of the layout helper functions, and it will _just work_. Thus, a block within an included template can append to a block defined in a parent. It can even use [vash.helpers.extend][]!

<a name="compiled-helpers"></a>Compiled Helpers 
========================

A relatively new feature in Vash (added in 0.6), compiled helpers are a bit meta. They allow a developer to write a helper using Vash syntax instead of the manual buffer API. The below buffer API example `imgfigure` could be rewritten:

	vash.helpers.imgfigure = function(path, caption){
		vash.helpers.imgfigure.figcount = vash.helpers.imgfigure.figcount || 0;
		var figcount = vash.helpers.imgfigure.figcount;
		<figure id="fig-@(figcount++)">
			<img src="@path" alt="@caption" />
			<figcaption>Fig. @figcount: @caption</figcaption>
		</figure>
	}

There are two ways to compile a helper. The first is using [vash.compileHelper][], the second is using [vash(1)][]'s [--helper][] option.

<a name="buffer-api"></a>Buffer API 
==================

Within a helper (not a template), `this` refers to the current `Helpers` instance. Every instance has a `Buffer` that has methods to help easily add, subtract, or mark content put there by the rendering template.

Adding to the buffer:

	vash.helpers.imgfigure = function(path, caption){
		vash.helpers.imgfigure.figcount = vash.helpers.imgfigure.figcount || 0;
		var figcount = vash.helpers.imgfigure.figcount++;
		this.buffer.push('<figure id="fig-' + figcount + '">';
		this.buffer.push('<img src="' + path + '" alt="' + caption + '" />';
		this.buffer.push('<figcaption>Fig.' + figcount + ':' + caption + '</figcaption>';
		this.buffer.push('</figure>');
	}

Here is a more advanced example, which is [contained within Vash](https://github.com/kirbysayshi/vash/blob/master/src/vhelpers.js):

	vash.helpers.highlight = function(lang, cb){

		// context (this) is an instance of Helpers, aka a rendering context

		// mark() returns an internal `Mark` object
		// Use it to easily capture output...
		var startMark = this.buffer.mark();

		// cb() is simply a user-defined function. It could (and should) contain
		// buffer additions, so we call it...
		cb();

		// ... and then use fromMark() to grab the output added by cb().
		var cbOutLines = this.buffer.fromMark(startMark);

		// The internal buffer should now be back to where it was before this
		// helper started, and the output is completely contained within cbOutLines.

		this.buffer.push( '<pre><code>' );

		if( helpers.config.highlighter ){
			this.buffer.push( helpers.config.highlighter(lang, cbOutLines.join('')).value );
		} else {
			this.buffer.push( cbOutLines );
		}

		this.buffer.push( '</code></pre>' );

		// returning is allowed, but could cause surprising effects. A return
		// value will be directly added to the output directly following the above.
	}

A `Mark` is effectively a placeholder that can be used to literally mark the rendered content, and later do something with that mark. Possibilities include inserting content at the mark, deleting content that follows a mark, and more. It is an internal constructor that is only ever created through the `Buffer#mark` method within a helper. Examples of `Mark` usage can be found in the [layout helpers code][].

[layout helpers code]: https://github.com/kirbysayshi/vash/blob/master/src/vhelpers.layout.js

TODO: Explain the Buffer methods:

* mark
* fromMark
* spliceMark
* empty
* push
* pushConcat
* indexOf
* lastIndexOf
* splice
* index
* flush
* toString
* toHtmlString

<a name="precompiling-templates"></a>Precompiling Templates 
==============================

To save both processing time (compiling templates is not trivial) as well as bandwidth (no need to send the whole compiler to the client), Vash supports precompilation of templates. Any template that Vash compiles is given a method called `toClientString`. This method returns a string that can either be `eval`ed or sent to a remote client. For example:

	<p>Hello</p>

Compiles to a function:

	function anonymous(model,html,__vopts,vash) {
		var __vbuffer = html.buffer;
		html.options = __vopts;
		model = model || {};
		__vbuffer.push('<p></p>\n');
		(__vopts && __vopts.onRenderEnd && __vopts.onRenderEnd(null, html));
		return (__vopts && __vopts.asContext)
			? html
			: html.toString();
	}

If `toClientString` is called on that function, the following is returned:

	vash.link( function anonymous(model,html,__vopts,vash) {
		var __vbuffer = html.buffer;
		html.options = __vopts;
		model = model || {};
		__vbuffer.push('<p></p>\n');
		(__vopts && __vopts.onRenderEnd && __vopts.onRenderEnd(null, html));
		return (__vopts && __vopts.asContext)
			? html
			: html.toString();
	}, {"simple":false,"modelName":"model","helpersName":"html"} )

This string could then be sent to the client (probably prefixed with something like `TPLCACHE["name-of-template"] = `). [vash(1)][] helps to automate this easily.

Note: this assumes that `vash` is available globally. A future version of Vash will hopefully remove this assumption.

<a name="vash-runtime-browser"></a>Vash Runtime (Browser) 
====================

The Vash runtime is a set of functions that every executing template expects to be available. The runtime is automatically packaged with full Vash builds. However, if only precompiled templates are sent to the browser, then only the runtime must be sent. The runtime includes all helpers and a few standard functions, such as [HTML Escaping][].

There are two runtime builds:

* [vash-runtime.js][]: This is the basic runtime. It contains everything a standard Vash template needs to execute.
* [vash-runtime-all.js][]: This also includes the [Layout Helpers][]. It is roughly twice as large as `vash-runtime.js`. Unless you're using the Vash view system in the browser, this is probably not necessary.

If you're in a Browserify-like environemnt, you should be able to:

```js
var vashruntime = require('vash/runtime');
```

..and have access to the [Runtime API][].

[vash-runtime.js]: https://github.com/kirbysayshi/vash/blob/master/build/vash-runtime.js
[vash-runtime-all.js]: https://github.com/kirbysayshi/vash/blob/master/build/vash-runtime-all.js

<a name="compile-time-api"></a>Compile-time API 
=============

<a name="vash-compile"></a>vash.compile 
-----------------------------------------------

	vash.compile(str_template, opt_options) -> Function

At its core, Vash has a `compile` function that accepts a string and options, and returns a function, otherwise known as a compiled template. That function, when called with a parameter (otherwise known as a _model_), will use that parameter to fill in the template. A model can be any value, including `undefined`, objects, arrays, strings, and booleans.

<a name="vash-compilehelper"></a>vash.compileHelper 
-----------------------------------------------------

	vash.compileHelper(str_template, opt_options) -> Object

See [Compiled Helpers][] for more detail.

<a name="vash-compilebatch"></a>vash.compileBatch 
----------------------------------------------------

	vash.compileBatch(str_template, opt_options) -> Object

This function can take a single string containing many named templates, and output an object containing the compiled versions of those templates. A "named template" is of the form (similar to a `sourceURL`):

	//@batch = div
	<div>@model</div>\n'

	//@batch = a
	<a>@model</a>'

This example contains two named templates, "div" and "a". If this example were passed as a single string to `compileBatch`:

	var tpls = vash.compileBatch(theTplString);

One could be called:

	tpls.div('yes!');
	// returns: <div>yes!</div>

This is meant as a convenience function for developers. Putting each template in a separate file can get old, especially if a template is small. Instead, templates can be grouped together. The object returned also has a custom `toClientString` function, which serializes each template in the object automatically.

Aside from the newline following the "name" of the template, whitespace is ignored:

	//@              batch = div
	//@batch=div
	//         @batch =div

Each is treated the same.

<a name="runtime-api"></a>Runtime API 
===================

<a name="vash-link"></a>vash.link 
---------------------------------------------------------

	vash.link(str_tpl, options) -> Function
	vash.link(func_tpl, options) -> Function

This is primarily an internal function, and has relatively complex behavioral differences depending on what options are passed in. It takes either a decompiled string function or function instance and "links" it by wrapping it in a closure that provides access to Vash's runtime functions. It also sets up things like `toClientString` and `toString`. It makes precompiled functions possible. As a developer working on Vash, it's best to take a look at the [source itself][].

[source itself]: https://github.com/kirbysayshi/vash/blob/master/src/vruntime.js

<a name="vash-lookup"></a>vash.lookup 
-------------------

	vash.lookup(str_path) -> Function

Attempts to grab a template from `vash.helpers.tplcache[str_path]`, and throws an exception if it is not found.

	vash.lookup(str_path, model) -> Function

If `model` is passed and the template is found, the template is automatically executed and returned using `model` as the model.

<a name="vash-install"></a>vash.install 
--------------------

`vash.install` accepts a few signatures:

	vash.install(str_path, func_tpl) -> func_tpl

"Saves" the template at `vash.helpers.tplcache[str_path]`.

	vash.install(str_path, str_tpl) -> func_tpl

If `vash.compile` is available (meaning the entire compiler is available, not just the runtime), then the string is automatically compiled. and saved at `vash.helpers.tplcache[str_path]`.

	vash.install(obj) -> obj

If an object containing string keys pointing at template functions is passed, then the object's keys are used as the keys for `vash.helpers.tplcache`. This is especially useful when using [vash.compileBatch][], as the result can be directly passed.

<a name="vash-uninstall"></a>vash.uninstall 
----------------------

	vash.uninstall(str_path) -> bool

Deletes the key named `str_path` from `vash.helpers.tplcache`.

	vash.uninstall(func_tpl) -> bool

Loops through all templates in `vash.helpers.tplcache`, and if a strict equality is successful, deletes that reference.

<a name="vash-1"></a>vash(1) 
===============

Vash also includes a commandline tool that enables easy integration of templates into a unix toolchain. For example, to compile this documentation, the following command is used:

	bin/vash <README2.vash --render --helpers <(bin/vash <docs/helpers/* --helper) > README2.md

This first grabs all files in `docs/helpers/`, and compiles them as Vash helpers using the [--helper][] option. These compiled helpers are then fed via a temporary named pipe into the `--helpers` option, which accepts a file. This option user the file (temporary, in this case) as helpers, and they are added to the rendering context's prototype (see [Helper System][]. Next, `README2.vash` is fed into [vash(1)][], which is told to both compile the input as a template, and render it immediately, using the `--render` option. Granted, this is not how bash actually handles it, but this explanation will suffice.

In short, this loads and compiles helpers necessary for this document, grabs the file, and renders the whole thing as plain markdown.

`vash(1)` has many options:

    -h, --help                          output usage information
    -t, --target-namespace <namespace>  Assign template to a <namespace>. Recommended is `vash.helpers.tplcache` for view engine compatibility
    -p, --property-name [name]          Assign template to property named [name]. Defaults to filename, and requires --target-namespace.
    -f, --file <file>                   Compile the template in <file>
    -j, --json <json>                   Pass options to the Vash compiler. See docs for valid options.
    -o, --out <path>                    Write template into <path> directory
    -u, --uglify                        Uglify the template, safely
    -a, --no-autolink                   Wrap each template in `vash.link`.
    -r, --render [json]                 Render the template using [json] as the model. If [json] is not valid json, assume a filename and load those contents as json.
    -s, --separator [separator]         Templates are auto-named by concatenating the file path with [separator]
    --helper                            Assume the input is a to-be-compiled helper
    --helpers <file>                    Execute these compiled helpers

Some of the options are explained in greater detail below.

<a name="installation"></a>Installation 
--------------------

[vash(1)][] comes with Vash, so it will always be within `node_modules/vash/bin/`. However, a global install is also supported, which can be accomplished via:

	npm install -g vash

<a name="vash1--target-namespace"></a>--target-namespace 
---------------------------------------------------

Assigns the compiled template to a specific "namespace". This value only supports simple namespaces, such as `blah.who.what.something`.

Using this option while piping into [vash(1)][] __REQUIRES__ [--property-name][] to also be specified.

Example:

	$ echo 'function(){}' | bin/vash \
	--target-namespace "vash.helpers.tplcache" \
	--property-name 'myTpl'

	vash = vash || {};
	vash.helpers = vash.helpers || {};
	vash.helpers.tplcache = vash.helpers.tplcache || {};
	vash.helpers.tplcache["myTpl"]=vash.link( ... )

<a name="vash1--property-name"></a>--property-name 
-----------------------------------------------

Specifies what name to use when assigning the compiled template. Defaults to the filename specified with `--file`. If content is piped into [vash(1)][], then this option is __MANDATORY__.

<a name="vash1--helper"></a>--helper 
----------------

This instructs [vash(1)][] to call [vash.compileHelper][] instead of [vash.compile][], and assumes the input is a template that is meant to be a compiled helper.

An empty helper:

	$ echo 'vash.helpers.who = function(){}' | bin/vash --helper --json '{"debug":false}'

	vash.link( function anonymous() {
	var __vbuffer = this.buffer;
	var model = this.model;
	var html = this;
	{}
	}, {"simple":false,"modelName":"model","helpersName":"html","args":[""],"asHelper":"who"} )

And without `--helper`, `vash(1)` just outputs an empty template:

	$ echo 'vash.helpers.who = function(){}' | bin/vash --json '{"debug":false}'

	vash.link( function anonymous(model,html,__vopts,vash) {
	var __vbuffer = html.buffer;
	html.options = __vopts;
	model = model || {};
	__vbuffer.push('vash.helpers.who = function(){}\n');
	(__vopts && __vopts.onRenderEnd && __vopts.onRenderEnd(null, html));
	return (__vopts && __vopts.asContext)
	  ? html
	  : html.toString();
	}, {"simple":false,"modelName":"model","helpersName":"html"} )

<a name="contributing-building"></a>Contributing / Building 
====================

Please see [CONTRIBUTING.md][]. In general, if you want something that Vash doesn't have, file a ticket. Pull Requests are also _always_ welcome!

[CONTRIBUTING.md]: https://github.com/kirbysayshi/vash/CONTRIBUTING.md

<a name="getting-help"></a>Getting Help 
====================

File a ticket! Or hit me up on Twitter: @KirbySaysHi

<a name="special-thanks"></a>Special Thanks 
======================

Extreme thanks goes to TJ Holowaychuck and his template engine [Jade](http://jade-lang.com). It was the original inspiration for Vash's lexer, [Layout Helpers][], and error reporting, and has been a constant source of inspiration and motivation.

Some of the techniques Vash's compiler uses were directly inspired from [doT](https://github.com/olado/doT).

Dev doc styling (gfm.css) from https://gist.github.com/andyferra/2554919.

And of course to Vash's [contributors][].

[contributors]: https://github.com/kirbysayshi/vash/AUTHORS

<a name="license"></a>License 
===============

[MIT](https://github.com/kirbysayshi/vash/LICENSE)

[Features]: #features
[Syntax Example]: #syntax-example
[Quick Start]: #quick-start
[nodejs]: #nodejs
[express]: #express
[Browser - Vanilla]: #browser---vanilla
[Browser - Browserify et al]: #browser---browserify-et-al
[Browser - RequireJS]: #browser---requirejs
[Playground]: #playground
[Syntax]: #syntax
[The Transition Character: @]: #the-transition-character
[Expressions]: #expressions
[Advanced Expressions]: #advanced-expressions
[Explicit Expressions]: #explicit-expressions
[Code Blocks]: #code-blocks
[Keyword Blocks]: #keyword-blocks
[Comments]: #comments
[HTML Escaping]: #html-escaping
[Explicit Markup]: #explicit-markup
[Configuration]: #configuration
[vash.config.useWith]: #vash-config-usewith
[vash.config.modelName]: #vash-config-modelname
[vash.config.helpersName]: #vash-config-helpersname
[vash.config.htmlEscape]: #vash-config-htmlescape
[vash.config.debug]: #vash-config-debug
[vash.config.debugParser]: #vash-config-debugparser
[vash.config.debugCompiler]: #vash-config-debugcompiler
[vash.config.simple]: #vash-config-simple
[vash.config.favorText]: #vash-config-favortext
[Template Options]: #template-options
[asContext]: #ascontext
[onRenderEnd]: #onrenderend
[Helper System]: #helper-system
[Built-in Helpers]: #built-in-helpers
[vash.helpers.raw]: #vash-helpers-raw
[vash.helpers.escape]: #vash-helpers-escape
[vash.helpers.tplcache]: #vash-helpers-tplcache
[Layout Helpers]: #layout-helpers
[vash.helpers.extend]: #vash-helpers-extend
[vash.helpers.block]: #vash-helpers-block
[vash.helpers.append]: #vash-helpers-append
[vash.helpers.prepend]: #vash-helpers-prepend
[vash.helpers.include]: #vash-helpers-include
[Compiled Helpers]: #compiled-helpers
[Buffer API]: #buffer-api
[Precompiling Templates]: #precompiling-templates
[Vash Runtime (Browser)]: #vash-runtime-browser
[Compile-time API]: #compile-time-api
[vash.compile]: #vash-compile
[vash.compileHelper]: #vash-compilehelper
[vash.compileBatch]: #vash-compilebatch
[Runtime API]: #runtime-api
[vash.link]: #vash-link
[vash.lookup]: #vash-lookup
[vash.install]: #vash-install
[vash.uninstall]: #vash-uninstall
[vash(1)]: #vash-1
[Installation]: #installation
[--target-namespace]: #vash1--target-namespace
[--property-name]: #vash1--property-name
[--helper]: #vash1--helper
[Contributing / Building]: #contributing-building
[Getting Help]: #getting-help
[Special Thanks]: #special-thanks
[License]: #license


<hr /><ol class="footnotes">
	<li id="fn:razor-ms">
			 Razor syntax was developed at Microsoft, and typically refers to their Razor View Engine, which ships with ASP.NET MVC 3 and above. In this document, "Razor" will refer to the Razor View Engine, while "syntax" or "Vash syntax" refers to Vash's implementation.
 <a rev="footnote" href="#fnref:razor-ms">&#8617;</a>
		</li>

<li id="fn:this-doc">
			 This document starts off as a [Vash template][] that is then compiled and rendered via [vash(1)][] into markdown! It uses several custom helpers that are not shipped with Vash, but are of course available [for perusal][]. They include things like these footnotes and an autogenerated and linked table of contents.
 <a rev="footnote" href="#fnref:this-doc">&#8617;</a>
		</li>


	</ol>

[Vash template]: https://github.com/kirbysayshi/vash/README.vash
[for perusal]: https://github.com/kirbysayshi/vash/docs/helpers/md.vash
