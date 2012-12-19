var vows = require('vows')
	,assert = require('assert')
	,util = require('util')
	,path = require('path')
	,vm = require('vm')

	,program = require('commander')
	,vash = require('../../build/vash')
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

			var result = tpl.toString().match(/^function anonymous\(model,html,__vopts\)/g);
			assert.equal( ( result || [''] )[0], 'function anonymous(model,html,__vopts)' )
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
	}

}).export(module)