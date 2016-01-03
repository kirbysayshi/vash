var helpers = require('../../runtime').helpers;

///////////////////////////////////////////////////////////////////////////
// EXAMPLE HELPER: syntax highlighting

helpers.config.highlighter = null;

helpers.highlight = function(lang, cb){

  // context (this) is and instance of Helpers, aka a rendering context

  // mark() returns an internal `Mark` object
  // Use it to easily capture output...
  var startMark = this.buffer.mark();

  // cb() is simply a user-defined function. It could (and should) contain
  // buffer additions, so we call it...
  cb( this.model );

  // ... and then use fromMark() to grab the output added by cb().
  var cbOutLines = this.buffer.fromMark(startMark);

  // The internal buffer should now be back to where it was before this
  // helper started, and the output is completely contained within cbOutLines.

  this.buffer.push( '<pre><code>' );

  if( helpers.config.highlighter ){
    this.buffer.push( helpers.config.highlighter(lang, cbOutLines.join('')).value );
  } else {
    this.buffer.push( cbOutLines );
  }

  this.buffer.push( '</code></pre>' );

  // returning is allowed, but could cause surprising effects. A return
  // value will be directly added to the output directly following the above.
}
