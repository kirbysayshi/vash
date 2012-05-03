var  Benchmark = require('benchmark')
	,vash = require('../build/vash')
	,dot = require('dot')
	,jshtml = require('jshtml')
	,fs = require('fs')

	,largeVTemplate = fs.readFileSync(__dirname + '/fixtures/largeTemplate.vash', 'utf8')
	,mediumVTemplate = fs.readFileSync(__dirname + '/fixtures/mediumTemplate.vash', 'utf8')
	,mediumVTemplateNoWith = fs.readFileSync(__dirname + '/fixtures/mediumTemplate.nowith.vash', 'utf8')
	,smallVTemplate = fs.readFileSync(__dirname + '/fixtures/smallTemplate.vash', 'utf8')
	
	,mediumJSHTMLTemplateNoWith = fs.readFileSync(__dirname + '/fixtures/mediumTemplate.nowith.jshtml', 'utf8')

	,largeDTemplate = fs.readFileSync(__dirname + '/fixtures/largeTemplate.dot.html', 'utf8')
	,mediumDTemplate = fs.readFileSync(__dirname + '/fixtures/mediumTemplate.dot.html', 'utf8')
	,smallDTemplate = fs.readFileSync(__dirname + '/fixtures/smallTemplate.dot.html', 'utf8')

	,largeVTpl = vash.compile(largeVTemplate, { useWith: true })
	,mediumVTpl = vash.compile(mediumVTemplate, { useWith: true })
	,mediumVTplNoWith = vash.compile(mediumVTemplateNoWith)
	,mediumVTplNoWithNoEscape = vash.compile( mediumVTemplateNoWith, { debug: false, useWith: false, htmlEscape: false } )
	,smallVTpl = vash.compile(smallVTemplate, { useWith: true })

	,largeJSHTMLTpl = jshtml.compile(largeVTemplate, { 'with': true })
	//,mediumJSHTMLTpl = jshtml.compile(mediumVTemplate, {})
	,mediumJSHTMLTplNoWith = jshtml.compile(mediumJSHTMLTemplateNoWith, { 'with': false })
	,smallJSHTMLTpl = jshtml.compile(smallVTemplate, { 'with': true })

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

	,mediumVConfig = { debug: false, useWith: false, htmlEscape: false }
	,mediumVConfigHtmlEscape = { debug: false, useWith: false, htmlEscape: true }

	//,largeTokens = new vash.VParser(largeVTemplate).parse()
	//,mediumTokens = new vash.VParser(mediumVTemplate).parse()
	//,smallTokens = new vash.VParser(smallVTemplate).parse()

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
//logSuiteName(suite);
//suite.run();

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
//logSuiteName(suite);
//suite.run();

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
//logSuiteName(suite);
//suite.run();

suite = new Benchmark.Suite("vash vs doT compilation small")
.add("dot#template small", function(){
	dot.template( smallDTemplate )
})
.add("vash#tpl small", function(){
	vash.compile(smallVTemplate)
})
//logSuiteName(suite);
//suite.run();

suite = new Benchmark.Suite("vash vs ... render large")
.add("dot#template large", function(){
	largeDTpl( largeData );
})
.add("vash#tpl large", function(){
	largeVTpl( largeData );
})
.add("jshtml#template large", function(){
	largeJSHTMLTpl( largeData )
})
//logSuiteName(suite);
//suite.run();

suite = new Benchmark.Suite("vash vs ... render medium")
.add("dot#template medium", function(){
	mediumDTpl( mediumData )
})
.add("vash#tpl medium", function(){
	mediumVTpl( mediumData )
})
.add("vash#tpl medium no with", function(){
	mediumVTplNoWith( mediumData )
})
.add("vash#tpl medium no with no htmlescape", function(){
	mediumVTplNoWithNoEscape( mediumData )
})
//.add("jshtml#template medium", function(){
//	mediumJSHTMLTpl( mediumData, {} )
//})
.add("jshtml#template medium no with", function(){
	mediumJSHTMLTplNoWith( mediumData, { 'with': false } )
})
//logSuiteName(suite);
//suite.run();

suite = new Benchmark.Suite("vash vs ... render small")
.add("dot#template small", function(){
	smallDTpl( smallData )
})
.add("vash#tpl small", function(){
	smallVTpl( smallData )
})
.add("jshtml#tpl small", function(){
	smallJSHTMLTpl( smallData, {} )
})
//logSuiteName(suite);
//suite.run();

var longString = Array(1000).join(Math.random())

var indexed = function(){

    var idx = 0, out = [];
    
    out[idx++] = longString;
    out[idx++] = longString;
    out[idx++] = longString;
    out[idx++] = longString;
    out[idx++] = longString;
    out[idx++] = longString;
    out[idx++] = longString;

    return out.join('')
}
    
var pushed = function(){
    var out = [];
    
    out.push(longString)
    out.push(longString)
    out.push(longString)
    out.push(longString)
    out.push(longString)
    out.push(longString)
    out.push(longString)

    return out.join('')
}

