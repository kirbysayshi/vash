var fs = require('fs')
	,uglify = require('uglify-js')

	,browserFiles = [
		'../src/vash.browser.js'
	]
	,nodeFiles = [
		'../src/vash.node.js'
	]
	,commonFiles = [
		'../src/vlexer.js'
		,'../src/vparser.js'
		//,'../src/vash.js'
	]
	
	,common = ''
	,browser = ''
	,node = ''
	,fnWrap = '(function(root){\n????\n})(this)';

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
browser = combine(browserFiles);
node = combine(nodeFiles);

browser = fnWrap.replace('????', common + '\n' + browser);

fs.writeFileSync(__dirname + '/../build/index.js', common + node, 'utf8');
fs.writeFileSync(__dirname + '/../build/vash.js', browser, 'utf8');
fs.writeFileSync(__dirname + '/../build/vash.min.js', minify(browser), 'utf8');