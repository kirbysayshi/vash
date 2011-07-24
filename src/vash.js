(function(root){

var config = {
     "useWith": true
    ,"modelName": "model"
};

if(typeof module !== 'undefined' && module.exports && typeof require !== 'undefined'){
    
    var  L = require('./vlexer')
        ,P = require('./vparser');

    module.exports = {
        tpl: function(str, useWith){
            var conf = {
                useWith: (useWith === true || useWith === false)
                    ? useWith
                    : config.useWith
                ,modelName: config.modelName 
            };

            var p = new P(str);
            p.parse();
            return p.compile(conf);
        }
        ,config: config
		,VParser: P
		,VLexer: L
    }

} else {

    // ## Public Interface / Export
    // Keys are quoted to allow for proper export when compressed.

    var vash = root["vash"] = root["vash"] || {};

    //"_err": ERR

    vash["tpl"] = function tpl(str, useWith){
        // useWith is optional, defaults to value of vash.config.useWith
        var conf = {
            useWith: (useWith === true || useWith === false)
                ? useWith
                : config.useWith
            ,modelName: config.modelName 
        };
        
        var p = new vash.VParser(str);
        p.parse();
        return p.compile(conf);
    };

    vash["config"] = config;
}

})(this);
