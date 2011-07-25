var config = {
     "useWith": true
    ,"modelName": "model"
};

module.exports = {
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
};