var plussed = function(){
    var out = '';
    
    out += longString
    out += longString
    out += longString
    out += longString
    out += longString
    out += longString
    out += longString

    return out;
}

var concated = function(){
    var out = '';
    
    out += longString
    + longString
    + longString
    + longString
    + longString
    + longString
    + longString

    return out;
}

suite = new Benchmark.Suite('string concat: index vs push vs += vs +')
.add('indexed', function(){
	indexed();
})
.add('pushed', function(){
	pushed();
})
.add('plussed', function(){
	plussed();
})
.add('concated', function(){
	concated();
});
//logSuiteName(suite);
//suite.run();

var tpushsimple = function anonymous(model) {
    var __vo = [], __vt;
    var __lt = "&lt;", __gt = "&gt;", __amp = "&amp;", __quot = "&quot;", __ltre = /</g, __gtre = />/g, __ampre = /&(?!\w+;)/g, __quotre = /"/g;
    __vo.push("<div class=\"how\">");
    __vo.push(" ");
    for (var i = 0; i < 1; i++) {
        __vo.push("<div class=\"item-");
        __vo.push((typeof (__vt = i) !== "undefined" ? __vt : "").toString().replace(__ampre, __amp).replace(__ltre, __lt).replace(__gtre, __gt).replace(__quotre, __quot));
        __vo.push("\"");
        __vo.push(">");
        __vo.push("I");
        __vo.push(" ");
        __vo.push("be");
        __vo.push(" ");
        __vo.push("an");
        __vo.push(" ");
        __vo.push("item");
        __vo.push("!");
        __vo.push("</div>");
    }
    __vo.push(" ");
    __vo.push("</div>");
    return __vo.join("");
}

var tpushsimplecoalesced = function anonymous(model) {
    var __vo = [], __vt;
    var __lt = "&lt;", __gt = "&gt;", __amp = "&amp;", __quot = "&quot;", __ltre = /</g, __gtre = />/g, __ampre = /&(?!\w+;)/g, __quotre = /"/g;
    __vo.push("<div class=\"how\"> ");
    for (var i = 0; i < 1; i++) {
        __vo.push("<div class=\"item-");
        __vo.push((typeof (__vt = i) !== "undefined" ? __vt : "").toString().replace(__ampre, __amp).replace(__ltre, __lt).replace(__gtre, __gt).replace(__quotre, __quot));
        __vo.push("\">I be an item!</div>");
    }
    __vo.push(" </div>");
    return __vo.join("");
}

var tvashactual = vash.compile('<div class="how"> @for(var i = 0; i < 1; i++){ <div class="item-@i">I be an item!</div> } </div>', { debug: false, useWith: false });

var tconcatsimple = function anonymous(model) {
    var __vout = '', __vtemp;
    __vout += "<div class=\"how\">" + " ";
    for (var i = 0; i < 1; i++) {
        __vout += "<div class=\"item-"
        + (typeof (__vtemp = i) !== "undefined" ? __vtemp : "").toString().replace(/&(?!w+;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
        + "\""
        + ">"
        + "I"
        + " "
        + "be"
        + " "
        + "an"
        + " "
        + "item"
        + "!"
        + "</div>"
    }
    __vout += " " + "</div>";
    return __vout;
}

var tpush = function anonymous(model) {
    var __vo = [], __vt;

    function f(i) {
        __vo.push("<b>");
        __vo.push((typeof (__vt = i) !== "undefined" ? __vt : "").toString().replace(/&(?!\w+;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"));
        __vo.push("</b>");
    }

    __vo.push("<span>");
    __vo.push((typeof (__vt = f(model.it)) !== "undefined" ? __vt : "").toString().replace(/&(?!\w+;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"));
    __vo.push("</span>");
    __vo.push((typeof (__vt = f(model.it)) !== "undefined" ? __vt : "").toString().replace(/&(?!\w+;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"));
    return __vo.join("");
}

var tconcat = function anonymous(model) {

    var __vout = '', __vback = '', __vtemp = '';


    function f(i) {
        __vout += "<b>"
            + i.toString().replace(/&(?!w+;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
            + "</b> "
    }

    __vout += "<span>";

    // have to stop concat, because we don't know what side-effects f might have
    __vback = __vout; // huge string copy
    __vout = '';
    __vtemp = f(model.it)
    __vout = __vback + __vout + (__vtemp ? __vtemp : '')
        + "</span>";

    // an do the whole thing again...
    __vback = __vout;
    __vout = '';
    __vtemp += f(model.it);
    __vout = __vback + __vout + (__vtemp ? __vtemp : '')

    return __vout;
}

suite = new Benchmark.Suite('tpl concat vs push')
.add('push simple', function(){
	tpushsimple( { it: 'what' } );
})
.add('push simple coalesced', function(){
	tpushsimplecoalesced( { it: 'what' } );
})
.add('vash actual', function(){
	tvashactual( { it: 'what' } );
})
.add('concat simple', function(){
	tconcatsimple( { it: 'what' } );
})
.add('push', function(){
	tpush( { it: 'what' } );
})
.add('concat', function(){
	tconcat( { it: 'what' } );
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