exports["config"] = {
	 "useWith": false
	,"modelName": "model"
	,"helpersName": "html"
	,"htmlEscape": true
	,"debug": true
	,"debugParser": false
	,"debugCompiler": false
	,"simple": false

	,"favorText": false

	,"externs": [ 'window', 'document' ]

	,"saveTextTag": false
	,"saveAT": false
};

exports["compile"] = function compile(markup, options){

	if(markup === '' || typeof markup !== 'string') {
		throw new Error('Empty or non-string cannot be compiled');
	}

	var  l
		,tok
		,tokens = []
		,p
		,c
		,cmp
		,i;

	options = vQuery.extend( {}, exports.config, options || {} );

	l = new VLexer(markup);
	while(tok = l.advance()) { tokens.push(tok); }
	tokens.reverse(); // parser needs in reverse order for faster popping vs shift

	p = new VParser(tokens, options);
	p.parse();

	c = new VCompiler(p.ast, markup, options);

	cmp = c.generate();
	return cmp;
};

///////////////////////////////////////////////////////////////////////////
// HELPER AND BATCH COMPILATION

var  slice = Array.prototype.slice

	,reHelperFuncHead = /vash\.helpers\.([^= ]+?)\s*=\s*function([^(]*?)\(([^)]*?)\)\s*{/
	,reHelperFuncTail = /\}$/

	,reBatchSeparator = /^\/\/\s*@\s*batch\s*=\s*(.*?)$/

// Given a separator regex and a function to transform the regex result
// into a name, take a string, split it, and group the rejoined strings
// into an object.
// This is useful for taking a string, such as
//
// 		// tpl1
// 		what what
// 		and more
//
// 		// tpl2
// 		what what again
//
// and returning:
//
//		{
//			tpl1: 'what what\nand more\n',
//			tpl2: 'what what again'
//		}
var splitByNamedTpl = function(reSeparator, markup, resultHandler, keepSeparator){

	var  lines = markup.split(/[\n\r]/g)
		,tpls = {}
		,paths = []
		,currentPath = ''

	lines.forEach(function(line, i){

		var  pathResult = reSeparator.exec(line)
			,handlerResult = pathResult ? resultHandler.apply(pathResult, pathResult) : null

		if(handlerResult){
			currentPath = handlerResult;
			tpls[currentPath] = [];
		}

		if((!handlerResult || keepSeparator) && line){
			tpls[currentPath].push(line);
		}
	});

	Object.keys(tpls).forEach(function(key){
		tpls[key] = tpls[key].join('\n');
	})

	return tpls;
}

// The logic for compiling a giant batch of templates or several
// helpers is nearly exactly the same. The only difference is the
// actual compilation method called, and the regular expression that
// determines how the giant string is split into named, uncompiled
// template strings.
var compileBatchOrHelper = function(type, str, options){

	var separator = type === 'helper'
		? reHelperFuncHead
		: reBatchSeparator;

	var tpls = splitByNamedTpl(separator, str, function(ma, name){
		return name.replace(/^\s+|\s+$/, '');
	}, type === 'helper' ? true : false);

	if(tpls){
		Object.keys(tpls).forEach(function(path){
			tpls[path] = type === 'helper'
				? compileSingleHelper(tpls[path], options)
				: vash.compile('@{' + tpls[path] + '}', options);
		});

		tpls.toClientString = function(){
			return Object.keys(tpls).reduce(function(prev, curr){
				if(curr === 'toClientString'){
					return prev;
				}
				return prev + tpls[curr].toClientString() + '\n';
			}, '')
		}
	}

	return tpls;
}

var compileSingleHelper = function(str, options){

	options = options || {};

		// replace leading/trailing spaces, and parse the function head
	var  def = str.replace(/^[\s\n\r]+|[\s\n\r]+$/, '').match(reHelperFuncHead)
		// split the function arguments, kill all whitespace
		,args = def[3].split(',').map(function(arg){ return arg.replace(' ', '') })
		,name = def[1]
		,body = str
			.replace( reHelperFuncHead, '' )
			.replace( reHelperFuncTail, '' )

	// Wrap body in @{} to simulate it actually being inside a function
	// definition, since we manually stripped it. Without this, statements
	// such as `this.what = "what";` that are at the beginning of the body
	// will be interpreted as markup.
	body = '@{' + body + '}';

	// `args` and `asHelper` inform `vash.compile/link` that this is a helper
	options.args = args;
	options.asHelper = name;
	return vash.compile(body, options);
}

///////////////////////////////////////////////////////////////////////////
// VASH.COMPILEHELPER
//
// Allow multiple helpers to be compiled as templates, for helpers that
// do a lot of markup output.
//
// Takes a template such as:
//
// 		vash.helpers.p = function(text){
// 			<p>@text</p>
// 		}
//
// And compiles it. The template is then added to `vash.helpers`.
//
// Returns the compiled templates as named properties of an object.
//
// This is string manipulation at its... something. It grabs the arguments
// and function name using a regex, not actual parsing. Definitely error-
// prone, but good enough. This is meant to facilitate helpers with complex
// markup, but if something more advanced needs to happen, a plain helper
// can be defined and markup added using the manual Buffer API.
exports['compileHelper'] = compileBatchOrHelper.bind(null, 'helper');

///////////////////////////////////////////////////////////////////////////
// VASH.COMPILEBATCH
//
// Allow multiple templates to be contained within the same string.
// Templates are separated via a sourceURL-esque string:
//
// //@batch = tplname/or/path
//
// The separator is forgiving in terms of whitespace:
//
// // @      batch=tplname/or/path
//
// Is just as valid.
//
// Returns the compiled templates as named properties of an object.
exports['compileBatch'] = exports['batch'] = compileBatchOrHelper.bind(null, 'batch');

// HELPER AND BATCH COMPILATION
///////////////////////////////////////////////////////////////////////////

exports["VLexer"] = VLexer;
exports["VParser"] = VParser;
exports["VCompiler"] = VCompiler;
exports["vQuery"] = vQuery;
