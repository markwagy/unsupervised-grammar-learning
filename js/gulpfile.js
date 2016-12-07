const gulp = require('gulp');
const child_process = require('child_process');
const jshint = require('gulp-jshint');
const jasmineNode = require('gulp-jasmine-node');

gulp.task('jshint', () => {
	gulp.src('./*.js')
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
    return gulp.src(['spec/*spec.js']).pipe(jasmineNode({
        timeout: 10000,
        includeStackTrace: true,
        color: true
    }));
});

gulp.task('default', ['jshint', 'test']);
