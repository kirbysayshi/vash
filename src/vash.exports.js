(function(exports){

	exports["version"] = "0.2.1-?BUILDNUM?";

	exports["config"] = {
		 "useWith": false
		,"modelName": "model"
	};

	/************** Begin injected code from build script */
	?CODE?
	/************** End injected code from build script */

	exports["VLexer"] = VLexer;
	exports["VParser"] = VParser;
	exports["tpl"] = function tpl(str, useWith){
		// useWith is optional, defaults to value of vash.config.useWith
		var conf = {
			useWith: (useWith === true || useWith === false)
				? useWith
				: exports.config.useWith
			,modelName: exports.config.modelName 
		};
		
		var p = new VParser(str);
		p.parse();
		return p.compile(conf);
	};

	// Express support
	// This is small enough that it's ok if the browser also gets it
	exports["compile"] = function(markup, options){

		var cmp = exports.tpl(markup, exports.config.useWith);
		
		return function render(locals){
			return cmp(locals);
		}
	}

})(typeof exports === 'undefined' ? this['vash'] = {} : exports);