var vows = require('vows')
	,assert = require('assert')
	//,vash = process.argv[2]
	//	? require(__dirname + '/../build/vash.' + process.argv[2] )
	//	: require(__dirname + '/../build/vash');
	//vash = require(__dirname + '/../build/vash')


exports.run = function(vash){

vash.config.useWith = true;
vash.config.debug = true;
vash.config.client = false;

var tryCompile = function(str){
	vash.compile(str); // because we want to see the stupid error
	assert.doesNotThrow( function(){ vash.compile(str) }, Error );

	try {
		return vash.compile(str);
	} catch(e){
		return function(){};
	}
}

return vows.describe('vash templating library').addBatch({
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
			return vash.compile('@i', { htmlEscape: false });
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
			return vash.compile(str);
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
			return vash.compile(str);
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
			return vash.compile(str);
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
			return vash.compile(str);
		}
		,'output markup': function(topic){
			assert.equal(topic(), '<li class="0">list item</li>');
		}
	}
	,'for blocks and markup with complex interpolation/expression': {
		topic: function(){
			var str = "@for(var i = 0; i < 1; i++){ <li class=\"@(i % 2 == 0 ? \"blue\" : \"red\")\">list item</li> \n }";
			return vash.compile(str);
		}
		,'output markup': function(topic){
			assert.equal(topic(), '<li class="blue">list item</li>');
		}
	}
	,'nested for blocks and markup with complex interpolation/expression': {
		topic: function(){
			var str = "@for(var i = 0; i < 1; i++){ for(var j = 0; j < 2; j++) { <li class=\"@(i % 2 == 0 ? \"blue\" : \"red\")\">list item</li> \n } }";
			return vash.compile(str);
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
			return vash.compile(str);
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
			return vash.compile(str);
		}
		,'outputs G': function(topic){
			assert.equal( topic({ what: { how: 'G' }}), '<a href="G"></a>');
		}
	}
	,'expression with indexed properties and method call': {
		topic: function(){
			var str = '<a href="@what.how()[0]"></a>';
			return vash.compile(str);
		}
		,'outputs G': function(topic){
			assert.equal( topic({ what: { how: function() { return 'G'; } }}), '<a href="G"></a>');
		}
	}
	,'expression with indexed properties and method call with additional property': {
		topic: function(){
			var str = '<a href="@what.how()[0].length"></a>';
			return vash.compile(str);
		}
		,'outputs 1': function(topic){
			assert.equal( topic({ what: { how: function() { return 'G'; } }}), '<a href="1"></a>');
		}
	}
	,'expression with indexed property followed by valid identifer': {
		topic: function(){
			var str = '<a href="@what[0]yeah"></a>';
			return vash.compile(str);
		}
		,'outputs 1yeah': function(topic){
			assert.equal( topic({ what: '1'}), '<a href="1yeah"></a>');
		}
	}
	,'explicit expression followed by bracket, @escape': {
		topic: function(){
			var str = '<a href="somename_@(what.how)@[0]"></a>';
			return vash.compile(str);
		}
		,'uses brackets as markup': function(topic){
			assert.equal( topic({ what: { how: 'yes' }}), '<a href="somename_yes[0]"></a>');
		}
	}
	,'explicit expression followed by bracket': {
		topic: function(){
			var str = '<a href="somename_@(what.how)[0]"></a>';
			return vash.compile(str);
		}
		,'uses brackets as markup': function(topic){
			assert.equal( topic({ what: { how: 'yes' }}), '<a href="somename_yes[0]"></a>');
		}
	}
	,'expression followed by empty bracket': {
		topic: function(){
			var str = '<a href="somename_@what.how[]"></a>';
			return vash.compile(str);
		}
		,'uses brackets as markup': function(topic){
			assert.equal( topic({ what: { how: 'yes' }}), '<a href="somename_yes[]"></a>');
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
	//,'array literal': {
	//	topic: function(){
	//		return vash.compile('<a>@["a", "b", "c"]</a>');
	//	}
	//	,'toStrings': function(topic){
	//		assert.equal( topic(), '<a>a,b,c</a>' );
	//	}
	//}
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
	,'markup within a code block followed by else with an expression': {
		topic: function(){
			var str = '@if(false){ \n'
				+ '<span>this is text \n'
				+ 'that spans multiple lines</span> \n'
				+ ' } else { \n'
				+ ' @name.how \n'
				+ ' } ';
			return str;
		}
		,'disregards newline re-entry into BLK mode': function(topic){
			var tpl = tryCompile(topic);
			assert.equal(tpl( { name: {how: 'you' } } ), 'you');
		}
	}
	,'markup within a complex if code block followed by else with an expression': {
		topic: function(){
			var str = '@if( heyo.ya !== true ){ \n'
				+ '<input name="item-quantity-@item.id" type="text" value="@item.quantity" maxlength="5" size="6" />'
				+ ' } else { \n'
				+ ' @name.how \n'
				+ ' } ';
			return str;
		}
		,'disregards newline re-entry into BLK mode': function(topic){
			var tpl = tryCompile(topic);
			assert.equal(tpl( { heyo: { ya: true }, name: {how: 'you' }, item: { id: 0, quantity: 23 } } ), 'you');
		}
	}
	,'markup within a complex if code block followed by else with an expression, all within markup': {
		topic: function(){
			var str = '<td>@if( false ){ } else { @name.how }</td>';
			return str;
		}
		,'"else" is a keyword': function(topic){
			var tpl = tryCompile(topic);
			assert.equal(tpl( {
				name: {
					how: 'you'
				}
			} ), '<td>you</td>');
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
			assert.equal(tpl({ name: 'what' }), '<span-what>this is text \nthat spans multiple lines</span-what> \n');
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
			assert.equal(tpl({ name: 'what' }), '<span-what>this is text \nthat spans multiple lines</span-what> \n<span class="what">this is text \nthat spans multiple lines</span> \n');
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
	,'markup with numbers': {
		topic: function(){
			var str = "<div>"
				+ "	<h1 class='header'>@header</h1>"
				+ "	<h2 class='header2'>@header2</h2>"
				+ "</div>"
			return str;
		}
		,'is named properly': function(topic){
			assert.equal( vash.compile(topic)( { header: 'a', header2: 'b' } ),
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
			assert.equal( vash.compile(topic)({name: 'what'}), '<what>This is content</what>' );
		}
	}
	,'simple expression as tagname within block': {
		topic: function(){
			return '@if(true){ <@name>This is content</@name> }';
		}
		,'is allowed': function(topic){
			assert.equal( vash.compile(topic)({name: 'what'}), '<what>This is content</what> ' );
		}
	}
	,'complex expression as tagname': {
		topic: function(){
			return '<@name[0].length>This is content</@name[0].length>';
		}
		,'is allowed': function(topic){
			assert.equal( vash.compile(topic)({name: 'what'}), '<1>This is content</1>' );
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
	}
	,'explicit expression': {
		topic: function(){
			var str = '<span>ISBN@(isbnNumber)</span>';
			return vash.compile(str);
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
		,'throws syntax error': function(topic){
			assert.equal(vash.compile(topic)({ a: 'xxx' }), '<span>oxx</span>');
		}
	}
	,'expression with regex in func call': {
		topic: function(){
			var str = '<span>@a.replace(/x/gi, "o")</span>';
			return str;
		}
		,'throws syntax error': function(topic){
			assert.equal(vash.compile(topic)({ a: 'xxx' }), '<span>ooo</span>');
		}
	}
	,'escaping the @ symbol': {
		topic: function(){
			var str = '<span>In vash, you use the @@foo to display the value of foo</span>';
			return vash.compile(str);
		}
		,'leaves just a single @': function(topic){
			assert.equal( topic(), '<span>In vash, you use the @foo to display the value of foo</span>' )
		}
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
	}
	,'mixing expressions and text': {
		topic: function(){
			var str = 'Hello @title. @name.';
			return vash.compile(str);
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
	,'content } in closed markup': {
		topic: function(){
			var str = '@if(true) { <li> @} </li> }';
			return str;
		}
		,'does not need to be escaped': function(topic){
			//assert.doesNotThrow( function(){ vash.compile(topic) }, Error);
			assert.doesNotThrow( function(){ vash.compile(topic) }, Error );
			assert.equal( vash.compile(topic)(), '<li> } </li>');
		}
	}
	,'content } in open markup': {
		topic: function(){
			var str = '@if(true) { <img src="" /> @} }';
			return str;
		}
		,'can be escaped with @': function(topic){
			assert.doesNotThrow( function(){ vash.compile(topic) }, Error );
			assert.equal( vash.compile(topic)(), '<img src="" />} ');
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
	,'content \ in expression': {
		topic: function(){
			var str = '@( false || "\\ " )';
			return str;
		}
		,'is not forgotten': function(topic){
			//assert.doesNotThrow( function(){ vash.compile(topic) }, Error);
			//assert.doesNotThrow( function(){ vash.compile(topic) }, Error );
			assert.equal( vash.compile(topic)(), '\ ');
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
		'unclosed tags': {
			topic: function(){
				var str = '<div class="how what">This is content @for(var i = 0; i < 1; i++){ <p>@i }';
				return str;
			}
			,'do not bork': function(topic){
				assert.equal( vash.compile(topic)(), '<div class="how what">This is content <p>0 ' );
			}
		}
		,'unclosed tag followed by previous closing tag does not bork': {
			topic: function(){
				var str = '<div class="how what">This is content @for(var i = 0; i < 1; i++){ <p>@i </div> }';
				return str;
			}
			,'throws UNMATCHED': function(topic){
				assert.doesNotThrow( function(){ vash.compile(topic)() }, Error );
			}
		}
		,'self-closing tags WITHOUT /': {
			topic: function(){
				var str = '<div class="how what">This is content @for(var i = 0; i < 1; i++){ <br>@i </div> }'
				return str;
			}
			,'does not throw UNMATCHED': function(topic){
				assert.doesNotThrow( function(){ vash.compile(topic)() }, Error );
			}
		}
		,'closing tag within block': {
			topic: function(){
				var str = '<div>This is content @if(true){ </div> } else { </div> }';
				return str;
			}
			,'closes parent': function(topic){
				assert.doesNotThrow( function(){ vash.compile(topic)() }, Error );
				assert.equal( vash.compile(topic)(), '<div>This is content </div>' );
			}
		}
	}
	,'simple expression followed by @()': {

		topic: function(){
			return '<li data-score="@model.Score" class="user-panel-track @(model.i % 2 === 0 ? \'even\' : \'odd\')">';
		}
		,'renders': function(topic){
			assert.equal( vash.compile(topic)({ Score: '1', i: 0 })
				, '<li data-score="1" class="user-panel-track even">');
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
				return vash.compile( '<span>@it</span>' );
			}
			,'is escaped': function(topic){
				assert.equal( topic({ it: '<b>texted</b>' }), '<span>&lt;b&gt;texted&lt;/b&gt;</span>' );
			}
		}

		,'force no escaping': {
			topic: function(){
				return vash.compile( '<span>@it</span>', { htmlEscape: false } );
			}
			,'is escaped': function(topic){
				assert.equal( topic({ it: '<b>texted</b>' }), '<span><b>texted</b></span>' );
			}
		}

		,'force no escaping per call (html.raw)': {
			topic: function(){
				return vash.compile( '<span>@html.raw(it)</span>' );
			}
			,'is escaped': function(topic){
				assert.equal( topic({ it: '<b>texted</b>' }), '<span><b>texted</b></span>' );
			}
		}

		,'multiple function calls': {
			topic: function(){
				return vash.compile( '@function f(i){ <b>@i</b> }<span>@f(it)</span>@f(it)' );
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
				return vash.compile( '@function f(i){ <b>@i</b> function d(i){ <b>@i</b> } @d(model.it) }<span>@f(model.it)</span>@f(model.it)' );
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
				return '<text>It\'s followed by primary content.</text>'
			}
			,"as single quotes": function(topic){
				var tpl = tryCompile(topic);
				assert.equal(tpl(), "It's followed by primary content.")
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
				return '@{ var a = "It\'s followed by primary content."; } @html.raw(a)'
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
				//var tpl = vash.compile(topic, { useWith: false, debug: false });
				assert.equal(tpl(), topic)
			}
		}
		,"style tag with two id rule": {
			topic: function(){
				return '<style type="text/css">#parallax_field #parallax_bg { position: absolute; top: -20px; left: -20px; width: 110%; height: 425px; z-index: 1; }'
			}
			,"is unchanged": function(topic){
				var tpl = vash.compile(topic);
				//var tpl = vash.compile(topic, { useWith: false, debug: false });
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

	,'layout helpers': {

		topic: function(){

			this.opts = function(model){
				return vash.vQuery.extend( model || {}, {
					// mock up express settings
					settings: {
						views: __dirname + '/fixtures/views',
						'view engine': 'vash'
					}
				});
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
				assert.equal( tpl( this.opts({ count: 2 }) ), '<ul><li>a</li><li>a</li></ul>' )
			}
		}

		,'extends': {

			topic: function(opts){
				return function(inner){
					return vash.compile('@html.extends("layout", function(){' + inner + '})');
				}
			}

			,'renders blank': function( maker ){
				assert.equal( maker('')( this.opts() ), '' )
			}

			,'renders expression': function( maker ){
				assert.equal( maker('')( this.opts({ title: 'is title' }) ), 'is title' )
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

				console.log( 'actual', actual )
				assert.equal( actual , '<p>a</p><p>b</p><p>a</p><p>b</p>' );
			}

			,'renders appended content block': function( maker ){
				var  incp = '@html.include("p")'
					,appf = '@html.append("footer", function(){<footer></footer>})'
					,block = '@html.block("content", function(model){' + incp + appf + incp + '})'

					,outp = '<p>a</p>'

					,actual = maker(block)( this.opts({ a: 'a' }) )

				console.log( 'actual', actual )
				assert.equal( actual, outp + '<footer></footer>' + outp );
			}

			,'renders prepended/appended content block': function( maker ){
				var  incp = '@html.include("p")'
					,appf = '@html.append("footer", function(){<app></app>})'
					,pref = '@html.prepend("footer", function(){<pre></pre>})'
					,block = '@html.block("content", function(model){' + incp + appf + pref + incp + '})'

					,outp = '<p>a</p>'

					,actual = maker(block)( this.opts({ a: 'a' }) )

				console.log( 'actual', actual )
				assert.equal( actual, outp + '<pre></pre><app></app>' + outp );
			}
		}

	}

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
});

}
