var vows = require('vows')
	,assert = require('assert')
	,util = require('util')
	,path = require('path')
	,vm = require('vm')

	,vash = require( process.env.VASHPATH )

vash.config.useWith = false;
vash.config.debug = true;

var tryCompile = function(str){
	vash.config.useWith = true;
	vash.compile(str); // because we want to see the stupid error
	assert.doesNotThrow( function(){ vash.compile(str) }, Error );

	var ret;

	try {
		ret = vash.compile(str);
	} catch(e){
		ret = function(){};
	}
	vash.config.useWith = false;
	return ret;
};

// SUPER HACK:
var aeToStringVows = assert.AssertionError.prototype.toString;
assert.AssertionError.prototype.toString = function wrapper() {
	// ...Put the default back to get around vows#278 caused by recursively
	// calling itself.
	assert.AssertionError.prototype.toString = Error.prototype.toString;
	var out = aeToStringVows.call(this);
	assert.AssertionError.prototype.toString = wrapper;
	return out;
}

vows.describe('vash templating library').addBatch({

	'a plain text template': {
		topic: function(){
			var tpl = vash.compile('<a href="">this is a <br /> simple template</a>');
			return tpl;
		}
		,'sends back the same plain text': function(topic){
			assert.equal( topic(), '<a href="">this is a <br /> simple template</a>');
		}
	}
	,'during "why are you using a template?"-style idiotic edge-cased interpolation': {
		topic: function(){
			return vash.compile('@i', { htmlEscape: false, useWith: true });
		}
		,'we get 2 from just @i': function(topic){
			assert.equal( topic({ i: 2 }), 2 );
		}
		,'we get <li class="what"></li> from just @i': function(topic){
			assert.equal( topic({ i: '<li class="what"></li>' }), '<li class="what"></li>' );
		}
	}
	,'during simple interpolation': {
		topic: function(){
			var str = '<li class="@className">@itemName</li>';
			//console.log( vash._parse(str) )
			return vash.compile(str, { useWith: true });
		}
		,'we get <li class="blue">the blue item</li>': function(topic){
			//console.log(topic);
			assert.equal(
				topic( {
					className: 'blue'
					,itemName: 'the blue item' } )
				,'<li class="blue">the blue item</li>' );
		}
	}
	,'during simple interpolation with self-closing tags': {
		topic: function(){
			var str = '<img src="@src" alt="github" />';
			//console.log( vash._parse(str) )
			return vash.compile(str, { useWith: true });
		}
		,'we get the full self-closed tag': function(topic){
			//console.log(topic);
			assert.equal(
				topic( { src: 'https://github.com' } )
				,'<img src="https://github.com" alt="github" />' );
		}
	}
	,'property references': {
		topic: function(){
			var str = '<li>@model.name</li>'
			return vash.compile(str, { useWith: true });
		}
		,'are interpolated': function(topic){
			assert.equal( topic({ model: {name: 'what'}}), "<li>what</li>" );
		}
	}
	,'deep property references': {
		topic: function(){
			return '@model.repository.url/tree/@model.payload.ref'
		}
		,'are fine': function(topic){
			var tpl = vash.compile(topic, { useWith: false });
			assert.equal( tpl({ repository: { url: 'URL' }, payload: { ref: 'REF' } }), 'URL/tree/REF' );
		}
	}
	,'property references with whitespace': {
		topic: function(){
			return '@model.actor created a @model.payload'
		}
		,'are not contiguous': function(topic){
			var tpl = vash.compile(topic, { useWith: false });
			assert.equal( tpl({ actor: 'act', payload: 'pay' }), 'act created a pay' );
		}
	}
	,'ellipses': {
		topic: function(){
			return "@(model.payload.desc.substring(0, 4) + '...')";
		}
		,'are not infinite': function(topic){
			var tpl = vash.compile(topic, { useWith: false });
			assert.equal( tpl({ payload: { desc: 'description!!!' } }), 'desc...' );
		}
	}
	,'.. (double dot notation)': {
		topic: function(){
			return "@( false || 1..toString() )";
		}
		,'is valid in expression': function(topic){
			var tpl = vash.compile(topic);
			assert.equal( tpl(), '1' );
		}
	}
	,'for blocks': {
		topic: function(){
			var str = '@for(var i = 0; i < 10; i++){ \n }';
			return vash.compile(str);
		}
		,'output nothing': function(topic){
			assert.equal( topic(), '' );
		}
	}
	,'for blocks and markup': {
		topic: function(){
			var str = "@for(var i = 0; i < 1; i++){ <li class=\"\">list item</li> \n }";
			return vash.compile(str);
		}
		,'output markup': function(topic){
			assert.equal(topic(), '<li class="">list item</li>');
		}
	}
	,'for blocks and markup with interpolation/expression': {
		topic: function(){
			var str = "@for(var i = 0; i < 1; i++){ <li class=\"@i\">list item</li> \n }";
			return vash.compile(str, { useWith: true });
		}
		,'output markup': function(topic){
			assert.equal(topic(), '<li class="0">list item</li>');
		}
	}
	,'for blocks and markup with complex interpolation/expression': {
		topic: function(){
			var str = "@for(var i = 0; i < 1; i++){ <li class=\"@(i % 2 == 0 ? \"blue\" : \"red\")\">list item</li> \n }";
			return vash.compile(str, { useWith: true });
		}
		,'output markup': function(topic){
			assert.equal(topic(), '<li class="blue">list item</li>');
		}
	}
	,'nested for blocks and markup with complex interpolation/expression': {
		topic: function(){
			var str = "@for(var i = 0; i < 1; i++){ for(var j = 0; j < 2; j++) { <li class=\"@(i % 2 == 0 ? \"blue\" : \"red\")\">list item</li> \n } }";
			return vash.compile(str, { useWith: true });
		}
		,'output markup': function(topic){
			assert.equal(topic(), '<li class="blue">list item</li><li class="blue">list item</li>');
		}
	}
	,'nested for blocks on new lines with markup and even more complex interpolation/expressions': {
		topic: function(){
			var str = "@for(var i = 0; i < somearr.length; i++){ \n"
				+ "	<li class=\"@(i % 2 === 0 ? 'even' : 'odd')\">Some element, number @i, value @somearr[i]</li> \n"
				+ "	@for(var j = 0; j < anotherarr.length; j++){"
				+ "		<li class=\"@j-what\">some text, @( (j+2) % 2 === 0 ? 'even' : 'odd' ), value @anotherarr[j]</li> \n"
				+ "	}"
			+ "}";
			return vash.compile(str, { useWith: true });
		}
		,'output markup': function(topic){
			var model = {
				somearr: ['a', 'b']
				,anotherarr: ['z', 'y']
			};

			assert.equal(topic(model), '<li class="even">Some element, number 0, value a</li><li class="0-what">some text, even, value z</li><li class="1-what">some text, odd, value y</li><li class="odd">Some element, number 1, value b</li><li class="0-what">some text, even, value z</li><li class="1-what">some text, odd, value y</li>');
		}
	}
	,'forEach': {
		'and markup with complex interpolation/expression': {
			topic: function(){
				var str = '@model.forEach( function(p){ <li class="@(p.x % 2 == 0 ? \'blue\' : \'red\')">list item</li> })';
				return vash.compile(str);
			}
			,'output markup': function(topic){
				var model = [{ x: 0, y: 1 }];
				assert.equal(topic(model), '<li class="blue">list item</li>');
			}
		}
		,'wrapped in tags': {
			topic: function(){
				var str = '<ul>@model.forEach( function(p){ <li>@p</li> })</ul>';
				return str;
			}
			,'output markup': function(topic){
				var topic = vash.compile(topic);
				var model = ['a', 'b'];
				assert.equal(topic(model), '<ul><li>a</li><li>b</li></ul>');
			}
		}
		,'no whitespace': {
			topic: function(){
				var str = '<ul class="friends">@friends.forEach(function(friend){<li></li>})</ul>';
				return str;
			}
			,'output markup': function(topic){
				var topic = vash.compile(topic, {useWith: true})
					,model = { friends: [ 'a' ] };

				assert.equal( topic(model), '<ul class="friends"><li></li></ul>' );
			}
		}
	}
	,'empty try/catch block': {
		topic: function(){
			var str = "@try { var i = 0; } catch(e){  }";
			return vash.compile(str);
		}
		,'outputs nothing': function(topic){
			assert.equal(topic(), '')
		}
	}
	,'when try/catch block throws exception': {
		topic: function(){
			var str = "@try { throw new Error('error') } catch(e){ <li>list item</li> \n }";
			return vash.compile(str);
		}
		,'catch block outputs markup': function(topic){
			assert.equal(topic(), '<li>list item</li>')
		}
	}
	,'when try/catch block does not throw exception': {
		topic: function(){
			var str = "@try { <li>list item</li> \n } catch(e){  }";
			return vash.compile(str);
		}
		,'try block outputs markup': function(topic){
			assert.equal(topic(), '<li>list item</li>')
		}
	}
	,'when try/catch/finally block does not throw exception': {
		topic: function(){
			var str = "@try { <li>list item</li> \n } catch(e){  } finally{ <li>list item 2</li> \n }";
			return vash.compile(str);
		}
		,'try block outputs markup': function(topic){
			assert.equal(topic(), '<li>list item</li><li>list item 2</li>')
		}
	}
	,'simple expression': {
		topic: function(){
			var str = '<a href="@(true)"></a>';
			return vash.compile(str);
		}
		,'outputs true': function(topic){
			assert.equal(topic(), '<a href="true"></a>');
		}
	}
	,'simple expression with valid identifier following': {
		topic: function(){
			var str = '<a href="@(true)that"></a>';
			return str;
		}
		,'outputs true': function(topic){
			var tpl = tryCompile(topic);
			assert.equal(tpl(), '<a href="truethat"></a>');
		}
	}
	,'expression with nested parenthesis': {
		topic: function(){
			var str = '<a href="@( true == (Math.random() + 1 >= 1 ? true : false) ? "red" : "blue" )"></a>';
			return vash.compile(str);
		}
		,'outputs red': function(topic){
			assert.equal(topic(), '<a href="red"></a>');
		}
	}
	,'expression with indexed properties': {
		topic: function(){
			var str = '<a href="@what.how[0]"></a>';
			return vash.compile(str, { useWith: true });
		}
		,'outputs G': function(topic){
			assert.equal( topic({ what: { how: 'G' }}), '<a href="G"></a>');
		}
	}
	,'expression with indexed properties and method call': {
		topic: function(){
			var str = '<a href="@what.how()[0]"></a>';
			return vash.compile(str, { useWith: true });
		}
		,'outputs G': function(topic){
			assert.equal( topic({ what: { how: function() { return 'G'; } }}), '<a href="G"></a>');
		}
	}
	,'expression with indexed properties and method call with additional property': {
		topic: function(){
			var str = '<a href="@what.how()[0].length"></a>';
			return vash.compile(str, { useWith: true });
		}
		,'outputs 1': function(topic){
			assert.equal( topic({ what: { how: function() { return 'G'; } }}), '<a href="1"></a>');
		}
	}
	,'expression with indexed property followed by valid identifer': {
		topic: function(){
			var str = '<a href="@what[0]yeah"></a>';
			return vash.compile(str, { useWith: true });
		}
		,'outputs 1yeah': function(topic){
			assert.equal( topic({ what: '1'}), '<a href="1yeah"></a>');
		}
	}
	,'explicit expression followed by bracket, @escape': {
		topic: function(){
			var str = '<a href="somename_@(what.how)@[0]"></a>';
			return vash.compile(str, { useWith: true });
		}
		,'uses brackets as markup': function(topic){
			assert.equal( topic({ what: { how: 'yes' }}), '<a href="somename_yes[0]"></a>');
		}
	}
	,'explicit expression followed by bracket': {
		topic: function(){
			var str = '<a href="somename_@(what.how)[0]"></a>';
			return vash.compile(str, { useWith: true });
		}
		,'uses brackets as markup': function(topic){
			assert.equal( topic({ what: { how: 'yes' }}), '<a href="somename_yes[0]"></a>');
		}
	}
	,'expression followed by empty bracket': {
		topic: function(){
			var str = '<a href="somename_@what.how[]"></a>';
			return vash.compile(str, { useWith: true });
		}
		,'uses brackets as markup': function(topic){
			assert.equal( topic({ what: { how: 'yes' }}), '<a href="somename_yes[]"></a>');
		}
	}
	,'explicit expression with parens as immediate child': {
		topic: function(){
			var str = '@((1) > 0)';
			return vash.compile(str);
		}
		,'create a separate explicit expression': function(topic){
			assert.equal(topic(), 'true');
		}
	}

	,'explicit expressions containing quoted characters': {

		topic: function() {

			// For now just include ASCII.
			var UNICODE_MAX = 127; // 1114111;

			// 0-31 are control characters.
			for(var i = 32, chars = []; i <= UNICODE_MAX; i++) {
				chars.push(String.fromCharCode(i));
			}

			return chars;
		}

		,'do not need to be escaped': function(chars){

			var str = chars.map(wrapCharWithExpression).join('');
			var tpl = vash.compile(str, { htmlEscape: false });
			var expected = chars.map(wrapCharWithP);
			assert.equal( tpl(), expected.join('') );

			function wrapCharWithExpression(chr) {
				return '<p>@("' + escapeIfNeeded(chr) + '")</p>\n';
			}

			function wrapCharWithP(chr) {
				return '<p>' + chr + '</p>\n';
			}

			function escapeIfNeeded(chr) {
				if (chr === '"' || chr === '\n' || chr === '\\') return '\\' + chr;
				else return chr;
			}
		}
	}

	,'a parent expression': {

		topic: '@(function() { <p>)</p> }())'

		,'should not consume content PAREN_CLOSE': function(topic) {
			var tpl = vash.compile(topic);
			assert.equal( tpl(), '<p>)</p>' );
		}
	}

	,'a parent block': {

		topic: '@{ function what() { <p>}</p> } }'

		,'should not consume content BRACE_CLOSE': function(topic) {
			var tpl = vash.compile(topic);
			assert.equal( tpl(), '' );
		}
	}

	,'anonymous blocks': {

		'empty,': {
			topic: function(){
				var str = "@{ }";
				return vash.compile(str);
			}
			,'outputs nothing': function(topic){
				assert.equal(topic(), '');
			}
		}
		,'empty, with same-line markup': {
			topic: function(){
				var str = "@{ <li>list item</li> }";
				return vash.compile(str);
			}
			,'outputs markup': function(topic){
				assert.equal(topic(), '<li>list item</li>');
			}
		}
		,'and markup with quotes': {
			topic: function(){
				var str = "@{ <li class=\"1\">list item</li> \n }";
				return vash.compile(str);
			}
			,'outputs markup': function(topic){
				assert.equal(topic(), '<li class="1">list item</li>');
			}
		}
		,'and nested markup': {
			topic: function(){
				var str = "@{ <li class=\"1\">list item</li> @{ <li class=\"2\">list item</li> } }";
				return vash.compile(str);
			}
			,'outputs markup': function(topic){
				assert.equal(topic(), '<li class=\"1\">list item</li><li class=\"2\">list item</li>');
			}
		}
		,'and nested for loop': {
			topic: function(){
				var str = "@{ <li class=\"1\">list item</li> @for(var i = 0; i < 1; i++){ <li class=\"2\">list item</li> } }";
				return vash.compile(str);
			}
			,'outputs markup': function(topic){
				assert.equal( topic(), '<li class=\"1\">list item</li><li class=\"2\">list item</li>' );
			}
		}
		,'and named function defined': {
			topic: function(){
				var str = "@{ <li class=\"1\">list item</li> @function testFunc(param1, param2){ <li class=\"2\">list item</li> } }";
				return vash.compile(str);
			}
			,'outputs non-function defined markup': function(topic){
				assert.equal( topic(), '<li class=\"1\">list item</li>' );
			}
		}
		,'and named function defined and called': {
			topic: function(){
				var str = "@{ <li class=\"1\">list item</li> @function testFunc(param1, param2){ <li class=\"2\">list item</li> \n } testFunc(); \n }";
				return vash.compile(str);
			}
			,'outputs non-function defined markup': function(topic){
				assert.equal( topic(), '<li class=\"1\">list item</li><li class=\"2\">list item</li>' );
			}
		}
		,'and while loop with manual increment': {
			topic: function(){
				var str = "@{ var countNum = 0; while(countNum < 1){ \n countNum += 1; \n <p>Line #@countNum</p> \n } }";
				return vash.compile(str);
			}
			,'outputs 1 line': function(topic){
				assert.equal( topic(), '<p>Line #1</p>');
			}
		}
		,'and while loop with manual increment post': {
			topic: function(){
				var str = "@{ var countNum = 0; while(countNum < 2){ \n countNum += 1; \n <p>Line #@countNum</p> \n countNum += 1; \n } }";
				return vash.compile(str);
			}
			,'outputs 1 line': function(topic){
				assert.equal( topic(), '<p>Line #1</p>');
			}
		}
	}
	,'immediate function invocation within expression': {
		topic: function(){
			var str = '<a>@(false || (function(){ <b>YES</b> })())</a>';
			return vash.compile(str, { debugCompiler: false });
		}
		,'returns properly': function(topic){
			assert.equal( topic(), '<a><b>YES</b></a>' )
		}
	}

	,'array literal within markup': {
		topic: '<a>@["a", "b", "c"].join("")</a>'
		,'outputs': function(topic){
			var tpl = vash.compile(topic);
			assert.equal( tpl(), '<a>abc</a>' );
		}
	}

	,'function invocation within expression buffers': {
		topic: function(){
			var str = '<a>@model.map(function(l){ return "__" + l + "__";  }).forEach(function(l){ <b>@l</b> })</a>';
			return vash.compile(str, { debugCompiler: false });
		}
		,'returns properly': function(topic){
			assert.equal( topic(["a", "b", "c"]), '<a><b>__a__</b><b>__b__</b><b>__c__</b></a>' )
		}
	}
	,'<text> escape': {

		'single line': {

			topic: function(){
				var str = '@if (true) { \n'
					+ '<text>Plain Text</text>\n'
					+ '}';
				return vash.compile(str);
			}
			,'outputs plain text': function(topic){
				assert.equal( topic(), 'Plain Text' );
			}

		}

		,'multiple lines': {

			topic: function(){
				var str = '@if (true) { \n'
					+ '<text>Plain Text \n Plain Text \n</text>\n'
					+ '}';
				return vash.compile(str);
			}
			,'outputs plain text': function(topic){
				assert.equal( topic(), 'Plain Text \n Plain Text \n' );
			}

		}

		,'can be escaped': {
			topic: '@("<text>")More@("</text>")'
			,'with html escaping': function(topic){
				var tpl = vash.compile(topic);
				assert.equal( tpl(), '&lt;text&gt;More&ls;/text&gt;' );
			}
		}

		,'can be escaped': {
			topic: '@html.raw("<text>")More@html.raw("</text>")'
			,'without html escaping': function(topic){
				var tpl = vash.compile(topic);
				assert.equal( tpl(), '<text>More</text>' );
			}
		}
	}

	,'@: escape': {
		'single line': {
			topic: function(){
				var str = '@if (true) { \n'
					+ '@:Plain Text\n'
					+ '}';
				return str;
			}
			,'outputs plain text': function(topic){
				var tpl = vash.compile(topic);
				assert.equal( tpl(), 'Plain Text\n' );
			}
		}
		,'multiple lines': {
			topic: function(){
				var str = '@if (true) { \n'
					+ '@:Plain Text\n'
					+ '@:Plain Text\n'
					+ '}';
				return str;
			}
			,'outputs plain text': function(topic){
				var tpl = vash.compile(topic)
				assert.equal( tpl(), 'Plain Text\nPlain Text\n' );
			}
		}
		,'single line with content on next line': {
			topic: function(){
				var str = '@if (true) { \n'
					+ '@:Plain Text\n'
					+ 'var a = "what";'
					+ '}';
				return str;
			}
			,'throws error': function(topic){
				var tpl = vash.compile(topic);
				assert.equal( tpl(), 'Plain Text\n' );
			}
		}

		,'can be escaped': {
			topic: '<p>@@:</p>'

			,'and is': function(topic){
				var tpl = vash.compile(topic);
				assert.equal( tpl(), '<p>@:</p>' );
			}
		}
	}

	,'markup within a code block': {
		topic: function(){
			var str = '@if(true){ \n'
				+ '<span>this is text \n'
				+ 'that spans multiple lines</span> \n'
				+ '}';
			return str;
		}
		,'disregards newline re-entry into BLK mode': function(topic){
			var tpl = tryCompile(topic);
			assert.equal(tpl(), '<span>this is text \nthat spans multiple lines</span>');
		}
	}
	,'markup within a code block followed by else': {
		topic: function(){
			var str = '@if(true){ \n'
				+ '<span>this is text \n'
				+ 'that spans multiple lines</span> \n'
				+ '} else { \n'
				+ '<span>different text</span> \n'
				+ '}';
			return str;
		}
		,'disregards newline re-entry into BLK mode': function(topic){
			var tpl = tryCompile(topic);
			assert.equal(tpl(), '<span>this is text \nthat spans multiple lines</span>');
		}
	}
	,'markup within a code block with if/else on new lines': {
		topic: '@if(true)\n{\n<strong>Hello</strong>\n}\n    else\n{\n    <strong>World!</strong>\n    }'
		,'outputs': function(topic) {
			var tpl = vash.compile(topic);
			assert.equal(tpl(), '<strong>Hello</strong>');
		}
	}
	,'markup within a code block followed by else with markup': {
		topic: function(){
			var str = '@if(false){ \n'
				+ '<span>this is text \n'
				+ 'that spans multiple lines</span> \n'
				+ '} else { \n'
				+ '<span>different text</span> \n'
				+ '}';
			return str;
		}
		,'disregards newline re-entry into BLK mode': function(topic){
			var tpl = tryCompile(topic);
			assert.equal(tpl(), '<span>different text</span>');
		}
	}
	,'markup within a code block with an expression in the tag name': {
		topic: function(){
			var str = '@if(true){ \n'
				+ '<span-@name>this is text \n'
				+ 'that spans multiple lines</span-@name> \n'
				+ '}';
			return str;
		}
		,'parses': function(topic){

			var tpl = tryCompile(topic);
			assert.equal(tpl({ name: 'what' }), '<span-what>this is text \nthat spans multiple lines</span-what>');
		}
	}
	,'markup within a code block with an expression after the tag name': {
		topic: function(){
			var str = '@if(true){ \n'
				+ '<span-@name>this is text \n'
				+ 'that spans multiple lines</span-@name> \n'
				+ '<span class="@name">this is text \n'
				+ 'that spans multiple lines</span> \n'
				+ '}';
			return str;
		}
		,'parses': function(topic){
			var tpl = tryCompile(topic);
			assert.equal(tpl({ name: 'what' }), '<span-what>this is text \nthat spans multiple lines</span-what><span class="what">this is text \nthat spans multiple lines</span>');
		}
	}
	,'markup within a code block within markup within a code block': {
		topic: function(){
			var str = '@if(true){ \n'
				+ '<span>this is text \n'
				+ '@if(true){ <b>important</b> \n } '
				+ 'that spans multiple lines</span> \n'
				+ '}';
			return str;
		}
		,'nests properly': function(topic){
			var tpl = tryCompile(topic);
			assert.equal(tpl(), '<span>this is text \n<b>important</b> that spans multiple lines</span>');
		}
	}
	,'markup within a code block within markup within a code block with keyword': {
		topic: function(){
			var str = '@if(true){ \n'
				+ '<span>this is text \n'
				+ '@if(true){ <b>delete</b> \n } '
				+ 'that spans multiple lines</span> \n'
				+ '}';
			return str;
		}
		,'nests properly': function(topic){
			var tpl = tryCompile(topic);
			assert.equal(tpl(), '<span>this is text \n<b>delete</b> that spans multiple lines</span>');
		}
	}
	,'markup within markup within a block': {
		topic: function(){
			var str = '@if(true){ <p>This is content that is <strong>important</strong> but outside.</p> }'
			return str;
		}
		,'is consumed by markup, not block': function(topic){
			assert.equal(vash.compile(topic)(), '<p>This is content that is <strong>important</strong> but outside.</p>');
		}
	}
	,'self-closing tag within tag within BLK': {

		topic: '@if(true){ <p>Hello<br />world</p> }'

		,'does not prematurely exit MKP': function(topic){
			var  tpl = vash.compile(topic)
				,expected = '<p>Hello<br />world</p>';

			assert.equal(tpl(), expected);
		}

		,'does not prematurely exit MKP, even without closing /': function(topic){
			var  tpl = vash.compile(topic.replace('<br />', '<br>'))
				,expected = '<p>Hello<br>world</p>';

			assert.equal(tpl(), expected);
		}
	}
	,'self-closing tag within BLK': {

		topic: '@if(true){ <br /> true; }'

		,'exits MKP': function(topic){
			var  tpl = vash.compile(topic)
				,expected = '<br />';

			assert.equal(tpl(), expected);
		}

		,'exits MKP with expression': function(topic){
			var str = topic.replace('/>', '@(true)/>')
			var  tpl = vash.compile(str)
				,expected = '<br true />';

			assert.equal(tpl(), expected);
		}

		/*
		,'exits MKP without closing /': function(topic){
			var  tpl = vash.compile(topic.replace('/>', '>'))
				,expected = '<br >';

			assert.equal(tpl(), expected);
		}*/
	}
	,'if statement is not confused': {

		topic: '@{ if(-1 <= 0){ <br /> } }'

		,'with self-closing tag': function(topic){
			var tpl = vash.compile(topic)
				,expected = '<br />';

			assert.equal(tpl(), expected);
		}
	}
	,'self-closing tag containing >': {

		topic: '<button data-bind="enable: @model.length > 0" />'

		,'compiles and renders': function(topic) {
			var tpl = vash.compile(topic)
				,expected = '<button data-bind="enable: 0 > 0" />';

			assert.equal(tpl([]), expected);
		}
	}

	,'self-closing tag containing > with no whitespace': {

		topic: '<button data-bind="enable:@model.length>0"/>'

		,'compiles and renders': function(topic) {
			var tpl = vash.compile(topic)
				,expected = '<button data-bind="enable:0>0" />';

			assert.equal(tpl([]), expected);
		}
	}

	,'self-closing tag does not grab too much': {

		topic: '@{{<b ></b>}<img />}'

		,'when preceeded by tag with whitespace': function(topic) {
			var tpl = vash.compile(topic)
				, expected = '<b></b><img />'

			assert.equal(tpl(), expected);
		}
	}

	,'markup with numbers': {
		topic: function(){
			var str = "<div>"
				+ "	<h1 class='header'>@header</h1>"
				+ "	<h2 class='header2'>@header2</h2>"
				+ "</div>"
			return str;
		}
		,'is named properly': function(topic){
			assert.equal( vash.compile(topic, { useWith: true })( { header: 'a', header2: 'b' } ),
				'<div>'
				+ '	<h1 class=\'header\'>a</h1>'
				+ '	<h2 class=\'header2\'>b</h2>'
				+ '</div>' );
		}
	}
	,'simple expression as tagname': {
		topic: function(){
			return '<@name>This is content</@name>';
		}
		,'is allowed': function(topic){
			assert.equal( vash.compile(topic, { useWith: true })({name: 'what'}), '<what>This is content</what>' );
		}
	}
	,'simple expression as tagname within block': {
		topic: function(){
			return '@if(true){ <@name>This is content</@name> }';
		}
		,'is allowed': function(topic){
			assert.equal( vash.compile(topic, { useWith: true })({name: 'what'}), '<what>This is content</what>' );
		}
	}
	,'complex expression as tagname': {
		topic: function(){
			return '<@name[0].length>This is content</@name[0].length>';
		}
		,'is allowed': function(topic){
			assert.equal( vash.compile(topic, { useWith: true })({name: 'what'}), '<1>This is content</1>' );
		}
	}
	,'email address': {

		topic: function(){
			return 'some.gr-at%email_address-indeed@complex-domain.subdom.edu'
		}

		,'included as content': {
			topic: function(address){
				return 'Hi ' + address;
			}
			,'does not leave markup mode': function(topic){
				var tpl = vash.compile( topic );
				assert.equal( tpl(), topic );
			}
		}

		,'included within a href': {
			topic: function(address){
				return '<a href="mailto:' + address + '">' + address + '</a>'
			}
			,'is still just an email': function(topic){
				var tpl = vash.compile( topic );
				assert.equal( tpl(), topic );
			}
		}

		,'are not confused with': {
			topic: '@model.title@console.log("")'
			,'concatenated expressions': function( topic ){
				var tpl = vash.compile( topic, { useWith: false } );
				assert.equal( tpl({ title: 'who' }), 'who' );
			}
		}

		,'can have any two-letter tld-ish': {
			topic: 'who@what.de'
			,'and still register': function(topic) {
				var tpl = vash.compile(topic);
				assert.equal(tpl(), topic);
			}
		}
	}
	,'explicit expression': {
		topic: function(){
			var str = '<span>ISBN@(isbnNumber)</span>';
			return vash.compile(str, { useWith: true });
		}
		,'does not trip e-mail escape': function(topic){
			assert.equal( topic({isbnNumber: 10101}), '<span>ISBN10101</span>' )
		}
	}
	,'explicit expression with unmatched parenthesis': {
		topic: function(){
			var str = '<span>ISBN@(isbnNumber</span>';
			return str;
		}
		,'throws syntax error': function(topic){
			assert.throws( function(){ vash.compile(topic) }, Error );
		}
	}
	,'expression with spaces in func call': {
		topic: function(){
			var str = '<span>@a.replace("x", "o")</span>';
			return str;
		}
		,'renders': function(topic){
			assert.equal(vash.compile(topic, { useWith: true })({ a: 'xxx' }), '<span>oxx</span>');
		}
	}

	,'regex': {

		'simple expression': {
			topic: '<span>@a.replace(/\\)a"\'/gi, "o")</span>'
			,'replaces': function( topic ){
				var tpl = vash.compile( topic, { useWith: true } );
				assert.equal( tpl({ a: ')a"\'' }), '<span>o</span>');
			}
		}

		,'period meta character': {
			topic: '<span>@a.replace(/\\)."\'/gi, "o")</span>'
			,'replaces': function( topic ){
				var tpl = vash.compile( topic, { useWith: true } );
				assert.equal( tpl({ a: ')a"\'' }), '<span>o</span>')
			}
		}

		,'within BLK': {
			topic: '@{ var re = /[@}\'"]/gi; }<span>@a.replace(re, "o")</span>'
			,'replaces': function( topic ){
				var tpl = vash.compile( topic, { useWith: true } );
				assert.equal( tpl({ a: '@' }), '<span>o</span>');
			}
		}

		,'within an expression': {
			topic: '@(/a/.exec(\'abc\')[0])'
			,outputs: function( topic ){
				var tpl = vash.compile(topic);
				assert.equal( tpl(), 'a' );
			}
		}

		,'literal': {

			'within markup': {
				topic: '<span>@/a/.test(\'abc\')</span>'
				,outputs: function ( topic ) {
					var tpl = vash.compile(topic);
					assert.equal( tpl(), '<span>true</span>' );
				}
			}

			,'within markup attribute': {
				topic: '<span b="@/a/.exec(\'abc\')[0]"></span>'
				,outputs: function ( topic ) {
					var tpl = vash.compile(topic);
					assert.equal( tpl(), '<span b="a"></span>' );
				}
			}
		}

		,'following conditional': {
			topic: '@if (true) /a/.test(\'abc\')'
			,outputs: function ( topic ) {
				var tpl = vash.compile(topic);
				assert.equal( tpl(), '' );
			}
		}

		,'are not mistaken for': {

			'division expression': {
				topic: '@{ var test = 100/2; }<span>@test</span>'
				,'is not mistaken for regex': function (topic) {
					var tpl = vash.compile(topic);
					assert.equal( tpl({}), '<span>50</span>' );
				}
			}

			,'division within condition': {
				topic: '@{ if(100/2) <span></span> }'
				,'is not mistaken for regex': function (topic) {
					var tpl = vash.compile(topic);
					assert.equal( tpl({}), '<span></span>' );
				}
			}

			,'division after expression': {
				topic: '@(Math.round(20.22) / 100)'
				,'is not mistaken for regex': function (topic) {
					var tpl = vash.compile(topic);
					assert.equal( tpl({}), '0.2' );
				}
			}

			,'division within block': {
				topic: '@{ Math.round(2 * 1) / Number.MAX_VALUE }'
				,'is not mistaken for regex': function (topic) {
					var tpl = vash.compile(topic);
					assert.equal( tpl({}), '' );
				}
			}

		}
	}

	,'escaping the @ symbol': {

		'within content': {
			topic: function(){
				var str = '<span>In vash, you use the @@foo to display the value of foo</span>';
				return vash.compile(str);
			}
			,'leaves just a single @': function(topic){
				assert.equal( topic(), '<span>In vash, you use the @foo to display the value of foo</span>' )
			}
		}

		,'within quoted string in BLK': {
			topic: '@{ var a = "Twitter: @KirbySaysHi"; }<text>@a</text>'

			,'is not required': function(topic){
				var tpl = vash.compile(topic);
				assert.equal( tpl(), 'Twitter: @KirbySaysHi' );
			}
		}

		,'within ProgramNode (root) in front of keywords': {
			topic: ''
			  + '@@if(model.type){\n'
			  + '  <p>I\'m a @@model.type!</p>\n'
			  + '} else if(model.name){\n'
			  + '  <p>My name is @@model.name.</p>\n'
			  + '} else {\n'
			  + '  <p>I DON\'T KNOW WHO OR WHAT I AM...</p>\n'
			  + '}\n'
			,'outputs': function(topic) {
				var tpl = vash.compile( topic );
				assert.equal( tpl(), ''
				  + '@if(model.type){\n'
					+ '  <p>I\'m a @model.type!</p>\n'
					+ '} else if(model.name){\n'
					+ '  <p>My name is @model.name.</p>\n'
					+ '} else {\n'
					+ '  <p>I DON\'T KNOW WHO OR WHAT I AM...</p>\n'
					+ '}\n');
			}
		}

		,'within markup attribute': {
			topic: '<figure id="fig-@@(figcount++)"></figure>'
			,outputs: function(topic) {
				var tpl = vash.compile(topic);
				assert.equal( tpl(), '<figure id="fig-@(figcount++)"></figure>' );
			}
		}

		,'within markup node': {
			topic: '<f@@e></f@@e>'
			,outputs: function(topic) {
				var tpl = vash.compile(topic);
				assert.equal( tpl(), '<f@e></f@e>' );
			}
		}

		,'<ul class="@@(model.active ? \'highlight\' : \'\')"></ul>': {
			topic: '<ul class="@@(model.active ? \'highlight\' : \'\')"></ul>'
			,outputs: function(topic) {
				var tpl = vash.compile(topic);
				assert.equal( tpl(), '<ul class="@(model.active ? \'highlight\' : \'\')"></ul>' );
			}
		}

		,'@@@@' : {
			topic: '`@@@@`'
			,outputs: function(topic) {
				var tpl = vash.compile(topic);
				assert.equal( tpl(), '`@@`' );
			}
		}

		,'@@{  }': {
			topic: '@@{  }'
			,outputs: function(topic) {
				var tpl = vash.compile(topic);
				assert.equal( tpl(), '@{  }' );
			}
		}
	}

	,'PHP-like tags are not confused for attributes': {
		topic: '<? $what = \'what\' ?>'
		,outputs: function(topic) {
			var tpl = vash.compile(topic);
			assert.equal( tpl(), '<? $what = \'what\' ?>' );
		}
	}

	,'attribute parsing allows for quoted = (equal) signs': function() {
		var topic = '<meta name="viewport" content="width=device-width, initial-scale=1">';
		var tpl = vash.compile(topic);
		assert.equal( tpl(), topic );
	}

	,'"server-side" comments': {

		'multiline': {
			topic: function(){
				var str = '@* \n'
					+ 'This is a server side \n'
					+ 'multiline comment \n'
					+ '*@ and this content should be';
				return vash.compile(str);
			}
			,'output nothing': function(topic){
				assert.equal( topic(), ' and this content should be' )
			}
		}
		,'singleline': {
			topic: function(){
				var str = '@*'
					+ 'This is a server side '
					+ 'comment'
					+ '*@ and this content should be';
				return vash.compile(str);
			}
			,'output nothing': function(topic){
				assert.equal( topic(), ' and this content should be' )
			}
		}
		,'within a block': {
			topic: function(){
				var str = '@if(true){ @*'
					+ 'This is a server side '
					+ 'comment'
					+ '*@ } and this content should be';
				return str;
			}
			,'output nothing': function(topic){
				topic = tryCompile(topic)
				assert.equal( topic(), ' and this content should be' )
			}

		}
		,'unclosed': {
			topic: function(){
				var str = '@* \n'
					+ 'This is a server side \n'
					+ 'multiline comment \n';
				return str;
			}
			,'throws exception': function(topic){
				assert.throws( function(){ vash.compile(topic) }, Error );
			}
		}
		,'can be escaped': {
			topic: 'with `@@*` and `*@@`'
			,'successfully': function(topic) {
				var tpl = vash.compile(topic);
				assert.equal( tpl(), 'with `@*` and `*@`' );
			}
		}
	}
	,'mixing expressions and text': {
		topic: function(){
			var str = 'Hello @title. @name.';
			return vash.compile(str, { useWith: true });
		}
		,'outputs text': function(topic){
			assert.equal( topic({ title: 'Mr', name: 'Doob' }), 'Hello Mr. Doob.');
		}
	}
	,'excluding "with"': {
		topic: function(){
			var str = '<li>@model.name</li>'
				,tpl;

			tpl = vash.compile(str, { useWith: false });
			return tpl;
		}
		,'ensures it is not there': function(topic){
			assert.equal( topic({name: 'what'}), "<li>what</li>" );
		}
	}
	,'including "with"': {
		topic: function(){
			var str = '<li>@name</li>'
				,tpl;

			tpl = vash.compile(str, { useWith: true });
			return tpl;
		}
		,'ensures it is there': function(topic){
			assert.equal( topic({name: 'what'}), "<li>what</li>" );
		}
	}
	,'model name': {
		topic: function(){
			var str = '<li>@it.name</li>'
				,tpl;

			vash.config.modelName = 'it';
			tpl = vash.compile(str, { useWith: false });
			vash.config.modelName = 'model';
			return tpl;
		}
		,'is configurable': function(topic){
			assert.equal( topic({name: 'what'}), "<li>what</li>" );
		}
	}
	,'same line } in block after markup': {
		topic: function(){
			var str = '@{ var a = 0; a += 1; <span>text</span> } <span>text</span>';
			return str;
		}
		,'closes block without neccessity of newline': function(topic){
			var tpl = tryCompile(topic);
			assert.equal( tpl(), '<span>text</span> <span>text</span>' );
		}
	}
	,'misnested html tags in block': {
		topic: function(){
			var str = '@if(true) { <li><p></li></p> }';
			return str;
		}
		,'does not throw "UMATCHED" exception': function(topic){
			//vash.compile(topic);
			assert.doesNotThrow( function(){ vash.compile(topic) }, Error );
		}
	}
	,'self closing html tag inside block': {
		topic: function(){
			var str = '@if(true) { <img src="" /> \n}';
			return str;
		}
		,'does not bork the block stack': function(topic){
			//assert.doesNotThrow( function(){ vash.compile(topic); }, vash._err.MALFORMEDHTML );
			assert.equal( vash.compile(topic)(), '<img src="" />' );
		}
	}
	,'self closing html tag with expression': {
		topic: '<img src="@model.a" />'
		,'allows expression': function(topic){
			assert.equal( vash.compile(topic)({ a: 'a' }), '<img src="a" />' );
		}
	}
	,'nested self closing html tag inside block': {
		topic: function(){
			var str = '@if(true) { <li><img src="" /></li> \n}';
			return str;
		}
		,'does not bork the block stack': function(topic){
			//assert.doesNotThrow( function(){ vash.compile(topic); }, vash._err.MALFORMEDHTML );
			assert.equal( vash.compile(topic)(), '<li><img src="" /></li>' );
		}
	}

	,'content following parens preserves whitespace': {
		topic: '<(bin/vash <docs/helpers/* --helper) > README2.md'
		,outputs: function(topic) {
			var tpl = vash.compile(topic);
			assert.equal( tpl(), '<(bin/vash <docs/helpers/* --helper) > README2.md' );
		}
	}

	,'content } in closed markup': {
		topic: function(){
			var str = '@if(true) { <li> } </li> }';
			return str;
		}
		,'does not need to be escaped': function(topic){
			assert.doesNotThrow( function(){ vash.compile(topic) }, Error );
			assert.equal( vash.compile(topic)(), '<li> } </li>');
		}
	}
	,'content } in expression': {
		topic: function(){
			var str = '@( false || "}" )';
			return str;
		}
		,'does not need to be escaped': function(topic){
			//assert.doesNotThrow( function(){ vash.compile(topic) }, Error);
			assert.doesNotThrow( function(){ vash.compile(topic) }, Error );
			assert.equal( vash.compile(topic)(), '}');
		}
	}
	,'markup followed by for loop': {
		topic: function(){
			var str = '<div class="how"> @for(var i = 0; i < 1; i++){ <div class="item-@i">I be an item!</div> } </div>';
			return vash.compile(str);
		}
		,'renders': function(topic){
			assert.equal( topic(), '<div class="how"> <div class="item-0">I be an item!</div> </div>' );
		}
	}
	,'unclosed block': {
		// throws UNMATCHED exception
		topic: function(){
			var str = '<div class="yeah"> @for(var i = 0; i < 1; i++){ </div>';
			return str;
		}
		,'throws UNMATCHED': function(topic){
			assert.throws( function(){ vash.compile(topic) }, Error );
		}
	}
	,'HTML5:': {
		/*'unclosed tags': {
			topic: function(){
				var str = '<div class="how what">This is content @for(var i = 0; i < 1; i++){ <p>@i }';
				return str;
			}
			,'do not bork': function(topic){
				assert.equal( vash.compile(topic)(), '<div class="how what">This is content <p>0 ' );
			}
		}
		,*/'unclosed tag followed by previous closing tag': {
			topic: function(){
				var str = '<div class="how what">This is content @for(var i = 0; i < 1; i++){ <p>@i </div> }';
				return str;
			}
			,'throws': function(topic){
				assert.throws( function(){ vash.compile(topic)() }, Error );
			}
		}
		,'self-closing tags WITHOUT /': {
			topic: function(){
				var str = '<div class="how what">This is content @for(var i = 0; i < 1; i++){ <text><br>@i</text> } </div>'
				return str;
			}
			,'does not throw UNMATCHED': function(topic){
				assert.doesNotThrow( function(){ vash.compile(topic)() }, Error );
			}
		}
		,'explicitly unclosed, non-void tags': {
			topic: '<a><b><c>'
			,'throw': function(topic) {
				assert.throws(function() {
					var tpl = vash.compile(topic);
				}, Error);
			}
		}
		,'void tag with closing tag': {
			topic: '<img></img>'
			,'throws': function(topic) {
				assert.throws(function() {
					var tpl = vash.compile(topic);
				}, Error)
			}
		}
		,'void tag with closing tag surrounded by BLK': {
			topic: '@{ <img></img> }'
			,'throws': function(topic) {
				assert.throws(function() {
					var tpl = vash.compile(topic);
				}, Error)
			}
		}

		/*,'closing tag within block': {
			topic: function(){
				var str = '<div>This is content @if(true){ </div> } else { </div> }';
				return str;
			}
			,'closes parent': function(topic){
				assert.doesNotThrow( function(){ vash.compile(topic)() }, Error );
				assert.equal( vash.compile(topic)(), '<div>This is content </div>' );
			}
		}*/

		,'operators': {

			topic: function(){
				return '@for( var i = 0; i <= 0; i++ ){<p></p>}';
			}

			,'are not mistaken for tags': function(topic){
				var tpl = vash.compile( topic );
				assert.equal( tpl(), '<p></p>' );
			}
		}

		,'newlines within nested markup': {
			topic: '<span>@model<span\n></span></span>'

			,'does not prevent HTML matching': function(topic) {
				var tpl = vash.compile(topic, {useWith: false})
					, actual = tpl('1');

				assert.equal( '<span>1<span></span></span>', actual )
			}
		}

		,'dashes within tag names': {
			topic: '<accordion-group>hey</accordion-group>'

			,'are included as the tag': function(topic) {
				var tpl = vash.compile(topic, {useWith: false})
					, actual = tpl();

				assert.equal( actual, topic )
			}
		}

	}

	,'xml': {

		'tag namespaces parse as tags': function () {
			var str = '<core:AnotherElement>Hello</core:AnotherElement>';
			var tpl = vash.compile(str);
			assert.equal( tpl(), str );
		}

		,'AT within namespaces are ok': function () {
			var str = '<c:@model.a>Hello</c:@model.a>';
			var tpl = vash.compile(str);
			assert.equal( tpl({ a: 'a' }), '<c:a>Hello</c:a>' );
		}

		,'directives are ok': function () {
			var str = '<?xml version="1.0" encoding="UTF-8"?><p></p>';
			var tpl = vash.compile(str);
			assert.equal( tpl(), str );
		}

		,'attribute namespaces are ok': function () {
			var str = ''
				+ '<ADI \n'
				+ '  xmlns:core="blah" \n'
				+ '  xmlns:ext="URN:NNDS:CMS:ADI3:01"\n'
				+ '  xmlns="http://www.cablelabs.com/namespaces/metadata/xsd/vod30/1">\n'
				+ '  @(model.what)\n'
				+ '</ADI>';
			var tpl = vash.compile(str);
			var expected = ''
				+ '<ADI '
				+ 'xmlns:core="blah" '
				+ 'xmlns:ext="URN:NNDS:CMS:ADI3:01" '
				+ 'xmlns="http://www.cablelabs.com/namespaces/metadata/xsd/vod30/1">\n'
				+ '  what\n'
				+ '</ADI>'
			var actual = tpl({ what: 'what' });
			console.log('actual', actual)
			console.log('expected', expected)
			assert.equal( actual, expected );
		}
	}

	,'unbalanced characters are ok': {
		// https://github.com/kirbysayshi/vash/issues/26

		'open paren': {
			topic: '@("(")'
			,'outputs': function( topic ) {
				var tpl = vash.compile(topic);
				assert.equal( tpl(), '(' );
			}
		}

		,'open paren within markup within block': {
			topic: '@(function(model) { <p>(</p> }())'
			,'outputs': function( topic ) {
				var tpl = vash.compile(topic);
				assert.equal( tpl(), '<p>(</p>' );
			}
		}

	}

	,'simple expression followed by @()': {

		topic: function(){
			return '<li data-score="@model.Score" class="user-panel-track @(model.i % 2 === 0 ? \'even\' : \'odd\')"></li>';
		}
		,'renders': function(topic){
			assert.equal( vash.compile(topic)({ Score: '1', i: 0 })
				, '<li data-score="1" class="user-panel-track even"></li>');
		}
	}
	,'empty string': {
		topic: function(){ return "" }
		,'returns empty string': function(topic){
			assert.throws( function(){ vash.compile(topic)() }, Error );
		}
	}
	,'non-string parameter': {
		topic: function(){ return {} }
		,'throws exception': function(topic){
			assert.throws( function(){ vash.compile(topic)() }, Error );
		}
	}
	,'@function': {
		// the space before @ counts as markup
		topic: function(){ return '@function doWhat(){ return "what"; } @doWhat()' }
		,compiles: function(topic){
			assert.doesNotThrow( function(){ vash.compile(topic) }, Error );
		}
		,'can be called': function(topic){
			assert.equal( vash.compile(topic)(), ' what' );
		}
	}
	,'@function with markup': {
		topic: function(){ return '@function doWhat(input){ <li>@input.name</li> } @doWhat(model)' }
		,compiles: function(topic){
			assert.doesNotThrow( function(){ vash.compile(topic) }, Error );
		}
		,'can be called': function(topic){
			assert.equal( vash.compile(topic)({ name: 'what' }), ' <li>what</li>' );
		}
	}

	,'this was an infinite parser bug #68 at some point': {
		topic: '@:Some Text\n@html.block(\'test\')\n'
		,'does not hang': function(topic) {
			var tpl = vash.compile(topic);
			assert.ok( tpl );
		}
	}

	/*,'fat arrow': {

		'with single parameter': {
			topic: function(){
				return vash.compile( '<ul>@arr.forEach( i => <li>@i</li> )</ul>' );
			}

			,'succeeds': function(topic){
				assert.equal( topic( { arr: ['a','b'] } ), '<ul><li>a</li> <li>b</li> </ul>' )
			}
		}
		// this is technically incorrect, but pretty cool that you can do it
		,'with multiple unparenthetized parameters': {
			topic: function(){
				return vash.compile( '<ul>@arr.forEach( i, k => <li>@i</li> )</ul>' );
			}

			,'succeeds': function(topic){
				assert.equal( topic( { arr: ['a','b'] } ), '<ul><li>a</li> <li>b</li> </ul>' )
			}
		}
		,'with multiple parameters': {
			topic: function(){
				return vash.compile( '<ul>@arr.forEach( (i,k) => <li>@i</li> )</ul>' );
			}

			,'succeeds': function(topic){
				assert.equal( topic( { arr: ['a','b'] } ), '<ul><li>a</li> <li>b</li> </ul>' )
			}
		}
		,'with multiple parameters with function block': {
			topic: function(){
				return vash.compile( '<ul>@arr.forEach( (i,k) => { <li>@i</li> } )</ul>' );
			}

			,'succeeds': function(topic){
				assert.equal( topic( { arr: ['a','b'] } ), '<ul><li>a</li> <li>b</li> </ul>' )
			}
		}
	}*/

	,'html escaping:': {

		'basic': {
			topic: function(){
				return vash.compile( '<span>@it</span>', { useWith: true } );
			}
			,'is escaped': function(topic){
				assert.equal( topic({ it: '<b>texted</b>' }), '<span>&lt;b&gt;texted&lt;/b&gt;</span>' );
			}
		}

		,'force no escaping': {
			topic: function(){
				return vash.compile( '<span>@it</span>', { htmlEscape: false, useWith: true } );
			}
			,'is escaped': function(topic){
				assert.equal( topic({ it: '<b>texted</b>' }), '<span><b>texted</b></span>' );
			}
		}

		,'force no escaping per call (html.raw)': {
			topic: function(){
				return vash.compile( '<span>@html.raw(it)</span>', { useWith: true } );
			}
			,'is escaped': function(topic){
				assert.equal( topic({ it: '<b>texted</b>' }), '<span><b>texted</b></span>' );
			}
		}

		,'multiple function calls': {
			topic: function(){
				return vash.compile( '@function f(i){ <b>@i</b> }<span>@f(it)</span>@f(it)', { useWith: true } );
			}
			,'are escaped': function(topic){
				assert.equal( topic({ it: '<b>texted</b>' }),
					'<span><b>&lt;b&gt;texted&lt;/b&gt;</b></span><b>&lt;b&gt;texted&lt;/b&gt;</b>' );
			}
		}

		,'multiple function calls are not double escaped': {
			topic: function(){
				return vash.compile( '@function f(i){ <b>@i</b> }<span>@f(model.it)</span>@f(model.it)', { useWith: false } );
			}
			,'are escaped': function(topic){
				//console.log( topic.toString() );
				assert.equal( topic({ it: '<b>texted</b>' }),
					'<span><b>&lt;b&gt;texted&lt;/b&gt;</b></span><b>&lt;b&gt;texted&lt;/b&gt;</b>' );
			}
		}

		,'multiple nested function calls': {
			topic: function(){
				return vash.compile( '@function f(i){ <b>@i</b> function d(i){ <b>@i</b> } d(model.it) }<span>@f(model.it)</span>@f(model.it)' );
			}
			,'are escaped': function(topic){
				assert.equal( topic({ it: '<b>texted</b>' }),
					'<span><b>&lt;b&gt;texted&lt;/b&gt;</b><b>&lt;b&gt;texted&lt;/b&gt;</b></span><b>&lt;b&gt;texted&lt;/b&gt;</b><b>&lt;b&gt;texted&lt;/b&gt;</b>' );
			}
		}
	}

	,"markup quotation marks:": {

		"single quotes come out": {
			topic: function(){
				return "<text>It's followed by primary content.</text>"
			}
			,"as single quotes": function(topic){
				var tpl = tryCompile(topic);
				assert.equal(tpl(), "It's followed by primary content.")
			}
		}

		,"double quotes come out": {
			topic: function(){
				return '<text>It is "followed" by primary content.</text>'
			}
			,"as double quotes": function(topic){
				var tpl = tryCompile(topic);
				assert.equal(tpl(), 'It is "followed" by primary content.')
			}
		}

		,"escaped single quotes come out": {
			topic: function(){
				return "<text>'It\\'s followed by primary content.'</text>"
			}
			,"as single quotes": function(topic){
				var tpl = tryCompile(topic);
				assert.equal(tpl(), "'It\\'s followed by primary content.'")
			}
		}

		,"escaped double quotes come out": {
			topic: function(){
				return "<text>It is \"followed\" by primary content.</text>"
			}
			,"as double quotes": function(topic){
				var tpl = tryCompile(topic);
				assert.equal(tpl(), 'It is "followed" by primary content.')
			}
		}
	}

	,"block quotation marks:": {

		"single quotes come out": {
			topic: function(){
				return "@{ var a = \"It's followed by primary content.\"; } @html.raw(a)"
			}
			,"as single quotes": function(topic){
				var tpl = tryCompile(topic);
				assert.equal(tpl(), " It's followed by primary content.")
			}
		}

		,"double quotes come out": {
			topic: function(){
				return '@{ var a = \'It is "followed" by primary content.\'; } @html.raw(a)'
			}
			,"as double quotes": function(topic){
				var tpl = tryCompile(topic);
				assert.equal(tpl(), ' It is "followed" by primary content.')
			}
		}

		,"escaped single quotes come out": {
			topic: function(){
				return "@{ var a = 'It\\'s followed by primary content.'; } @html.raw(a)"
			}
			,"as single quotes": function(topic){
				var tpl = tryCompile(topic);
				assert.equal(tpl(), " It's followed by primary content.")
			}
		}

		,"escaped double quotes come out": {
			topic: function(){
				return '@{ var a = \'It is \"followed\" by primary content.\'; } @html.raw(a)'
			}
			,"as double quotes": function(topic){
				var tpl = tryCompile(topic);
				assert.equal(tpl(), ' It is "followed" by primary content.')
			}
		}
	}

	,"expression quotation marks:": {

		"single quotes come out": {
			topic: function(){
				return "@html.raw(\"It's followed by primary content.\")"
			}
			,"as single quotes": function(topic){
				var tpl = tryCompile(topic);
				assert.equal(tpl(), "It's followed by primary content.")
			}
		}

		,"double quotes come out": {
			topic: function(){
				return '@html.raw(\'It is "followed" by primary content.\')'
			}
			,"as double quotes": function(topic){
				var tpl = tryCompile(topic);
				assert.equal(tpl(), 'It is "followed" by primary content.')
			}
		}

		,"escaped single quotes come out": {
			topic: function(){
				return "@html.raw('It\\'s followed by primary content.')"
			}
			,"as single quotes": function(topic){
				vash.compile(topic, { useWith: false, debug: false });
				var tpl = tryCompile(topic);
				assert.equal(tpl(), "It's followed by primary content.")
			}
		}

		,"escaped double quotes come out": {
			topic: function(){
				return '@html.raw("It is \\"followed\\" by primary content.")'
			}
			,"as double quotes": function(topic){
				var tpl = vash.compile(topic);
				//var tpl = vash.compile(topic, { useWith: false, debug: false });
				assert.equal(tpl(), 'It is "followed" by primary content.')
			}
		}
	}

	,"inline styles": {

		"style tag with one id rule": {
			topic: function(){
				return '<style type="text/css">#header{ border-bottom: 0; }</style>'
			}
			,"is unchanged": function(topic){
				var tpl = vash.compile(topic);
				assert.equal(tpl(), topic)
			}
		}
		,"style tag with two id rule": {
			topic: function(){
				return '<style type="text/css">#parallax_field #parallax_bg { position: absolute; top: -20px; left: -20px; width: 110%; height: 425px; z-index: 1; }</style>'
			}
			,"is unchanged": function(topic){
				var tpl = vash.compile(topic);
				assert.equal(tpl(), topic)
			}
		}
	}

	,'favorText': {

		'with expression': {
			topic: function(){
				return '@if(true){ @model.text }'
			}
			,'requires @': function(topic){
				var tpl = vash.compile(topic, { favorText: true })
				assert.equal( tpl({ text: 'yes' }), ' yes ' );
			}
		}

		,'with expression inside markup block': {
			topic: function(){
				return '@if(true){ <b>@model.text</b> }'
			}
			,'requires @': function(topic){
				var tpl = vash.compile(topic, { favorText: true })
				assert.equal( tpl({ text: 'yes' }), ' <b>yes</b> ' );
			}
		}

		,'with explicit expression inside markup block': {
			topic: function(){
				return '@if(true){ <b>@(model.text)</b> }'
			}
			,'requires @': function(topic){
				var tpl = vash.compile(topic, { favorText: true })
				assert.equal( tpl({ text: 'yes' }), ' <b>yes</b> ' );
			}
		}

		,'with text': {
			topic: function(){
				return '@if(true){ model.text }'
			}
			,'outputs content': function(topic){
				var tpl = vash.compile(topic, { favorText: true })
				assert.equal( tpl(), ' model.text ' );
			}
		}

		,'with html': {
			topic: function(){
				return '@if(true){ <b>model.text</b> }'
			}
			,'outputs content': function(topic){
				var tpl = vash.compile(topic, { favorText: true })
				assert.equal( tpl(), ' <b>model.text</b> ' );
			}
		}

	}

	,'keywords': {

		topic: '@if( model instanceof Object ){ <p></p> }'

		,'do not open extraneous blocks': function( topic ){
			var tpl = vash.compile( topic );
			assert.equal( tpl(), '<p></p>' );
		}
	}

	,'else if': {

		topic: '@if (!model.w){<p>A</p>} else if (model.w) {<p>B</p>}<p>C</p>'

		,'codegen': function( topic ){
			var tpl = vash.compile(topic);
			assert.equal( tpl({w: false}), '<p>A</p><p>C</p>' );
		}
	}

	,'else followed by another if': {
		topic: '@if (true) { <span>1</span> } else if (false) { <span>no</span> } else { <span>no</span> }\n\n@if (true) { <span>2</span> }',
		'outputs': function( topic ) {
			var tpl = vash.compile(topic);
			console.log(tpl())
			assert.equal( tpl(), '<span>1</span><span>2</span>' );
		}
	}

	,'switch statement': {

		'without braced cases': {
			topic: '@switch(model){ case 1: <p></p>break; case 2: <b></b>break; }'

			,'work': function( topic ){
				var tpl = vash.compile( topic );
				assert.equal( tpl(1), '<p></p>' );
				assert.equal( tpl(2), '<b></b>' );
			}
		}

		,'with braced cases': {
			topic: '@switch(model){ case 1: { <p></p>break; } case 2: { <b></b>break; } }'
			,work: function( topic ) {
				var tpl = vash.compile( topic );
				assert.equal( tpl(1), '<p></p>' );
				assert.equal( tpl(2), '<b></b>' );
			}
		}
	}

	,'backslashes': {

		'in markup': {
			topic: '<p>Literal \\</p>'

			,'are literal': function(topic){
				var tpl = vash.compile(topic)
					,expected = topic
					,actual = tpl();

				assert.equal( actual, expected );
			}

			,'within content regex': {
				topic: '/^([a-zA-Z0-9.%]+@@[a-zA-Z0-9.\\-]+\\.(?:ca|co\\.uk|com|edu|net|org))\\b/'
				,outputs: function(topic) {
					var tpl = vash.compile(topic);
					assert.equal( tpl(), '/^([a-zA-Z0-9.%]+@[a-zA-Z0-9.\\-]+\\.(?:ca|co\\.uk|com|edu|net|org))\\b/' );
				}
			}
		}

		,'in expression': {
			topic: '@( false || /\\n/.exec("\\n") && "\\ " + "\\n" )'

			,'are literal': function(topic){
				var tpl = vash.compile(topic)
					,expected = ' \n'
					,actual = tpl();

				assert.equal( actual, expected );
			}
		}

		,'in block': {
			topic: '@{ var a = "\\\\ "; var b = /\\n/.exec("\\n"); }@a@b[0]'

			,'are literal': function(topic){
				var tpl = vash.compile(topic)
					,expected = '\\ \n'
					,actual = tpl();

				assert.equal( actual, expected );
			}
		}

		,'in a compiled helper': {
			topic: ''
				+ 'vash.helpers.bslash = function(assert, str){ \n'
				+ 'var re = /\\n/ \n'
				+ 'assert.equal(re.source, "\\\\n"); \n'
				+ 'assert.ok(re.exec(str), "`str` does not contain newline"); \n'
				+ 'return re; \n'
				+ '}'

			,'are not double escaped': function(topic){
				vash.compileHelper(topic);
				var re = vash.helpers.bslash(assert, 'this\nhas');
				assert.equal(re.source, '\\n');
			}
		}
	}

	,'markup within explicit expressions': {

		topic: '@(<p>@model.what @{ var a = "who"; } @a</p>)'

		,'is allowed': function (topic) {
			var tpl = vash.compile(topic);
			console.log('tpl', tpl.toClientString());
			assert.equal(tpl({ what: 'hey' }), '<p>hey  who</p>');
		}

	}

	,'render options': {

		topic: function(){ return vash.compile('<p></p>') }

		,'asContext': {
			topic: function( tpl ){
				return tpl({}, { asContext: true });
			}

			,'returns a context': function( ctx ){
				assert( ctx instanceof vash.helpers.constructor, 'ctx should be instance of Helpers')
			}
		}

		,'onRenderEnd as parameter': {
			topic: function( tpl ){
				tpl( {}, this.callback );
			}

			,'is called': function( err, ctx ){
				assert.ifError( err );
				assert( ctx instanceof vash.helpers.constructor, 'ctx should be instance of Helpers')
			}
		}

		,'onRenderEnd as option': {
			topic: function( tpl ){
				tpl( {}, { onRenderEnd: this.callback } );
			}

			,'is called': function( err, ctx ){
				assert.ifError( err );
				assert( ctx instanceof vash.helpers.constructor, 'ctx should be instance of Helpers')
			}
		}

		,'injecting a context': {
			topic: function( tpl ){
				var ctx = new vash.helpers.constructor({ injected: true });
				ctx.buffer.push('test');
				return tpl({ injected: false }, { context: ctx, asContext: true })
			}

			,'overrides the model': function( ctx ){
				assert.equal( ctx.model.injected, true );
			}

			,'retains buffer': function( ctx ){
				assert.equal( ctx.toString(), 'test<p></p>' )
			}
		}

		,'from within a helper': {
			topic: function(){
				vash.helpers.opts1 = function(){ return this.options.something; }
				return vash.compile('<p>@html.opts1()</p>')
			}

			,'are accessible': function( tpl ){
				assert.equal( tpl({}, { something: 'what' }), '<p>what</p>' );
			}

			,teardown: function(){
				delete vash.helpers.opts1;
			}
		}
	}

	,'simple': {

		topic: function(){
			return '<p>@model</p>'
		}

		,'renders': function( topic ){
			var tpl = vash.compile(topic, { simple: true });
			assert.equal( tpl('YES'), '<p>YES</p>' );
		}

		,'html escaping': {
			topic: ''

			,'is ignored via `raw`': function(){
				var str = '<p>@html.raw(model)</p>'
					,tpl = vash.compile( str, { simple: true, htmlEscape: true } )

				assert.equal( tpl('<br />'), '<p><br /></p>');
			}

			,'works': function(){
				var str = '<p>@model</p>'
					,tpl = vash.compile( str, { simple: true, htmlEscape: true } )

				assert.equal( tpl('<br />'), '<p>&lt;br /&gt;</p>');
			}
		}
	}

	,'batched': {

		topic: '//@batch = div \n<div>@model</div>\n'
			+'// @batch = a \n<a>@model</a>'

		,'installs each tpl': function(topic){
			var  tpls = vash.compileBatch(topic)
				,model = 'm';

			vash.install(tpls);

			assert.equal( vash.lookup('div')(model), '<div>m</div>' );
			assert.equal( vash.lookup('a')(model), '<a>m</a>' );

			vash.uninstall('div');
			vash.uninstall('a');
		}
	}

	,'compiled helpers': {

		'can be defined': {

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

			,'and execute': function(topic){

				vash.compileHelper(topic);
				assert.ok( vash.helpers.fn );

				var str = '@html.fn("one") @html.fn("two")'
					,tpl = vash.compile(str);

				var  ctx = tpl({}, { asContext: true })
					,rendered = ctx.toString();

				assert.equal( ctx.fnCounter, 2 );
				assert.equal( ctx.fnIds.one, 1 );
				assert.equal( ctx.fnIds.two, 2 );
				assert.ok( rendered.indexOf('fnref:one') > -1, 'expect indexOf fnref:one to be > -1' );
				assert.ok( rendered.indexOf('fnref:two') > -1, 'expect indexOf fnref:two to be > -1' );
				delete vash.helpers.fn;
			}
		}

		,'when compiling': {

			topic: '\n'
				+ 'vash.helpers.fn0 = function(){}\n'
				+ '           vash.helpers.fn1 = function(id){ return id + "1"; }\n'
				+ '\t \t\n  vash.helpers.fn2 = function(id){ return id + "2"; }'

			,'can batch compile': function(topic){
				vash.compileHelper(topic);
				assert.ok( vash.helpers.fn1, 'expect fn1 to be defined' );
				assert.ok( vash.helpers.fn2, 'expect fn2 to be defined' );

				var  str = '@html.fn1("a") @html.fn2("b")'
					,tpl = vash.compile(str);

				var rendered = tpl();

				assert.equal( rendered, 'a1 b2' );
				delete vash.helpers.fn0;
				delete vash.helpers.fn1;
				delete vash.helpers.fn2;
			}

			,'can batch .toClientString': function(topic){

				var tpls = vash.compileHelper(topic)
					,output = tpls.toClientString()

				assert.ok( output.match(/vash.link/gi).length === 3, 'expect three vash.link' );
			}
		}

	}

	,'html comments': {
		topic: '<!--li><a href="#features">Features</a></li-->'
		,'do not break parsing': function(topic) {
			var tpl = vash.compile(topic);
			assert.equal( tpl(), topic );
		}
	}

	,'html comments with unclosed tags within': {
		topic: '<!--<a><b>c</b>-->'
		,'are not interpreted as tags': function(topic) {
			var tpl = vash.compile(topic);
			assert.equal( tpl(), '<!--<a><b>c</b>-->' );
		}
	}

	,'single line comments': {
		'near markup': {
			topic: ' // this is a comment\n'
				+ '<p></p>'
			,'are output as content': function(topic){
				var  tpl = vash.compile(topic)
					,actual = tpl()
					,expected = ' // this is a comment\n<p></p>'
				assert.equal( actual, expected );
			}
		}
		,'within code': {
			topic: '@{ // this is a comment\n }'
			,'are not output': function(topic){
				var  tpl = vash.compile(topic)
					,actual = tpl()
					,expected = ''
				assert.equal( actual, expected );
			}
		}

		,'and urls': {
			topic: '@{ var href = "http://google.com"; <p>@href</p> }'
			,'are not confused': function(topic){
				var  tpl = vash.compile(topic)
					,actual = tpl()
					,expected = '<p>http://google.com</p>'
				assert.equal( actual, expected );
			}
		}

		,'containing @': {
			topic: '@{ // this is a @comment\n}'

			,"are treated as literal": function(topic){
				var tpl = vash.compile(topic)
					,actual = tpl()
					,expected = '';

				assert.equal(actual, expected);
			}
		}

		,'containing a single quote': {
			topic: '@{ // this is a comment y\'all\n}'

			,"does not enter string mode": function(topic){
				var tpl = vash.compile(topic)
					,actual = tpl()
					,expected = '';

				assert.equal(actual, expected);
			}
		}
	}

	,'ast': {

		topic: function(){
			this.asAST = function (input) {
				var Lexer = require('../../lib/lexer');
				var Parser = require('../../lib/parser');
				var l = new Lexer();

				l.write(input);
				var tokens = l.read();

				var p = new Parser();
				p.write(tokens);
				var more = true;
				while(more !== null) more = p.read();

				return p.stack[0];
			}

			return '';
		}

		,'self-closing tag within tag': {

			topic: '@if(true){<a><br /></a>}'

			,'does not close parent tag': function(topic){
				var root = this.asAST(topic);
				assert.equal( root.body[0].type, 'VashMarkup' );
				assert.equal( root.body[0].values[0].type, 'VashMarkupContent' );
				assert.equal( root.body[0].values[0].values[1].type, 'VashBlock' );
				assert.equal( root.body[0].values[0].values[1].values[0].type, 'VashMarkup' );
				assert.equal( root.body[0].values[0].values[1].values[0].values[0].type, 'VashMarkupContent' );
				assert.equal( root.body[0].values[0].values[1].values[0].values[0].values[0].type, 'VashText' );
				assert.equal( root.body[0].values[0].values[1].values[0].values[0].values[1].isVoid, true );
			}
		}

		,'else if else if': {

			topic: '@if (a){<p>A</p>} else if (b) {<p>B</p>} else {<p>C</p>}<p>D</p>'

			,'has proper structure': function( topic ){
				var tpl = vash.compile(topic);
				var ast = this.asAST(topic);

				var ifBlock = ast.body[0].values[0].values[1];
				assert.equal(ifBlock.keyword, 'if');
				assert.equal(ifBlock.tail[1].keyword, 'else if');
				assert.equal(ifBlock.tail[1].tail[1].keyword, 'else');
			}
		}
	}

	,'whitespace': {

		'within block': {
			topic: '@{ html.buffer.push(Array(5).join("  ")) }'

			,'is preserved': function(topic){
				var  tpl = vash.compile(topic)
					,actual = tpl();

				assert.equal( actual.length, 8 );
			}
		}

		,'within expression': {
			topic: '@Array(5).join("  ")'

			,'is preserved': function(topic){
				var  tpl = vash.compile(topic)
					,actual = tpl();

				assert.equal( actual.length, 8 );
			}
		}

		,'within markup': {
			topic: '        '

			,'is preserved': function(topic){
				var  tpl = vash.compile(topic)
					,actual = tpl();

				assert.equal( actual.length, 8 );
			}
		}

		,'containing BOM': {
			topic: '\uFEFF<p></p>'

			,'is stripped': function(topic) {
				var tpl = vash.compile(topic)
					, actual = tpl();

				assert.equal( actual, '<p></p>');
			}
		}

	}

	,'@expressions within a block': {

		topic: '@{ @(model + "b") }'

		,'are content': function(topic) {
			var tpl = vash.compile(topic);
			var actual = tpl('a');
			assert.equal(actual, 'ab');
		}
	}

	/*,'implicit compilation': {

		'is valid': {

			topic: '<text>@model.a</text>'

			,'within an expression': function( topic ){
				var str = '@function help(res){ res(model) } @help(@' + topic + ')'
					,tpl = vash.compile( str )
					,actual = tpl({a : 'a'});

				assert.equal( actual, ' a' );
			}

			,'within a block statement': function( topic ){
				var str = '@{ var b = @' + topic + '; }@b'
					,tpl = vash.compile( str )

				var actual = tpl( {a: 'a'} );
				assert.equal( actual.toString(), 'a' );
			}
		}
	}*/
	//,'putting markup into a property': {
	//	topic: function(){
	//		var str = '@{ var a = { b: <li class="whatwhat"></li> \n } \n }';
	//		return vash.compile(str);
	//	}
	//	,'outputs nothing when rendered': function(topic){
	//		assert.equal( topic(), '' );
	//	}
	//	//,'outputs a returnable function': function(topic){
	//	//	// could calling the tpl return a function?
	//	//}
	//}
}).export(module)
