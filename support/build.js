var  fs = require('fs')
	,uglify = require('uglify-js')
	,request = require('request')
	,semver = require('semver')

	,ENC = 'utf8'

	,vash = require('../build/vash')
	,vashOpts = {
		 favorText: true
		,modelName: 'it'
	}

	,pkg = JSON.parse( fs.readFileSync(__dirname + '/../package.json', ENC) )
	,buildNum = semver.inc( pkg.version, 'build' )

	,exp = fs.readFileSync(__dirname + '/../src/vash.exports.js', ENC)

	,tpls = [ 
		'../support/license.header.js' 
	].reduce(function(lib, path){
		lib[ path.split('/').pop() ] = vash.compile( 
			 fs.readFileSync( __dirname + '/' + path, ENC)
			,vashOpts
		);
		return lib;
	}, {})

	,fileGroups = {

		all: [
			 '../src/vruntime.js'
			,'../src/vhelpers.js'
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
	};


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

var  license = tpls['license.header.js']
	,lmodel = { version: buildNum }
	,concatAll = combine(fileGroups.all)
	,concatRuntimeReq = combine(fileGroups.runtimereq)
	,concatRuntimeAll = combine(fileGroups.runtimeall);

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

// read in package.json, retrieve version + build num
// write package.json, same version + incremented build num
// read in license header, compile as template (favor text)
// read in exports header, compile as template (favor text)

// read in all required files
// concat
// minify

// vash-all.js: license header + browser exports header + compiler + runtime + browser exports footer
// vash-all.min.js: license header + browser exports header + compiler + runtime + browser exports footer
// vash-runtime.js: license header + runtime
// vash-runtime.min.js: license header + runtime



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

