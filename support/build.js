#!/usr/bin/env node

var  fs = require('fs')
	,uglify = require('uglify-js')
	,request = require('request')
	,semver = require('semver')
	,jshint = require('jshint')
	,_ = require('underscore')
	,cli = require('commander')

	,ENC = 'utf8'

	// DOGFOOD!
	,vash = require('../build/vash')
	,vashOpts = {
		 favorText: true
		,modelName: 'it'
		,client: false
	}

	,pkg = JSON.parse( fs.readFileSync(__dirname + '/../package.json', ENC) )
	,buildNum = semver.inc( pkg.version, 'build' )

	,exp = fs.readFileSync(__dirname + '/../src/vash.exports.js', ENC)

	// this will be transformed into an object containing templates keyed by filename
	,tpls = [ 
		'../support/license.header.js' 
	]

	,fileGroups = {

		lint: [
			 '../src/vash.exports.js'
			,'../src/vruntime.js'
			,'../src/vhelpers.js'
			,'../src/vlexer.js'
			,'../src/vast.js'
			,'../src/vparser.js'
			,'../src/vcompiler.js'
		]

		,all: [
			 '../src/vruntime.js'
			,'../src/vhelpers.js'
			,'../src/vexpress.js'
			,'../src/vlexer.js'
			,'../src/vast.js'
			,'../src/vparser.js'
			,'../src/vcompiler.js'
		]

		,runtimereq: [
			'../src/vruntime.js'
		]

		,runtimeall: [
			 '../src/vruntime.js'
			,'../src/vhelpers.js'
		]
		
		,browser: [
			 '../src/vruntime.js'
			,'../src/vhelpers.js'
			,'../src/vlexer.js'
			,'../src/vast.js'
			,'../src/vparser.js'
			,'../src/vcompiler.js'
		]

	}

	// these are applied as defaults if not specified per file
	,lintOpts = {
		 strict: false
		,asi:true
		,laxcomma:true
		,laxbreak:true
		,boss:true
		,curly:true
		,node:true
		,browser:true
		,devel:true
		,sub:true
		,smarttabs:true
	};

///////////////////////////////////////////////////////////////////////////////
// Helper Functions

function combine(files){
	var b = [];
	files.forEach(function(f){
		b.push( fs.readFileSync(__dirname + '/' + f, ENC) );
	});
	
	return b.join('\n');
}

function minify(str){
	var ast
	 	,jsp = uglify.parser
		,pro = uglify.uglify;
	ast = jsp.parse(str); 
	ast = pro.ast_mangle(ast);
	ast = pro.ast_squeeze(ast);
	return pro.gen_code(ast);
}

function writeBuild(filename, content){
	fs.writeFileSync(__dirname + '/../build/' + filename, content, ENC);
}

function parseLintLine(txt){
	var reLLine = /^\/\*jshint (.*?) ?\*\//gi
		,result = reLLine.exec(txt);

	if( result ){
		result = result[1].split(/, ?/).reduce(function(obj, pair){
			pair = pair.split(':');

			pair[1] = Boolean(pair[1])

			if( obj[pair[0]] && obj[pair[0]] instanceof Array ){
				obj[pair[0]].push( pair[1] )
			} else {
				obj[pair[0]] = [ obj[pair[0]], pair[1] ];
			}

			obj[pair[0]] = pair[1];
			return obj;
		}, {})
	}

	return result;
}

function lint(files){

	files.forEach(function(file){
		var fileContents = fs.readFileSync( __dirname + '/' + file, ENC );
		var config = parseLintLine(file);
		jshint.JSHINT( fileContents, _.defaults(config || {}, lintOpts) );
		reportLint(file, jshint.JSHINT.errors);
	})
}

function reportLint(filePath, results, data){

    var len = results.length,
        str = '',
        file, error;

    results.forEach(function (result) {
        file = result.evidence.trim();
        str += file + ': line ' + result.line + ', col ' +
            result.character + ', ' + result.reason + '\n';
    });

    if (str) {
        process.stdout.write(
        	filePath + ': ' + len + ' jshint error' + ((len === 1) ? '' : 's')
        	+ "\n" + str 
        	+  "\n");
    }
}

function loadTemplates(list){

	// compile templates, insert into existing list of paths
	list.reduce(function(lib, path){
		lib[ path.split('/').pop() ] = vash.compile( 
			 fs.readFileSync( __dirname + '/' + path, ENC)
			,vashOpts
		);
		return lib;
	}, list);
}

