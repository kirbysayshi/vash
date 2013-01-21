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

	'default runtime helpers': {

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

			var actual = vm.runInNewContext( client, { vash: vruntime } );

			assert.ok( actual.indexOf('fnref:one') > -1, 'expect indexOf fnref:one to be > -1' );
			assert.ok( actual.indexOf('fnref:two') > -1, 'expect indexOf fnref:two to be > -1' );
		}
	}

}).export(module)