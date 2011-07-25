
// ## Public Interface / Export
// Keys are quoted to allow for proper export when compressed.

var vash = root["vash"] = root["vash"] || {};

var config = vash["config"] = {
     "useWith": true
    ,"modelName": "model"
};

vash['VLexer'] = VLexer;
vash['VParser'] = VParser;
vash["tpl"] = function tpl(str, useWith){
    // useWith is optional, defaults to value of vash.config.useWith
    var conf = {
        useWith: (useWith === true || useWith === false)
            ? useWith
            : config.useWith
        ,modelName: config.modelName 
    };
    
    var p = new VParser(str);
    p.parse();
    return p.compile(conf);
};