// Helper Functions
///////////////////////////////////////////////////////////////////////////////




///////////////////////////////////////////////////////////////////////////////
// Build Process

function build(){

	loadTemplates(tpls);

	var  license = tpls['license.header.js']
		,lmodel = { version: buildNum }
		,concatAll = combine(fileGroups.all)
		,concatRuntimeReq = combine(fileGroups.runtimereq)
		,concatRuntimeAll = combine(fileGroups.runtimeall)
		,concatBrowser = combine(fileGroups.browser)

	exp = exp
		.replace('/*?CODE?*/', concatAll)
		.replace('?BUILDNUM?', buildNum);

	writeBuild( 'vash.js', license(lmodel) + exp );
	writeBuild( 'vash.min.js', license(lmodel) + minify(exp) );

	writeBuild( 'vash-runtime.js', license(lmodel) + concatRuntimeReq );
	writeBuild( 'vash-runtime.min.js', license(lmodel) + minify(concatRuntimeReq) );

	writeBuild( 'vash-runtime-all.js', license(lmodel) + concatRuntimeAll );
	writeBuild( 'vash-runtime-all.min.js', license(lmodel) + minify(concatRuntimeAll) );

	pkg.version = buildNum;
	fs.writeFileSync( __dirname + '/../package.json', JSON.stringify(pkg, null, '\t'), ENC );

	console.log('finished build ' + buildNum);
}

cli
	.command('lint')
	.description('Run all files through jshint')
	.action(function(){ lint(fileGroups.lint); });

cli
	.command('build')
	.description('Concat, minify, copy to build folder. Increase buildnum in package.json.')
	.action(build)

cli
	.command('all')
	.description('Lint + Build')
	.action(function(){ 
		lint(fileGroups.lint);
		build();
	});

cli
	.command('closure')
	.option('-a, --advanced', 'enable ADVANCED_OPTIMIZATIONS (will most likely fail)')
	.option('-p, --pretty_print', 'pretty print the output')
	.description('Hit up closure-compiler.appspot, create vash.closure.min.js')
	.action(function(options){ 
		
		loadTemplates(tpls);

		var  license = tpls['license.header.js']
			,lmodel = { version: buildNum }
			,concatAll = combine(fileGroups.all)
			,concatRuntimeReq = combine(fileGroups.runtimereq)
			,concatRuntimeAll = combine(fileGroups.runtimeall);

		exp = exp
			.replace('/*?CODE?*/', concatAll)
			.replace('?BUILDNUM?', buildNum);

		exp = license(lmodel) + exp;

		var reqopts =  {
			 compilation_level: options.advanced ? 'ADVANCED_OPTIMIZATIONS' : 'SIMPLE_OPTIMIZATIONS'
			,output_format: 'text'
			,output_info: 'compiled_code'
			,js_code: exp
			,js_externs: 'function define(){}function module(){}function exports(){}'
			,formatting:  'pretty_print'
		};

		if( !options.pretty_print ){
			delete reqopts.formatting;
		}

		request.post({ 
			url: 'http://closure-compiler.appspot.com/compile'
			,method: 'POST'
			,form: reqopts
		}, function(err, resp, body){
			if(!err){
				fs.writeFileSync(__dirname + '/../build/vash.closure.min.js', body, 'utf8');		
				console.log('finished closure build ' + buildNum);
			} else {
				console.log('finished closure build ' + buildNum + ', but was unable to minify: ' + err);
			}

			process.exit();
		})

	});

cli.parse(process.argv);

if (process.argv.length < 3) console.log( cli.helpInformation() );

/*request.post({ 
	url: 'http://closure-compiler.appspot.com/compile'
	,method: 'POST'
	,form: {
		compilation_level: 'ADVANCED_OPTIMIZATIONS'
		,output_format: 'text'
		,output_info: 'compiled_code'
		,js_code: exp
		,js_externs: 'function define(){}function module(){}function exports(){}'
		,formatting: 'pretty_print'
	}
}, function(err, resp, body){
	if(!err){
		fs.writeFileSync(__dirname + '/../build/vash.closure.min.js', body, 'utf8');		
		console.log('finished build #' + buildNum);
	} else {
		console.log('finished build #' + buildNum + ', but was unable to minify: ' + err);
	}

	process.exit();
})*/

