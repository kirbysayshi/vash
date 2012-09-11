exports.__express = (function(){

	if( typeof window === 'undefined' ){
		var fs = require('fs')

		var  env = process.env.NODE_ENV || 'development'
			,tplcache = {}

		return function(filepath, options, cb){

			var tpl = tplcache[filepath];

			if( !tpl ){
				
				fs.readFile(filepath, 'utf8', function(err, contents){ 
					if( err ){ return cb(err); }

					tpl = exports.compile(contents)

					if( env !== 'development' ){
						tplcache[filepath] = exports.compile(contents);
					}

					console.log(tpl.toString());
					cb(null, tpl(options));	
				})
			} else {
				cb(null, tpl(options));
			}
		}
	}
	
})();
