var gulp = require('gulp'),
	uglify = require('gulp-uglify'),
	concat = require('gulp-concat');


gulp.task('build', function () {
	return gulp.src('src/lokijs.js')
		.pipe(uglify())
		.pipe(concat('lokijs.min.js'))
		.pipe(gulp.dest('build/'));
});