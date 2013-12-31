

var gulp = require('gulp')
var concat = require('gulp-concat');

var es = require('event-stream');

// These are hand-listed because the order is important.
var srcfiles = [
    'vlexer'
  , 'vast'
  , 'vparser'
  , 'vcompiler'
  , 'vexports'
  , 'vruntime'
  , 'vhelpers'
  , 'vhelpers.layout'
  , 'vexpress'
]

gulp.task('browser', function() {
  console.log('browser')
  return gulp.src('./support/license.header.js|./src/{' + srcfiles.join(',') + '}.js', { glob: { debug: true }})
    .pipe(concat('test-build.js'))
    .pipe(gulp.dest('./build/'))
    
})

gulp.task('default', ['browser'], function() {

});