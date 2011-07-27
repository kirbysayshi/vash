var config = {
     "useWith": true
    ,"modelName": "model"
};

var vash = module.exports = {
    tpl: function(str, useWith){
        var conf = {
            useWith: (useWith === true || useWith === false)
                ? useWith
                : config.useWith
            ,modelName: config.modelName 
        };

        var p = new VParser(str);
        p.parse();
        return p.compile(conf);
    }
    ,config: config
	,VParser: VParser
	,VLexer: VLexer
	
	// express support
	,compile: function(markup, options){
		options = options || config;
		var cmp = vash.tpl(markup, options.useWith);
		
		return function render(locals){
			return cmp(locals);
		}
	}
	
};