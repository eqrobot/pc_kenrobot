/**
 * 引入 gulp及组件
 * npm install --save-dev gulp gulp-if gulp-concat gulp-rename gulp-clean gulp-ruby-sass gulp-clean-css gulp-autoprefixer gulp-requirejs-optimize gulp-uglify gulp-minify-html fs-extra minimist run-sequence electron@1.4.15 electron-builder gulp-sftp q hasha nconf globby isutf8
 * npm install --save electron-debug electron-is electron-log fs-extra minimist q glob 7zip-bin sudo-prompt hasha bufferhelper iconv-lite serialport
 */

const gulp = require('gulp') //基础库
const gulpif = require('gulp-if') //条件执行
const concat = require('gulp-concat') //合并文件
const rename = require('gulp-rename') //重命名
const clean = require('gulp-clean') //清空文件夹
const sass = require('gulp-ruby-sass') //css预编译
const cleanCSS = require('gulp-clean-css') //css压缩
const autoprefixer = require('gulp-autoprefixer') //自动前缀
const requirejsOptimize = require('gulp-requirejs-optimize') //requirejs打包
const uglify = require('gulp-uglify') //js压缩
const minifyHtml = require("gulp-minify-html") //html压缩
const sftp = require('gulp-sftp') //
const Q = require('q')
const fs = require('fs-extra')
const uglifyJS = require('uglify-js')
const globby = require('globby')
const isutf8 = require('isutf8')
const nconf = require('nconf')

const minimist = require('minimist') //命令行参数解析
const runSequence = require('run-sequence') //顺序执行
const hasha = require('hasha') //

const builder = require('electron-builder') //electron打包

const path = require('path') //路径
const child_process = require('child_process') //子进程
const os = require('os') //操作系统相关

var args = minimist(process.argv.slice(2)) //命令行参数

const SRC = './src/'
const DIST = './dist/'

const APP = './app/'

const ASSETS_SRC = SRC + 'assets/'
const ASSETS_DIST = APP + 'assets/'

gulp.task('clean-assets-js', _ => {
	return gulp.src(ASSETS_DIST + 'js', {read: false})
		.pipe(clean())
})

gulp.task('clean-assets-css', _ => {
	return gulp.src(ASSETS_DIST + 'css', {read: false})
		.pipe(clean())
})

gulp.task('clean-assets-image', _ => {
	return gulp.src(ASSETS_DIST + 'image', {read: false})
		.pipe(clean())
})

gulp.task('clean-assets-font', _ => {
	return gulp.src(ASSETS_DIST + 'font', {read: false})
		.pipe(clean())
})

gulp.task('clean-main', _ => {
	return gulp.src(APP + 'main', {read: false})
		.pipe(clean())
})

gulp.task('clean-renderer', _ => {
	return gulp.src(APP + 'renderer', {read: false})
		.pipe(clean())
})

gulp.task('clean-scratch', _ => {
	return gulp.src(APP + 'scratch', {read: false})
		.pipe(clean())
})

gulp.task('clean-views', _ => {
	return gulp.src(ASSETS_DIST + '*.html', {read: false})
		.pipe(clean())
})

gulp.task('clean-config', _ => {
	return gulp.src(ASSETS_DIST + '*.yml', {read: false})
		.pipe(clean())
})

gulp.task('clean-dist', _ => {
	return gulp.src(DIST, {read: false})
		.pipe(clean())
})

gulp.task('pack-assets-js', ['clean-assets-js'], _ => {
	if(args.release) {
		gulp.src([ASSETS_SRC + 'js/require.js'])
			.pipe(gulp.dest(ASSETS_DIST + 'js/'))
			
		return gulp.src(ASSETS_SRC + 'js/index.js')
			.pipe(requirejsOptimize({
				useStrict: true,
				optimize: "uglify",
			}))
			.pipe(gulp.dest(ASSETS_DIST + 'js/'))
	} else {
		return gulp.src(ASSETS_SRC + 'js/**/*.js')
			.pipe(gulp.dest(ASSETS_DIST + 'js/'))
	}
})

gulp.task('pack-assets-css', ['clean-assets-css'], _ => {
	return sass(ASSETS_SRC + 'css/*.scss', {style: "expanded"})
		.pipe(autoprefixer())
		.pipe(gulpif(args.release, cleanCSS()))
		.pipe(gulp.dest(ASSETS_DIST + 'css/'))
})

gulp.task('pack-assets-image', ['clean-assets-image'], _ => {
	return gulp.src(ASSETS_SRC + 'image/**/*')
		.pipe(gulp.dest(ASSETS_DIST + 'image/'))
})

gulp.task('pack-assets-font', ['clean-assets-font'], _ => {
	return gulp.src(ASSETS_SRC + 'font/**/*')
		.pipe(gulp.dest(ASSETS_DIST + 'font/'))
})

gulp.task('pack-assets', ['pack-assets-image', 'pack-assets-font', 'pack-assets-css', 'pack-assets-js'])

gulp.task('pack-main', ['clean-main'], _ => {
	return gulp.src(SRC + 'main/**/*.js')
		.pipe(gulp.dest(APP + 'main/'))
})

gulp.task('pack-renderer', ['clean-renderer'], cb => {
	return gulp.src(SRC + 'renderer/**/*.js')
			.pipe(gulp.dest(APP + 'renderer/'))
})

