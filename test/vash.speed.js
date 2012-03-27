var  Benchmark = require('benchmark')
	,vash = require('../build/vash')
	,dot = require('dot')
	,fs = require('fs')

	,largeVTemplate = fs.readFileSync(__dirname + '/fixtures/largeTemplate.vash', 'utf8')
	,mediumVTemplate = fs.readFileSync(__dirname + '/fixtures/mediumTemplate.vash', 'utf8')
	,mediumVTemplateNoWith = fs.readFileSync(__dirname + '/fixtures/mediumTemplate.nowith.vash', 'utf8')
	,smallVTemplate = fs.readFileSync(__dirname + '/fixtures/smallTemplate.vash', 'utf8')
	
	,largeDTemplate = fs.readFileSync(__dirname + '/fixtures/largeTemplate.dot.html', 'utf8')
	,mediumDTemplate = fs.readFileSync(__dirname + '/fixtures/mediumTemplate.dot.html', 'utf8')
	,smallDTemplate = fs.readFileSync(__dirname + '/fixtures/smallTemplate.dot.html', 'utf8')

	,largeVTpl = vash.compile(largeVTemplate, { useWith: true })
	,mediumVTpl = vash.compile(mediumVTemplate, { useWith: true })
	,mediumVTplNoWith = vash.compile(mediumVTemplateNoWith)
	,smallVTpl = vash.compile(smallVTemplate, { useWith: true })

	,largeDTpl = dot.template(largeDTemplate)
	,mediumDTpl = dot.template(mediumDTemplate)
	,smallDTpl = dot.template(smallDTemplate)

	,largeData = (function(){
		var items = [];

		for(var i = 0; i < 1000; i++){
			items.push('item number ' + i);
		}

		return {
			liData: 'i am list item data'
			,title: 'main title'
			,subtitle: 'i am the subtitle'
			,items: items
		}
	})()
	,mediumData = {
		 header: "Header"
		,header2: "Header2"
		,header3: "Header3"
		,header4: "Header4"
		,header5: "Header5"
		,header6: "Header6"
		,list: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
	}
	,smallData = {
		 somevar: 'no'
		,anothervar: 'there is another'
	}

	,largeTokens = new vash.VParser(largeVTemplate).parse()
	,mediumTokens = new vash.VParser(mediumVTemplate).parse()
	,smallTokens = new vash.VParser(smallVTemplate).parse()

	,suite;

//console.log(mediumDTpl.toString());
//console.log(mediumVTplNoWith.toString());

vash.config.useWith = true;

function logSuiteName(suite){
	
	console.log('');
	//console.log('_______________________________________________')
	//console.log('***********************************************');
	console.log(suite.name);
	console.log('-----------------------------------------------')
	console.log('');
	//console.log('-----------------------------------------------')
}

Benchmark.Suite.options.onCycle = function(event, bench){
	console.log('    >', String(bench));
}

Benchmark.Suite.options.onComplete = function(e, bench){
	//console.log(bench);
	//console.log(arguments)
	//console.log(bench.name, 'elapsed time', bench.times.elapsed);
	console.log('');
	//console.log('_______________________________________________')
	console.log('    Fastest is ' + this.filter('fastest').pluck('name'));
	//console.log('-----');
}

suite = new Benchmark.Suite("vash parse times by template size")
.add("vash#parse large", function(){
	new vash.VParser(largeVTemplate).parse()
})
.add("vash#parse medium", function(){
	new vash.VParser(mediumVTemplate).parse()
})
.add("vash#parse small", function(){
	new vash.VParser(smallVTemplate).parse()
})
logSuiteName(suite);
suite.run();

//suite = new Benchmark.Suite("vash generate times by template size")
//.add("vash#generate tokens large", function(){
//	vash._generate(largeTokens);
//})
//.add("vash#generate tokens medium", function(){
//	vash._generate(mediumTokens);
//})
//.add("vash#generate tokens small", function(){
//	vash._generate(smallTokens);
//})
//logSuiteName(suite);
//suite.run();

suite = new Benchmark.Suite("vash vs doT compilation large")
.add("dot#template large", function(){
	dot.template( largeDTemplate )
})
.add("vash#tpl large", function(){
	vash.compile(largeVTemplate)
})
logSuiteName(suite);
suite.run();

suite = new Benchmark.Suite("vash vs doT compilation medium")
.add("dot#template medium", function(){
	dot.template( mediumDTemplate )
})
.add("vash#tpl medium", function(){
	vash.compile(mediumVTemplate)
})
.add("vash#tpl medium no with", function(){
	vash.compile(mediumVTemplateNoWith, false)
})
logSuiteName(suite);
suite.run();

suite = new Benchmark.Suite("vash vs doT compilation small")
.add("dot#template small", function(){
	dot.template( smallDTemplate )
})
.add("vash#tpl small", function(){
	vash.compile(smallVTemplate)
})
logSuiteName(suite);
suite.run();

suite = new Benchmark.Suite("vash vs doT render large")
.add("dot#template large", function(){
	largeDTpl( largeData );
})
.add("vash#tpl large", function(){
	largeVTpl( largeData );
})
logSuiteName(suite);
suite.run();

suite = new Benchmark.Suite("vash vs doT render medium")
.add("dot#template medium", function(){
	mediumDTpl( mediumData )
})
.add("vash#tpl medium", function(){
	mediumVTpl( mediumData )
})
.add("vash#tpl medium no with", function(){
	mediumVTplNoWith( mediumData )
})
logSuiteName(suite);
suite.run();

suite = new Benchmark.Suite("vash vs doT render small")
.add("dot#template small", function(){
	smallDTpl( smallData )
})
.add("vash#tpl small", function(){
	smallVTpl( smallData )
})
logSuiteName(suite);
suite.run();


//.on('cycle', function(event, bench){
//	console.log(String(bench));
//})
//.on('complete', function(e, bench){
//	console.log('elapsed time', bench.times.elapsed);
//})
//.run(true);