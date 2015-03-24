var vows = require('vows')
	,assert = require('assert')
	,util = require('util')
	,path = require('path')
	,vm = require('vm')

	,vash = require( process.env.VASHPATH )
	,vruntime = require( process.env.VASHRUNTIMEPATH )

var copyrtl = require(path.join(path.dirname(process.env.VASHPATH), 'lib', 'util', 'copyrtl'));
require(path.join(path.dirname(process.env.VASHRUNTIMEPATH), 'lib', 'helpers', 'layout'));

vash.config.useWith = false;
vash.config.debug = false;

vows.describe('vash templating library layout').addBatch({

	'express support': {

		'is present via __express': function() {
			assert.ok(vash.__express);
		}
	}

	,'layout helpers':{

		topic: function(){

			this.opts = function(model){
				return copyrtl( model || {}, {
					// mock up express settings
					settings: {
						views: __dirname + '/../fixtures/views',
						'view engine': 'vash'
					}
					,onRenderEnd: function(err, ctx){
						ctx.finishLayout();
					}
				});
			}

			// and this is how you mock the template cache...
			this.installTplAt = function( filename, str ){
				var opts = this.opts( { cache: true } )
					,base = opts.settings.views
					,p = path.join( base, filename )

				vash.helpers.tplcache[ p ] = vash.compile( str );
				return p;
			}

			this.uninstallTplAt = function( filename ){
				return delete vash.helpers.tplcache[ filename ];
			}

			return this.opts;
		}

		,'p': {
			topic: function(opts){
				vash.loadFile( 'p', opts(), this.callback );
			}

			,'renders': function( err, tpl ){
				assert.equal( tpl( this.opts({ a: 'a' }) ), '<p>a</p>' )
			}
		}

		,'includes': {

			topic: function(opts){
				vash.loadFile( 'list', opts(), this.callback );
			}

			,'renders': function( err, tpl ){
				var actual = tpl( this.opts({ count: 2 }) );

				assert.equal( actual, '<ul><li>a</li><li>a</li></ul>' )
			}

			,'containing redefining block redefines': function( err, tpl ){

				var  parentPath = this.installTplAt( 'parent.vash', '@html.block("c", function(){<p></p>})@html.include("included")' )
					,includedPath = this.installTplAt( 'included.vash', '@html.block("c", function(){<span></span>})' )

					,parent = vash.helpers.tplcache[ parentPath ]

				var actual = parent( this.opts({ cache: true }) );

				assert.equal( actual, '<span></span>' )

				this.uninstallTplAt( parentPath )
				this.uninstallTplAt( includedPath )
			}

			,'given unique model renders': function( err, tpl ){

				var  t = this.installTplAt( 'something/t.vash', '@html.include("something/i.vash", { u: "u" })' )
					,i = this.installTplAt( 'something/i.vash', '<p>@model.u</p>' )

					,opts = this.opts({ cache: true })

				assert.equal( vash.helpers.tplcache[ t ]( opts ), '<p>u</p>' )
			}
		}

		,'block': {

			topic: function(opts){
				return function(before, inner, after){
					before = before || '';
					after = after || '';
					return vash.compile(
						before
						+ '@html.block("main"' + ( inner ? ', function(model){' + inner + '}' : '' ) + ')'
						+ after
					)
				}
			}

			,'renders blank': function( maker ){
				assert.equal( maker()( this.opts() ), '' );
			}

			,'renders replace': function( maker ){
				var ctn = '<p></p>'
					,before = '@html.block("main", function(){' + ctn + '})'

					,actual = maker(before, '', '')( this.opts());

				assert.equal( actual, ctn );
			}

			,'subsequent blocks redefine': function( maker ){
				var ctnA = '<p></p>'
					,ctnB = '<a></a>'
					,before = '@html.block("main", function(){' + ctnA + '})'
						+ '@html.block("main", function(){' + ctnB + '})'

					,actual = maker(before, '', '')( this.opts() );

				assert.equal( actual, ctnB );
			}

			,'renders default content': function( maker ){
				var ctn = '<p></p>'

					,actual = maker('', ctn, '')( this.opts() );

				assert.equal( actual, ctn );
			}
		}

		,'extend': {

			topic: function(opts){
				return function(inner){
					return vash.compile('@html.extend("layout", function(){' + inner + '})');
				}
			}

			,'renders blank': function( maker ){
				assert.equal( maker('')( this.opts() ), '' )
			}

			,'renders expression': function( maker ){
				var actual = maker('')( this.opts({ title: 'is title' }) )
				//console.log('actual', actual)
				assert.equal( actual, 'is title' )
			}

			,'renders content block': function( maker ){
				var block = '@html.block("content", function(model){<p>@model.a</p>})'
				assert.equal( maker(block)( this.opts({ a: 'a' }) ), '<p>a</p>' )
			}

			,'renders content block with include': function( maker ){
				var block = '@html.block("content", function(model){@html.include("p")<p>@model.a</p>})'
				assert.equal( maker(block)( this.opts({ a: 'a' }) ), '<p>a</p><p>a</p>' )
			}

			,'renders content block with multiple include': function( maker ){
				var  incp = '@html.include("p")'
					,mb = '<p>@model.b</p>'
					,block = '@html.block("content", function(model){' + incp + mb + incp + mb + '})'

					,actual = maker(block)( this.opts({ a: 'a', b: 'b' }) )

				//console.log( 'actual', actual )
				assert.equal( actual , '<p>a</p><p>b</p><p>a</p><p>b</p>' );
			}

			,'renders include that appends to content block': function( maker ){
				var footer = '@html.block("footer", function(){ <footer></footer> })'
					,include = '@html.include("footerappend")'
					,block = '@html.block("content", function(){ ' + include + ' })'

					,actual = maker( footer + block )( this.opts() );

				//console.log('UNCOMPILED', footer + block + 'END');
				//console.log('FN', maker( footer + block ))
				//console.log('actual', 'START', actual, 'END');
				assert.equal( actual, '<footer></footer><footer2></footer2>' )
			}

			,'renders appended content block': function( maker ){
				var  incp = '@html.include("p")'
					,appf = '@html.append("footer", function(){<footer></footer>})'
					,block = '@html.block("content", function(model){' + incp + appf + incp + '})'

					,outp = '<p>a</p>'

					,opts = this.opts({ a: 'a' })


				var actual = maker(block)( opts )

				//console.log( 'actual', actual )
				assert.equal( actual, outp + outp + '<footer></footer>' );
			}

			,'renders prepended/appended content block': function( maker ){
				var  incp = '@html.include("p")'
					,appf = '@html.append("footer", function(){<app></app>})'
					,pref = '@html.prepend("footer", function(){<pre></pre>})'
					,block = '@html.block("content", function(model){' + incp + appf + pref + incp + '})'

					,outp = '<p>a</p>'

					,actual = maker(block)( this.opts({ a: 'a' }) )

				//console.log( 'actual', actual )
				assert.equal( actual, outp + outp + '<pre></pre><app></app>' );
			}

			,'subsequent blocks redefine': function( maker ){
				var  ctnA = '<p></p>'
					,ctnB = '<a></a>'
					,block = '@html.block("content", function(){' + ctnA + '})'
						+ '@html.block("content", function(){' + ctnB + '})'

					,actual = maker(block)( this.opts() )

				assert.equal( actual, ctnB );
			}

			,'can handle really long buffers': function( maker ) {

				// Note: this is not as much to handle a long list of items as to
				// ensure that the runtime functions do not exceed the maximum call
				// stack size, which varies per JS engine / platform.
				// See: https://bugzilla.mozilla.org/show_bug.cgi?id=607371
				// and: https://github.com/kirbysayshi/vash/issues/29

				var block = '@html.block("content", function(){'
						+ '@html.include("listitems")'
						+ '})'

				var count = 100000;

				var expected = '';
				for(var i = 0; i < count; i++) {
					expected += '<li>a</li>';
				}

				var actual = maker(block)( this.opts({ count: count }) )

				assert.equal( actual, expected );
			}

			,'deep': {

				topic: function(maker){
					var self = this;

					this.layoutPath = this.installTplAt( 'l.vash',
						"<article>@html.block('content')</article>"
						+ "@html.block('footer', function(){<footer></footer>})" )

					this.extendingPath = this.installTplAt( 'extending.vash',
						"@html.extend('l', function(){"
							+ "<div>"
								+ "@html.block('content', function(){"
									+ "<block></block>"
								+ "})"
							+ "</div>"
						+ "})" )

					return function(before, inner, after){
						before = before || '';
						after = after || '';
						inner = inner || '';
						return vash.compile(
							before
							+ '@html.extend("extending", function(model){' + inner + '})'
							+ after
						)
					}
				}

				,teardown: function(){
					delete vash.helpers.tplcache[ this.layoutPath ];
					delete vash.helpers.tplcache[ this.extendingPath ];
				}

				,'only works on highest block': function( maker ){

					var actual = maker()( this.opts({ cache: true }) );

					assert.equal( actual, '<article><block></block></article><footer></footer>' )
				}

				,'inner wrapped by article': function( maker ){
					var inner = '<inner></inner>'
						,block = '@html.block("content", function(){' + inner + '})'
						,opts = this.opts({ cache: true })
						,actual

					actual = maker( '', block)( opts )

					assert.equal( actual, '<article>' + inner + '</article><footer></footer>' )
				}

				,'blocks only defined in child are ignored': function( maker ){

					var inner = '<inner></inner>'
						,block = '@html.block("inner", function(){' + inner + '})'
						,opts = this.opts({ cache: true })
						,actual

					actual = maker( '', block)( opts )

					assert.equal( actual, '<article><block></block></article><footer></footer>' )
				}

				,'includes can define new blocks if called within a block': function( maker ){

					var name = this.installTplAt( 'i.vash',
						"@html.block('included', function(){<inc></inc>})" );

					var inner = '@html.block("content", function(){@html.include("i")})'
						,tpl = maker( '', inner )

						,actual = tpl( this.opts({cache: true}) )

					assert.equal( actual, '<article><inc></inc></article><footer></footer>')

					delete vash.helpers.tplcache[name];
				}

				,'includes can redefine a block': function( maker ){

					var includedPath = this.installTplAt( 'i.vash', '@html.block("content", function(){ <p></p> })')
						,tpl = vash.compile( '@html.extend("layout",function(){ @html.append("footer", function(){ @html.include("i") }) })' )

					var actual = tpl( this.opts({ cache: true }) )
					assert.equal( actual, '<p></p>' );

					this.uninstallTplAt( includedPath )
				}
			}
		}

		,'extended include': function( opts ){

			// Scenario:
			// A -> index <- included <- B
			//
			//   A         B
			//   |         |
			//   v         |
			//   index     v
			//        included

			var layout = '@html.block(\'bob\')';
			var index = ''
				+ '@html.extend(\'layout\', function(model) {'
					+ '@html.block(\'bob\', function(model) {'
						+ '<h1>Hello from [index.bob]</h1>'
						+ '@html.include(\'templateToInclude\', model)'
						+ '<p></p>'
					+ '})'
				+ '})'
			var include = ''
				+ '@html.extend(\'extendableTemplate\', function(model) {'
					+ '@html.block(\'mary\', function(model) {'
						+ '<h1>Hello from [templateToInclude.mary]</h1>'
					+ '})'
				+ '})'
			var extendable = ''
				+ '<h1>Hello from [extendableTemplate]</h1>'
				+ '@html.block(\'mary\')'

			var a = this.installTplAt('layout.vash', layout);
			var b = this.installTplAt('templateToInclude.vash', include);
			var c = this.installTplAt('extendableTemplate.vash', extendable);

			var opts = this.opts( { cache: true, debug: true })
			var tpl = vash.compile(index, opts);
			var actual = tpl(opts);
			var expected = ''
				+ '<h1>Hello from [index.bob]</h1>'
				+ '<h1>Hello from [extendableTemplate]</h1>'
				+ '<h1>Hello from [templateToInclude.mary]</h1>'
				+ '<p></p>'

			assert.equal(actual, expected);

			this.uninstallTplAt(a);
			this.uninstallTplAt(b);
			this.uninstallTplAt(c);
		}

		,'empty include throws': function() {
			var str = '@html.include("empty.include.vash")';
			var opts = this.opts();
			var tpl = vash.compile(str);
			assert.throws(function() { tpl(opts) }, /Empty or non\-string/g);
		}

		,'empty layout throws': function() {
			var str = '@html.extend("empty.layout.vash")';
			var opts = this.opts();
			var tpl = vash.compile(str);
			assert.throws(function() { tpl(opts) }, /Empty or non\-string/g);
		}

	}

	,'view lookups': {

		topic: function(){

			this.opts = function( viewpath ){
				return {
					settings: {
						views: viewpath,
						'view engine': 'vash'
					}
				}
			}

			return true; // to avoid weird vows async stuff
		}

		,'with extension and engine': function(){
			var path = __dirname + '/../fixtures/views/'
				,opts = this.opts( path )

			vash.loadFile( 'p.vash', opts, function(err, tpl){
				assert.ifError( err );
				assert.equal( tpl(), '<p></p>' )
			})
		}

		,'with extension and not engine': function(){
			var path = __dirname + '/../fixtures/views/'
				,opts = this.opts( path )

			delete opts.settings['view engine'];

			vash.loadFile( 'p.vash', opts, function(err, tpl){
				assert.ifError( err );
				assert.equal( tpl(), '<p></p>' )
			})
		}

		,'without extension and with engine': function(){
			var path = __dirname + '/../fixtures/views/'
				,opts = this.opts( path )

			vash.loadFile( 'p', opts, function(err, tpl){
				assert.ifError( err );
				assert.equal( tpl(), '<p></p>' )
			})
		}

		,'with forward slashes': function( ){
			var path = __dirname + '/../fixtures/views/'

			vash.loadFile( 'p', this.opts( path ), function(err, tpl){
				assert.ifError( err );
				assert.equal( tpl(), '<p></p>' )
			})
		}

		,'with back slashes': function( ){

			// the `path` module normalizes separators based on platform
			// so it's basically impossible to test on non-windows
			if( process.platform === 'win32' ){
				var path = __dirname + '\\..\\fixtures\\views\\'

				vash.loadFile( 'p', this.opts( path ), function(err, tpl){
					assert.ifError( err );
					assert.equal( tpl(), '<p></p>' )
				})
			}
		}
	}

}).export(module)