gulp.task('pack-views', ['clean-views'], _ => {
	return gulp.src(SRC + 'views/**.html')
		.pipe(gulp.dest(APP))
})

gulp.task('pack-config', ['clean-config'], _ => {
	return gulp.src([SRC + '/app-update.yml'])
		.pipe(gulp.dest(APP))
})

gulp.task('pack-scratch', ['clean-scratch'], callback => {
	gulp.src([SRC + 'scratch/**/*'])
		.pipe(gulp.dest(APP + 'scratch/'))
		.on('end', _ => {
			var indexPath = path.join(APP, 'scratch', 'index.html')
			var content = fs.readFileSync(indexPath, "utf8")
			var tag = "<body>"
			var contents = content.split(tag)
			contents.splice(1, 0, tag, '<script type="text/javascript" src="../renderer/index.js"></script><script>(function(a) {delete a.require;delete a.exports;delete a.module;})(window);</script>')
			fs.writeFileSync(indexPath, contents.join(""))
			callback()
		})
		.on('error', err => {
			callback(err)
		})
})

gulp.task('pack', ['pack-views', 'pack-main', 'pack-renderer', 'pack-scratch', 'pack-assets'])

/**
 * 用法: gulp build-pack --release --platform=PLATFORM --arch=ARCH --target=TARGET --branch=BRANCH --feature=FEATURE
 * 示例: gulp build-pack --release --branch=beta
 *       gulp build-pack --release --platform=win --arch=x64 --target=nsis --branch=beta
 *       gulp build-pack --release --platform=win --arch=x64 --target=nsis --branch=beta --feature=with-101
 */
gulp.task('build', ['clean-dist'], callback => {
	var platform = args.platform || "win"
	var branch = args.branch || "release"
	var feature = args.feature || ""
	var arch
	var target
	var ext

	var targets
	if(platform == "linux") {
		arch = args.arch || "ia32"
		target = args.target || "AppImage"
		ext = target
		targets = builder.Platform.LINUX.createTarget(target, builder.archFromString(arch))
	} else if(platform == "arm") {
		arch = builder.Arch.armv7l.toString()
		target = args.target || "dir"
		ext = target
		targets = builder.Platform.LINUX.createTarget(target, builder.archFromString(arch))
	} else if(platform == "mac") {
		arch = args.arch || "ia32"
		target = args.target || "dmg"
		ext = target
		targets = builder.Platform.MAC.createTarget(target, builder.archFromString(arch))
	} else {
		arch = args.arch || "ia32"
		target = args.target || "nsis"
		ext = "exe"
		targets = builder.Platform.WINDOWS.createTarget(target, builder.archFromString(arch))
	}

	nconf.file('./app/package.json')
	nconf.set('buildInfo', {
		branch: branch,
		feature: feature,
		ext: ext,
	})
	nconf.save()
	
	builder.build({
		targets: targets,
		config: {
			extraFiles: [
      			`arduino-${platform}`,
      			"scripts",
      			"examples",
      			"packages",
    		],
		}
	}).then(result => {
		var output = result[0]
		var packageConfig = require('./app/package')
		var name = `${packageConfig.name}-${packageConfig.version}-${branch}${feature ? ("-" + feature) : ""}-${arch}${path.extname(output)}`
		var file = path.join(path.dirname(output), name)

		fs.move(output, file, err => {
			nconf.clear('buildInfo')
			nconf.save()
			
			console.log(file)
			if(!args.upload) {
				callback()
				return
			}

			var options = args.remotePath ? {remotePath: args.remotePath} : {}
			upload(file, options).then(_ => {
				callback()
			}, err1 => {
				console.error(err1)
				callback(err1)
			})
		})		
	}, err => {
		console.error(err)
		callback(err)
	})
})

gulp.task('build-pack', ['pack', 'build'])

// 默认任务
gulp.task('default', ['pack'])

gulp.task('check', callback => {
	globby(["./src/**/*.js", "./src/**/*.json", "./src/**/*.html", "./src/**/*.scss"]).then(files => {
		var result = []
		files.forEach(file => {
			if(!isutf8(fs.readFileSync(file))) {
				result.push(file)
			}
		})
		if(result.length > 0) {
			console.log('these files not encoding by utf8')
			console.log(result.join("\n"))
		} else {
			console.log('all files encoding by utf8')
		}
		callback()
	}, err => {
		callback(err)
	})
})

gulp.task('hash', callback => {
	var pathList = globby.sync("packages/*.7z")
	var packages = pathList.map(p => {
		var hash = hasha.fromFileSync(p, {algorithm: "sha256"})
		return {
			name: path.basename(p),
			checksum: "sha256:" + hash,
		}
	})
	fs.writeJsonSync("packages/packages.json", packages)
	console.dir(packages)
})

gulp.task('upload', _ => {
	if(!args.file) {
		console.log('please spec file use "--file"')
		return
	}
	
	var files = args.file.split(',')
	var options = args.remotePath ? {remotePath: args.remotePath} : {}

	return upload(files, options)
})

function upload(files, options) {
	var defer = Q.defer()

	var defaultOptions = require('./build/upload')
	options = Object.assign(defaultOptions, options)

	gulp.src(files)
		.pipe(sftp(options))
		.on('end', defer.resolve)
		.on('error', defer.reject)

	return defer.promise
}