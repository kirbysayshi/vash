v0.10.0
=======

* cease support for node 0.8 on Travis.

v0.9.4
=====

* Fix else if. Fix #91
* Allow `@{ @(exp) }` again. Fixes #89

v0.9.3
=====

* Track next non whitespace or newline character. fix #82

v0.9.2
=====

* Allow two-letter tlds for email addresses. #80

v0.9.1
=====

* Throw errors when attempting to close known void tags. #67

v0.9.0
=====

* BREAKING: enforce closing tags. #77

v0.8.8
=====

* Ensure html comments are closed properly. #77

v0.8.7
=====

* Handle html comments. #70

v0.8.6
=====

* Handle markup nodes that lose their content. #68

v0.8.5
=====

* Ensure .name is present on node ctors. #73

v0.8.4
=====

* dashes within tag names are ok. fix #71

v0.8.2
=====

* remove deprecation warnings. apparently razor allows that. #59, #62

v0.8.1
======

* Reinstate `__express`
* Quoted attribute values containing a `=` were causing the current attribute to prematurely be closed when parsing.

v0.8.0
======

* Complete rewrite of parser and compiler (codegen)
* Restructure files to use CJS
* Fix numerous "unfixable" bugs
* Runtime is now `require('vash/runtime')`
* No longer provide minified builds (assume consumer will)
* Simplify build system to be npm-driven
* [`debug`](https://github.com/visionmedia/debug) module used throughout lexer/parser/codegen
* Completely new AST format
* Markup parsing is now more strict, and vash knows about attributes, quotes, etc
* Much more internally.

v0.7.4-19 / 05-21-2013
======================

* `@` inside of string or comments within code block is now literal

v0.7.0-35 / 04-30-2013
========================

* New build system using make
* Revamped documentation

v0.6.5-2648 / 04-11-2013
========================

* More strict open html tag regex

v0.6.4-2631 / 04-08-2013
========================

* Fixed error reporting on windows
* Better errors when using layouts

v0.6.3-2484 / 03-04-2013
========================

* vQuery.maxSize defaults to 100000 for large templates

v0.6.2-2482 / 03-04-2013
========================

* Improved backslash escaping in content
* Improved escaped quote handling in content
* `Buffer#indexOf`, `Buffer#lastIndexOf` can accept a regex
* `vash.helpers.trim`
* `html.options` within a template are the same options passed to the compiled template (`tpl(model, opts)`)
* Improved handling of void/non-void HTML elements containing expressions
* `vash(1)`: `--helpers` option loads a file of compiled helpers
* Compiled helpers can begin with a newline
* `vash.batch` is now `vash.compileBatch`. `batch` is still a valid alias for now.

v0.6.0-2085 / 01-22-2013
========================

* Commitment to proper semver
* `Buffer#push` no longer auto-concats for the sake of speed
* vash(1) `--render` was misnamed
* `vash.config.simple` allows for optimization of simple templates
* `vash.batch` is now handled at compile time
* `vash.compileHelper` allows for compiled helpers
* `vash.install` can also accept object of key->tpl pairs
* History.md

v0.5.15-1896 / 01-02-2013
=========================

* Perf tests removed, see vash-benchgraph
* `vash.batch` (not documented), `vash.install`, `vash.uninstall`, `vash.lookup`
* Tpl cache is defined in runtime, not layout helpers

v0.5.14-1803 / 12-31-2012
=========================

* Internal `Buffer` now uses prototypes. ~6x faster!

v0.5.13-1800 / 12-18-2012
=========================

* Better AMD guard for runtime and vash.exports. #18
* Runtime is tested separately now. test/vows/*
* No reason to exclude CONTRIBUTING,src,etc from npm

v0.5.12-1773 / 12-17-2012
=========================

* `vash.link` must exist in the runtime, not exports. #18
* Fix CJS guard, #18

v0.5.11-1767 / 12-04-2012
=========================

* Layouts only require 'views' in settings, path.join  #17

v0.5.10-1739 / 12-01-2012
=========================

* Fix "race condition" for deleting blockmarks, #16

v0.5.9-1729 / 11-30-2012
========================

* Layouts use `extend` instead of ES3-reserved word `extends` (#9)
* `vash.helpers` is now a prototype of class `vash.helpers.constructor`
* Internal `Buffer` class
* `vash.link`
* vash(1) `--no-autolink`
* `vash.Mark` class and API
* tpl( model, fn|opts ) signature
* Tpl runtime `option.context`
* `onRenderEnd` callback
* Layout helpers render immediately to "spider"

v0.5.6-1545 / 11-09-2012
========================

* A period does not exit expression mode from within an expression. Fixes #10.
* Mention playground in README
* Layout blocks only allow for one definition callback
* Compiler does string replacement instead of concatenation
* Operators were being mistaken for HTML tags
* Initial layout helpers tests
* `vQuery` is exposed as `vash.vQuery`

v0.5.4-1385 / 11-04-2012
========================

* `reportError` formatting fix for line numbers < 10
* Email addresses are allowed within HTML attributes
* `AT` and `AT_COLON` are no longer discarded by parser

v0.5.4-1294 / 09-20-2012
========================

* Use path module for x-platform. v0.5.3-1294. Addresses #6
* `build.js` is now `tasks` and drives tests
* Test for file extension before appending. Addresses #6

v0.5.3-1272 / 09-19-2012
========================

* Proper tests for `vash.config.favorText`

v0.5.3-1255 / 09-19-2012
========================

* `@:` opens a markup block that is closed by `NEWLINE`
* Parser now takes special care of delimiters when subparsing
* Parser pays no special attention to {} in markup mode
* `vash.helpers.reportError` is used within the compiler

v0.5.2-1239 / 09-18-2012
========================

* CONTRIBUTING.md
* vQuery.maxCheck dumps parse tree if infinite loop detected
* `vash.config.debug` now defaults to `true`
* `vash.config.client` is removed
* vash(1) gets `--render` to immediately render the input template

v0.5.2-1235 / 09-16-2012
========================

* View engine works in browser

v0.5.2-1232 / 09-16-2012
========================

* Fixed quote escaping
* Ship vash(1) via npm
* Error reporting is moved to runtime

v0.5.2-1182 / 09-14-2012
========================

* Jade-like extends/block/append/prepend/include layouts
* `vash.config.favorText` documented
* `vash.config.client` documented
* vash(1) documented
* @* should work in blocks too

v0.5.1-1109 / 09-11-2012
========================

* Express 3 support
* vash(1) command line utility
* `vash.config.client` returns the unlinked compiled function
* Empty brackets (`[]`) following an expression is markup
* jshint headers

v0.5.0-998 / 08-24-2012
=======================

* `favorText` is a compiler-only option and will favor interpreting input as markup instead of code
* Standalone runtime
* New build system: `vash-runtime-all.js` and `vash-runtime.js`
* vQuery can flatten/reconstitute tokens
* `vash.saveAT`, `vash.saveTextTag`

v0.4.5-967 / 08-02-2012
=======================

* Addition of AUTHORS file
* Initial helpers API (`vash.helpers` is accessible via `html` within template)
* `vash.config.helpersName`
* `vash.config.htmlEscape` allows escaping to be turned off, defaults to true
* `vash.raw` becomes `html.raw` and is now performed at runtime.
* `html.escape`
* Compiled functions are now "linked" to create a local reference to Helpers

v0.4.4-926 / 04-24-2012
=======================

* Explicit expression implicitly closes afterwards

v0.4.3-915 / 04-23-2012
=======================

* Lexer tokens are freely defined within main vash closure
* Greatly simplified lexer
* Removed lots of extranous `vQuery` code
* Explicit expressions can be indexed into: `@('what')[0]`
* Whitespace ends a non-explicit expression

v0.4.2-856 / 04-19-2012
=======================

* fix bug where ellipses caused infinite loops
* max depth check on vQuery to prevent lockup during infinite loops

v0.4.1-826 / 04-17-2012
=======================

* HTML escaping / `vash.raw`
* `vash.config.debug`
* `vash.vQuery` replaces VAST
* `vash.config.debugParser`
* `vash.config.debugCompiler`
* Improved runtime error reporting (003bfcd)
* Improved compile-time error reporting (5edfcfa)
* Initial AMD Support

v0.3.1-327 / 03-16-2012
=======================

* keywords can follow a closing brace

v0.3.0-291 / 02-24-2012
=======================

* Anonymous functions
* @()IDENTIFIER consumes IDENTIFIER as markup

v0.2.2 / 08-16-2011
===================

* `vash.tpl` is now `vash.compile` as defacto standard
* Rewrite of parser

v0.2.1-241 / 08-16-2011
=======================

* Initial npm release
* `useWith` defaults to false
* Basic express2 support

v0.0.1 / 07-03-2011
===================

* Project start
