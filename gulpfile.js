const gulp = require('gulp');
const child_process = require('child_process');
const jshint = require('gulp-jshint');
const jasmineNode = require('gulp-jasmine-node');
const browserify = require('gulp-browserify');
const del = require('del');
const gulpCopy = require('gulp-copy');
const nodemon = require('gulp-nodemon');
const connect = require('gulp-connect');

var paths = {
	scripts: ['js/*.js'],
	convertFromNodeScripts: ['./js/metagram.js', './js/cfg.js']
};

gulp.task('jshint', () => {
	gulp.src('js/*.js')
		.pipe(jshint())
		.pipe(jshint.reporter('default'));
});

gulp.task('redis-start', () => {
	child_process.exec('redis-server', (err, stdout, stderr) => {
		console.log(stdout);
		if (err !== null) {
			console.log('exec error: ' + err);
		}
	});
});

gulp.task('test', () => {
    return gulp.src(['js/spec/*spec.js']).pipe(jasmineNode({
        timeout: 10000,
        includeStackTrace: true,
        color: true
    }));
});

gulp.task('clean', () => {
	return del(['./build/*.*']);
});

gulp.task('browserify', () => {
	gulp.src('js/metagram.js')
		.pipe(browserify({
			insertGlobals: true,
			debug: !gulp.env.production
		}))
		.pipe(gulp.dest('./build/'));
});

gulp.task('copy', () => {
	gulp.src('./ui/index.html')
		.pipe(gulp.dest('./build/'));
});

gulp.task('webserver', function() {
  connect.server({
    livereload: true
  });
});


gulp.task('default', ['browserify', 'copy']);
