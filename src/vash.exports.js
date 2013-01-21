/*jshint strict:false, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */

;(function(vash){

	// this pattern was inspired by LucidJS,
	// https://github.com/RobertWHurst/LucidJS/blob/master/lucid.js

	if(typeof define === 'function' && define['amd']){
		define(function(){ return vash }); // AMD
	} else if(typeof module === 'object' && module['exports']){
		module['exports'] = vash; // NODEJS
	} else {
		window['vash'] = vash; // BROWSER
	}

})(function(exports){

	var vash = exports; // neccessary for nodejs references

	exports["version"] = "?BUILDNUM?";
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
	// VASH.BATCH
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

	exports['batch'] = function(markup, options){

		var tpls = splitByNamedTpl(markup).batch;

		if(tpls){
			Object.keys(tpls).forEach(function(path){
				tpls[path] = vash.compile(tpls[path], options);
			});
		}

		return tpls;
	}

	// do the actual work of splitting the string via the batch separator
	var splitByNamedTpl = function(markup){

		var  reSourceMap = /^\/\/\s*@\s*(batch|helper)\s*=\s*(.*?)$/
			,lines = markup.split(/[\n\r]/g)
			,tpls = {
				 batch: {}
				,helper: {}
			}
			,paths = []
			,currentPath = ''
			,typePointer = tpls.batch;

		lines.forEach(function(line, idx, arr){
			var  pathResult = reSourceMap.exec(line)
				,atEnd = idx === arr.length - 1;

			if(!pathResult || atEnd){
				tpls[typePointer][currentPath].push(line);
			}

			if((pathResult || atEnd) && currentPath){
				tpls[typePointer][currentPath] = tpls[typePointer][currentPath].join('\n');
			}

			if(pathResult){
				typePointer = pathResult[1];
				currentPath = pathResult[2].replace(/^\s+|\s+$/, '');
				tpls[typePointer][currentPath] = [];
			}
		});

		return tpls;
	}

	// VASH.BATCH
	///////////////////////////////////////////////////////////////////////////

	///////////////////////////////////////////////////////////////////////////
	// HELPER INSTALLATION

	var  slice = Array.prototype.slice
		,reFuncHead = /^vash\.helpers\.([^= ]+?)\s*=\s*function([^(]*?)\(([^)]*?)\)\s*{/
		,reFuncTail = /\}$/

	exports['compileHelper'] = function reg(str, options){

		options = options || {};

			// replace leading/trailing spaces, and parse the function head
		var  def = str.replace(/^\s+|\s+$/, '').match(reFuncHead)
			// split the function arguments, kill all whitespace
			,args = def[3].split(',').map(function(arg){ return arg.replace(' ', '') })
			,name = def[1]
			,body = str
				.replace( reFuncHead, '' )
				.replace( reFuncTail, '' )

		// Wrap body in @{} to simulate it actually being inside a function
		// definition, since we manually stripped it. Without this, statements
		// such as `this.what = "what";` that are at the beginning of the body
		// will be interpreted as markup.
		body = '@{' + body + '}';

		// `args` and `asHelper` inform `vash.compile/link` that this is a helper
		options.args = args;
		options.asHelper = name;
		vash.compile(body, options);
	}

	// HELPER INSTALLATION
	///////////////////////////////////////////////////////////////////////////

	/************** Begin injected code from build script */
	/*?CODE?*/
	/************** End injected code from build script */

	exports["VLexer"] = VLexer;
	exports["VParser"] = VParser;
	exports["VCompiler"] = VCompiler;
	exports["vQuery"] = vQuery;

	return exports;
}({}));
