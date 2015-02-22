var vows = require('vows')
	,assert = require('assert')
	,util = require('util')
	,path = require('path')
	,vm = require('vm')

	,vash = require( process.env.VASHPATH )
	,vruntime = require( process.env.VASHRUNTIMEPATH )

vash.config.useWith = false;
vash.config.debug = false;

require(path.join(path.dirname(process.env.VASHRUNTIMEPATH), 'lib', 'helpers'));

vows.describe('vash templating library runtime').addBatch({

	// TODO:
	/*'requiring': {
		'does not expose global': function() {
			var ctx = {};
			vm.runInNewContext( 'var vash = require("vash/runtime")', ctx );
			assert.equal(ctx.vash, undefined);
		}

		,'does not have full vash': function() {
			assert.equal(vruntime.compile, undefined);
		}
	}

	,*/'default runtime helpers': {

		'highlight': {
			topic: "@html.highlight('javascript', function(){<text>I am code</text>})"
			,'wraps with <pre><code>': function( topic ){
				var tpl = vash.compile( topic );
				assert.equal( tpl(), '<pre><code>I am code</code></pre>' );
			}
		}
	}

	,'decompilation': {

		topic: function(){
			var str = '<p></p>';
			return vash.compile( str, { debug: false, useWith: false } );
		}

		,'of a linked function returns the generated function': function( tpl ){

			var  test = 'function anonymous(model,html,__vopts'
				,result = tpl.toString().indexOf(test);
			assert.strictEqual( result, 0, test )
		}

		,'using .toClientString returns vash.link': function( tpl ){

			var result = tpl.toClientString().match(/^vash\.link\(/g);
			assert.equal( ( result || [''] )[0], 'vash.link(' )
		}

		,'followed by relinking renders': function( tpl ){

			var  client = tpl.toClientString() + '()'
				,actual = vm.runInNewContext( client, { vash: vruntime } );

			assert.equal( actual.toString(), tpl().toString() );
		}

		,'.toClientString, vash.link loop disobeys thermodynamics': function( tpl ){
			var  client = tpl.toClientString() + '.toClientString()'
				,actual = vm.runInNewContext( client, { vash: vruntime } );

			assert.equal( actual, tpl.toClientString() );
		}
	}

	,'installation': {

		topic: ''

		,'uninstalling removes': function(){
			var  str = '<p></p>'
				,tpl = vash.compile(str);

			vash.install('testpath', tpl);

			assert.equal( vash.lookup('testpath')(), str );
			vash.uninstall('testpath');
			assert.throws( function(){
				vash.lookup('testpath');
			}, (/Could not find template: testpath/))
		}

		,'installing with string auto-compiles': function(){

			// Trick the runtime into thinking it's the full thing.
			vruntime.compile = vash.compile;
			vruntime.compileBatch = vash.compileBatch;
			vruntime.compileHelper = vash.compileHelper;

			var  str = '<p></p>'
				,tpl = vash.install('testpath', str);

			delete vruntime.compile;
			delete vruntime.compileBatch;
			delete vruntime.compileHelper;

			assert.equal( tpl(), str );
		}

		,'installing with object installs each separately': function(){
			var  p = '<p></p>'
				,li = '<li></li>'
				,obj = {
					 p: vash.compile(p)
					,li: vash.compile(li)
				}
				,tpl = vash.install(obj);

			assert.equal( vash.lookup('p')(), p );
			assert.equal( vash.lookup('li')(), li );

			vash.uninstall('p');
			vash.uninstall('li');
		}

		,'installing with string throws if only runtime': function(){
			var str = 'vash.install("testpath", "<p></p>")'

			assert.throws(function(){
				vm.runInNewContext( str, { vash: vruntime } );
			}, (/not available/g));
		}

		,'lookup can execute with model': function(){
			var  str = '<p>@model.what</p>'
				,tpl = vash.compile(str);

			vash.install('testpath', tpl);
			assert.equal( vash.lookup('testpath', { what: 'how' }), '<p>how</p>' );
			vash.uninstall('testpath');
		}
	}

	,'compiled helpers': {

		topic: 'vash.helpers.fn = function(id, ctn){'
			+ 'this.fnCounter = this.fnCounter || 0;'
			+ 'this.fnIds = this.fnIds || {};'
			+ 'this.fnCtn = this.fnCtn || {};'
			+ '  if(ctn){'
			+ '    <li id="fn:@id">'
			+ '      @ctn()'
			+ '      <a rev="footnote" href="#fnref:@id">↩</a>'
			+ '  	</li>'
			+ '  } else {'
			+ '    this.fnIds[id] = ++this.fnCounter;'
			+ '    <sup id="fnref:@id">'
			+ '    <a rel="footnote" href="#fn:@id">@html.raw(this.fnCounter)</a>'
			+ '    </sup>'
			+ '  }'
			+ '}'

		,'can be decompiled and relinked': function(topic){

			vash.compileHelper(topic);
			assert.ok( vash.helpers.fn );

			var  str = vash.compile('@html.fn("one") @html.fn("two")').toClientString() + '()'
				,client = vash.helpers.fn.toClientString() + '; \n' + str
				,ctx = { vash: vruntime }

			var actual = vm.runInNewContext( client, ctx );

			assert.ok( actual.indexOf('fnref:one') > -1, 'expect indexOf fnref:one to be > -1' );
			assert.ok( actual.indexOf('fnref:two') > -1, 'expect indexOf fnref:two to be > -1' );
			assert.equal( ctx.fnCtn, undefined, 'expect `this` within helper to be instance' );
		}
	}

	,'runtime error reporting': {

		// "marked line" == line with the >
		// "reported line" == line with code as reported
		// "actual line" == the true/actual source code index

		// NOTE: lineIndexOf only works assuming that the entire test tpl can
		// fit in the "context" of the error message. That means the error
		// must exist within the first 3 lines of the template

		topic: function(){

			// Trick the runtime into thinking it's the full thing.
			vruntime.compile = vash.compile;
			vruntime.compileBatch = vash.compileBatch;
			vruntime.compileHelper = vash.compileHelper;
			vruntime.config = vash.config;

			return {

				getError: function(str, model){
					var tpl = vash.compile(str, { debug: true });
					model = model || {};
					model.settings = model.settings || {};
					model.settings.views = __dirname + '/../fixtures/views/';
					model.settings['view engine'] = 'vash';
					try {
						tpl(model);
					} catch(e) {
						return e;
					}
				}

				,reMarked: /^\s+>\s+[0-9]+\s\|.*?$/gm

				,lineIndexOf: function(message, text){
					// slice(4) because first four lines are
					// err + line + char
					// original message
					// context:
					//  (newline)
					return message.split('\n').slice(4).reduce(function(prev, curr, i){
						var result = curr.match(text)
						//console.log(prev, curr, result)
						if(result) return i + 1; // 1-based index for "lines"
						else return prev;
					}, -1);
				}

				,assert: function(text, topic, badtext, actualLine){
					var  e = topic.getError(text)
						,marked = topic.lineIndexOf(e.message, topic.reMarked)
						,reported = topic.lineIndexOf(e.message, badtext)

					// when debugging, dumping this is useful to clearly see the mismatch
					// console.log(e.message);

					assert.equal( e.vashlineno, actualLine, 'expected error line ' + actualLine + ', got ' + e.vashlineno );
					assert.equal( marked, e.vashlineno, 'expected marked line ' + e.vashlineno + ', got ' + marked );
					assert.equal( reported, e.vashlineno, 'expected reported line ' + e.vashlineno + ' got ' + reported );
				}
			}
		}

		,'in layout in windows': {
			'reports proper line number': function(topic){
				var  str = "@html.extend('layout', function(model){\r\n\r\n<br/>@model.child.xxx\r\n\r\n})"
				topic.assert(str, topic, '@model', 3);
			}
		}

		,'in layout in unix': {
			'reports proper line number': function(topic){
				var  str = "@html.extend('layout', function(model){\n\n<br/>@model.child.xxx\n\n})"
				topic.assert(str, topic, '@model', 3);
			}
		}

		,'on windows': {
			'reports proper line number': function(topic){
				var str = '\r\n\r\n @who'
				topic.assert(str, topic, '@who', 3);
			}
		}

		,'on unix': {
			'reports proper line number': function(topic){
				var str = '\n\n @who'
				topic.assert(str, topic, '@who', 3);
			}
		}
	}

}).export(module)