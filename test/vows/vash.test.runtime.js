var vows = require('vows')
	,assert = require('assert')
	,util = require('util')
	,path = require('path')
	,vm = require('vm')

	,program = require('commander')
	,vash = require( path.join(__dirname, '..', '..', 'build', 'vash') )
	,vruntime

program
	.option('-w, --whichv <filename>', 'Run test suite against [filename]', path.join( __dirname, '../../build/vash-runtime-all.js') )
	.parse( process.argv );

vruntime = require( program.whichv )

vash.config.useWith = false;
vash.config.debug = false;

vows.describe('vash templating library runtime').addBatch({

	'default helpers': {

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

			var  test = 'function anonymous(model,html,__vopts,vash)'
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

		,'batched': function(){
			var str =
				 '@vash.batch("div", function(){<div>@model</div>})'
				+'@vash.batch("a", function(){<a>@model</a>})'

			var  tpl = vash.compile(str)
				,model = 'm';

			assert.equal( tpl(), '' );
			assert.equal( vash.lookup('div')(model), '<div>m</div>' );
			assert.equal( vash.lookup('a')(model), '<a>m</a>' );
		}

		,'vash.batch throws in standalone runtime': function(){

			assert.throws(function(){
				vm.runInNewContext( 'vash.batch()', { vash: vruntime } );
			}, (/has no method ['"]batch['"]/g));
		}

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
			var  str = '<p></p>'
				,tpl = vash.install('testpath', str);

			assert.equal( tpl(), str );
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

}).export(module)