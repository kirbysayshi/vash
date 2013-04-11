How to Contribute
=================

I welcome any and all ideas and code to Vash. There are a few guidelines to keep in mind:

* Before rewriting major portions of code, open an Issue to discuss it. Someone might be working on what you want already!
* Maintain code style whenever possible: make your code look like the code around it. General syntax rules:
  * Comma-first
  * Keep line length within reason (< 80 chars)
  * Use tabs, not spaces (for now...)

Building Vash
-------------

Simple as:

	$ support/task build

And tests (includes `build` task):

	$ support/task test

If you need to test the minified version of `vash.js`:

	$ support/task test --min

