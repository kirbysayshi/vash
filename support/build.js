var fs = require('fs')
	,uglify = require('uglify-js')

	,buildNum = parseInt(fs.readFileSync(__dirname + '/buildnum', 'utf8'), 10)
	,exp = fs.readFileSync(__dirname + '/../src/vash.exports.js', 'utf8')
	,commonFiles = [
		 '../src/vlexer.js'
		,'../src/vparser.js'
		,'../src/vcompiler.js'
	];

function combine(files){
	var b = [];
	files.forEach(function(f){
		b.push( fs.readFileSync(__dirname + '/' + f, 'utf8') );
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

common = combine(commonFiles);
exp = exp
	.replace('?CODE?', common)
	.replace('?BUILDNUM?', ++buildNum);

fs.writeFileSync(__dirname + '/buildnum', buildNum.toString(), 'utf8');
fs.writeFileSync(__dirname + '/../build/vash.js', exp, 'utf8');
fs.writeFileSync(__dirname + '/../build/vash.min.js', minify(exp), 'utf8');
console.log('finished build #' + buildNum);