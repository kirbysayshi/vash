;(function(){


	///////////////////////////////////////////////////////////////////////////
	// LAYOUT HELPERS

	// semi hacky guard to prevent non-nodejs erroring
	if( typeof window === 'undefined' ){
		var  fs = require('fs')
			,path = require('path')
	}

	var helpers = vash.helpers;

	// TRUE implies that all TPLS are loaded and waiting in cache
	helpers.config.browser = false;

	helpers.tplcache = {};
	helpers.blocks = {};
	helpers.appends = [];
	helpers.prepends = [];

	vash.loadFile = function(filepath, options, cb){

		// options are passed in via Express
		// {
		//   settings:
		//   {
		//      env: 'development',
		//   	'jsonp callback name': 'callback',
		//   	'json spaces': 2,
		//   	views: '/Users/drew/Dropbox/js/vash/test/fixtures/views',
		//   	'view engine': 'vash'
		//   },
		//   _locals: [Function: locals],
		//   cache: false
		// }

		// extend works from right to left, using first arg as target
		options = vQuery.extend( {}, vash.config, options || {} );

		var browser = helpers.config.browser
			,tpl

		if( !browser && options.settings && options.settings.views && options.settings['view engine'] ){
			filepath = filepath.indexOf(options.settings.views) > -1
				? filepath
				: path.join( options.settings.views
					,filepath
					+ ( path.extname(filepath)
						? ''
						: '.' + options.settings['view engine'] ) );
		}

		// if browser, tpl must exist in tpl cache
		tpl = options.cache || browser
			? helpers.tplcache[filepath] || ( helpers.tplcache[filepath] = vash.compile(fs.readFileSync(filepath, 'utf8')) )
			: vash.compile( fs.readFileSync(filepath, 'utf8') )

		cb && cb(null, tpl);
	}

	vash.renderFile = function(filepath, options, cb){

		vash.loadFile(filepath, options, function(err, tpl){
			cb(err, tpl(options));
		})
	}

	helpers.extends = function(path, ctn){
		var  self = this
			,origModel = this.model;

		// this is a synchronous callback
		vash.loadFile(path, this.model, function(err, tpl){
			ctn(self.model); // the child content
			tpl(self.model); // the tpl being extended
		})

		this.model = origModel;
	}

	helpers.include = function(name, model){

		var self = this, origModel = this.model;

		// this is a synchronous callback
		vash.loadFile(name, this.model, function(err, tpl){
			tpl(model || self.model);
		})

		this.model = origModel;
	}

	helpers.block = function(name, ctn){
		var bstart, ctnLines, self = this;

		// Because this is at RUNTIME, blocks are tricky. Blocks can "overwrite"
		// each other, but the "highest level" block must not have a callback.
		// This signifies that it should render out, instead of replacing.
		// In the future, this should be handled at compile time, which would
		// remove this restriction.

		if( !ctn ){

			if( this.hasPrepends(name) ){
				this.prepends[name].forEach(function(a){ a(self.model); });
				this.prepends[name].length = 0;
			}

			if( this.hasBlock(name) ){
				this.blocks[name](this.model);
				delete this.blocks[name];
			}

			if( this.hasAppends(name) ){
				this.appends[name].forEach(function(a){ a(self.model); });
				this.appends[name].length = 0;
			}
		}

		if( ctn ){
			this.blocks[name] = ctn;
		}
	}

	helpers.append = function(name, ctn){

		if( !this.appends[name] ){
			this.appends[name] = [];
		}

		this.appends[name].push(ctn);
	}

	helpers.prepend = function(name, ctn){

		if( !this.prepends[name] ){
			this.prepends[name] = [];
		}

		this.prepends[name].push(ctn);
	}

	helpers.hasBlock = function(name){
		return typeof this.blocks[name] !== "undefined";
	}

	helpers.hasPrepends = function(name){
		return this.prepends[name] && (this.prepends[name].length > 0);
	}

	helpers.hasAppends = function(name){
		return this.appends[name] && (this.appends[name].length > 0);
	}

}());
