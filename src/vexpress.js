exports.__express = function(){

	if( typeof window === 'undefined' ){
		var fs = require('fs')
	
		return function(filepath, options, cb){
			fs.readFile(filepath, 'utf8', function(err, contents){
				if( err ){ return cb(err); }	
				var tpl = exports.compile(contents);
				console.log(tpl.toString());
				cb(null, tpl(options));	
			})
		}
	}
	
}();
