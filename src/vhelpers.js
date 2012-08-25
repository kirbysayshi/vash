;(function(exports){

	///////////////////////////////////////////////////////////////////////////
	// EXAMPLE HELPER: syntax highlighting

	exports.config.highlighter = null

	exports.highlight = function(lang, cb){

		// context (this) is vash.helpers

		// mark() returns, for now, the current length of the internal buffer.
		// Use it to easily capture output...
		var startMark = this.buffer.mark();

		// cb() is simply a user-defined function. It could (and should) contain
		// buffer additions, so we call it...
		cb();

		// ... and then use fromMark() to grab the output added by cb().
		// Allowing the user to have functions mitigates having to do a lot of 
		// manual string concatenation within a helper.
		var cbOutLines = this.buffer.fromMark(startMark);

		// The internal buffer should now be back to where it was before this 
		// helper started.

		this.buffer.push( '<pre><code>' );

		// 
		if( exports.config.highlighter ){
			this.buffer.push( exports.config.highlighter(lang, cbOutLines.join('')).value );
		}

		this.buffer.push( '</code></pre>' );

		// returning is allowed, but could cause surprising effects. A return
		// value will be directly added to the output.
	}

}(function(){

	if(typeof define === 'function' && define['amd']){
		return {}; // AMD
	} else if(typeof module === 'object' && module['exports']){
		// NODEJS, one file
		return exports['helpers'];
	} else {
		return window['vash']['helpers'];
	}

}()));