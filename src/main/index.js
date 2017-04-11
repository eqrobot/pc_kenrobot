const {app, BrowserWindow, ipcMain, shell, clipboard} = require('electron')

const path = require('path')
const os = require('os')
const util = require('./util')

const is = require('electron-is')
const debug = require('electron-debug')
const log = require('electron-log')

const Q = require('q')
const fs = require('fs-extra')
const minimist = require('minimist') //命令行参数解析
const SerialPort = require('serialport') //串口
const hasha = require('hasha') //计算hash

var args = minimist(process.argv.slice(1)) //命令行参数

var connectedPorts = {
	autoPortId: 0,
	ports: {}
}
var arduinoOptions = {
	"default": {
		build: {
			fqbn: "arduino:avr:uno:cpu=atmega328p",
			prefs: {
				"runtime.tools.avr-gcc.path": '"ARDUINO_PATH/hardware/tools/avr"',
				"runtime.tools.avrdude.path": '"ARDUINO_PATH/hardware/tools/avr"'
			},
			command: '"ARDUINO_PATH/arduino-builder" -compile -logger=machine -hardware="ARDUINO_PATH/hardware" -hardware="ARDUINO_PATH/packages" -tools="ARDUINO_PATH/tools-builder" -tools="ARDUINO_PATH/hardware/tools/avr" -tools="ARDUINO_PATH/packages" -built-in-libraries="ARDUINO_PATH/libraries" -ide-version=10612 -warnings=all -prefs=build.warn_data_percentage=75 BUILD_SPECS -build-path="PROJECT_BUILD_PATH" "PROJECT_ARDUINO_FILE"'
		},
		upload: {
			target_type: "hex",
			mcu: "atmega328p",
			baudrate: "115200",
			programer: "arduino",
			command: '"ARDUINO_PATH/hardware/tools/avr/bin/avrdude" -C "ARDUINO_PATH/hardware/tools/avr/etc/avrdude.conf" -v -p ARDUINO_MCU -c ARDUINO_PROGRAMMER -b ARDUINO_BURNRATE -P ARDUINO_COMPORT -U "flash:w:TARGET_PATH:i"'
		},
	},
	librariesPath: [],
}

var config

var mainWindow

init()

/**
 * 初始化
 */
function init() {
	if(app.makeSingleInstance((commandLine, workingDirectory) => {
		if(mainWindow) {
			mainWindow.isMinimized() && mainWindow.restore()
			mainWindow.focus()
		}
	})) {
		app.quit()
	}

	log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}'
	if(is.dev() || args.dev) {
		//非debug模式，禁用控制台输出
		log.transports.file.level = 'debug'
	} else {
		log.transports.console = false
		log.transports.file.level = 'error'
	}

	log.debug(`app start, version ${util.getVersion()}`)

	listenEvent()
	listenMessage()
}

/**
 * 创建窗口
 */
function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 720,
		minWidth: 1200,
		minHeight: 720,
		frame: false,
		show: false
	})
	args.fullscreen && mainWindow.setFullScreen(true)

	mainWindow.on('closed', _ => {
		log.debug('mainWindow closed')
		mainWindow = null
	}).once('ready-to-show', () => {
		mainWindow.show()
	})

	mainWindow.webContents.on('devtools-reload-page', _ => {
		closeAllSerialPort()
	})
	mainWindow.webContents.session.on('will-download', (e, item, webContent) => {
		var savePath = path.join(util.getAppDataPath(), 'temp', item.getFilename())
		item.setSavePath(savePath)

		var url = item.getURL()
		var pos = url.lastIndexOf("#")
		var action = url.substring(pos + 1)
		url = url.substring(0, pos)

		item.on('updated', (evt, state) => {
			if(state == "interrupted") {
				log.debug(`download interrupted: ${url}`)
			} else if(state === 'progressing') {
				if(item.isPaused()) {
					log.debug(`download paused: ${url}`)
				}
			}
		})

		item.once('done', (evt, state) => {
			if(state == "completed") {
				log.debug(`download success: ${url}, at ${savePath}`)
				util.postMessage("app:onDownloadSuccess", savePath, action)
			} else {
				log.debug(`download fail: ${url}`)
			}
		})
	})

	mainWindow.loadURL(`file://${__dirname}/../index.html`)
	mainWindow.focus()
}

/**
 * 监听事件
 */
function listenEvent() {
	app.on('ready', _ => {
		log.debug('app ready')

		is.dev() && args.dev && debug({showDevTools: true})

		loadConfig().then(data => {
			config = data

			createWindow()
			loadBoards()
		})
	})
	.on('window-all-closed', _ => {
		if (process.platform !== 'darwin') {
			app.quit()
		}
	})
	.on('activate', _ => {
		if (mainWindow === null) {
			createWindow()
		}
	})
	.on('will-quit', _ => {
		closeAllSerialPort()
	})
	.on('quit', _ => {
		log.debug('app quit')
	})
}

/**
 * 监听消息
 */
function listenMessage() {
	ipcMain.on('app:reload', (e, deferId) => {
		mainWindow.reload()
		e.sender.send('app:reload', deferId, true, true)
	})
	.on('app:min', (e, deferId) => {
		mainWindow.minimize()
		e.sender.send('app:min', deferId, true, true)
	})
	.on('app:max', (e, deferId) => {
		if(mainWindow.isFullScreen()) {
			mainWindow.setFullScreen(false)
		} else {
			mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
		}
		e.sender.send('app:max', deferId, true, true)
	})
	.on('app:fullscreen', (e, deferId) => {
		var fullscreen = !mainWindow.isFullScreen()
		mainWindow.setFullScreen(fullscreen)
		e.sender.send('app:fullscreen', deferId, true, fullscreen)
	})
	.on('app:quit', (e, deferId) => {
		app.quit()
	}).on('app:openUrl', (e, deferId, url) => {
		var success = url && shell.openExternal(url)
		e.sender.send('app:openUrl', deferId, success, success)
	})
	.on('app:execFile', (e, deferId, exePath) => {
		util.execFile(exePath).then(stdout => {
			e.sender.send("app:execFile", deferId, true, stdout)
		}, err => {
			e.sender.send("app:execFile", deferId, false, err)
		})
	})
	.on('app:execCommand', (e, deferId, command, options) => {
		util.execCommand(command, options).then(stdout => {
			e.sender.send('app:execCommand', deferId, true, stdout)
		}, err => {
			e.sender.send('app:execCommand', deferId, false, err)
		})
	})
	.on('app:spawnCommand', (e, deferId, command, args, options) => {
		util.spawnCommand(command, args, options).then(stdout => {
			e.sender.send('app:spawnCommand', deferId, true, stdout)
		}, stderr => {
			e.sender.send('app:spawnCommand', deferId, false, stderr)
		}, progress => {
			e.sender.send('app:spawnCommand', deferId, "notify", progress)
		})
	})
	.on('app:readFile', (e, deferId, filePath, options) => {
		util.readFile(filePath, options).then(data => {
			e.sender.send('app:readFile', deferId, true, data)
		}, err => {
			e.sender.send('app:readFile', deferId, false, err)
		})
	})
	.on('app:writeFile', (e, deferId, filePath, data) => {
		util.writeFile(filePath, data).then(_ => {
			e.sender.send('app:writeFile', deferId, true, true)
		}, err => {
			e.sender.send('app:writeFile', deferId, false, err)
		})
	})
	.on('app:removeFile', (e, deferId, filePath) => {
		util.removeFile(filePath).then(_ => {
			e.sender.send('app:removeFile', deferId, true, true)
		}, err => {
			e.sender.send('app:removeFile', deferId, false, err)
		})
	})
	.on('app:saveProject', (e, deferId, projectPath, projectInfo, isTemp) => {
		saveProject(projectPath, projectInfo, isTemp).then(result => {
			e.sender.send('app:saveProject', deferId, true, result)
		}, err => {
			e.sender.send('app:saveProject', deferId, false, err)
		})
	})
	.on('app:openProject', (e, deferId, projectPath) => {
		openProject(projectPath).then(data => {
			e.sender.send('app:openProject', deferId, true, data)
		}, err => {
			e.sender.send('app:openProject', deferId, false, err)
		})	
	})
	.on('app:buildProject', (e, deferId, projectPath, options) => {
		buildProject(projectPath, options).then(_ => {
			e.sender.send('app:buildProject', deferId, true, true)
		}, err => {
			e.sender.send('app:buildProject', deferId, false, err)
		}, progress => {
			e.sender.send('app:buildProject', deferId, "notify", progress)
		})
	})
	.on('app:upload', (e, deferId, projectPath, options) => {
		listSerialPort().then(ports => {
			if(ports.length == 1) {
				upload(projectPath, ports[0].comName, options).then(_ => {
					e.sender.send('app:upload', deferId, true, true)
				}, err => {
					e.sender.send('app:upload', deferId, false, err)
				}, progress => {
					e.sender.send('app:upload', deferId, "notify", progress)
				})
			} else {
				e.sender.send('app:upload', deferId, false, {
					status: "SELECT_PORT",
					ports: ports,
				})
			}
		}, _ => {
			e.sender.send('app:upload', deferId, false, {
				status: "NOT_FOUND_PORT"
			})
		})
	})
	.on('app:upload2', (e, deferId, projectPath, comName, options) => {
		upload(projectPath, comName, options).then(_ => {
			e.sender.send('app:upload2', deferId, true, true)
		}, err => {
			e.sender.send('app:upload2', deferId, false, err)
		}, progress => {
			e.sender.send('app:upload2', deferId, "notify", progress)
		})
	})
	.on('app:listSerialPort', (e, deferId) => {
		listSerialPort().then(ports => {
			e.sender.send('app:listSerialPort', deferId, true, ports)
		}, err => {
			e.sender.send('app:listSerialPort', deferId, false, err)
		})
	})
	.on('app:openSerialPort', (e, deferId, comName, options) => {
		openSerialPort(comName, options).then(portId => {
			e.sender.send('app:openSerialPort', deferId, true, portId)
		}, err => {
			e.sender.send('app:openSerialPort', deferId, false, err)
		})
	})
	.on('app:writeSerialPort', (e, deferId, portId, buffer) => {
		writeSerialPort(portId, buffer).then(_ => {
			e.sender.send('app:writeSerialPort', deferId, true, true)
		}, err => {
			e.sender.send('app:writeSerialPort', deferId, false, err)
		})
	})
	.on('app:closeSerialPort', (e, deferId, portId) => {
		closeSerialPort(portId).then(_ => {
			e.sender.send('app:closeSerialPort', deferId, true, true)
		}, err => {
			e.sender.send('app:closeSerialPort', deferId, false, err)
		})
	})
	.on('app:updateSerialPort', (e, deferId, portId, options) => {
		updateSerialPort(portId, options).then(_ => {
			e.sender.send('app:updateSerialPort', deferId, true, true)
		}, err => {
			e.sender.send('app:updateSerialPort', deferId, false, err)
		})
	})
	.on('app:flushSerialPort', (e, deferId, portId) => {
		flushSerialPort(portId).then(_ => {
			e.sender.send('app:flushSerialPort', deferId, true, true)
		}, err => {
			e.sender.send('app:flushSerialPort', deferId, false, err)
		})
	})
	.on('app:errorReport', (e, deferId, error) => {
		log.error(`------ error message ------`)
		log.error(`${error.message}(${error.src} at line ${error.line}:${error.col})`)
		log.error(`${error.stack}`)
		e.sender.send('app:errorReport', deferId, true, true)
	})
	.on('app:log', (e, deferId, text, level) => {
		var method = log[level] || log.debug
		method.bind(log).call(text)
		e.sender.send('app:log', deferId, true, true)
	})
	.on('app:getAppInfo', (e, deferId) => {
		e.sender.send('app:getAppInfo', deferId, true, util.getAppInfo())
	})
	.on('app:download', (e, deferId, url, action) => {
		log.debug(`download ${url}, action ${action}`)
		mainWindow.webContents.downloadURL(`${url}#${action}`)
		e.sender.send('app:download', deferId, true, true)
	})
	.on('app:installDriver', (e, deferId, driverPath) => {
		installDriver(driverPath).then(_ => {
			e.sender.send('app:installDriver', deferId, true, true)
		}, err => {
			e.sender.send('app:installDriver', deferId, false, err)
		})
	})
	.on('app:loadExamples', (e, deferId) => {
		loadExamples().then(examples => {
			e.sender.send('app:loadExamples', deferId, true, examples)
		}, err => {
			e.sender.send('app:loadExamples', deferId, false, err)
		})
	})
	.on("app:openExample", (e, deferId, category, name) => {
		openExample(category, name).then(projectInfo => {
			e.sender.send('app:openExample', deferId, true, projectInfo)
		}, err => {
			e.sender.send('app:openExample', deferId, false, err)
		})
	})
	.on("app:copy", (e, deferId, text, type) => {
		clipboard.writeText(text, type)
		e.sender.send("app:copy", deferId, true, true)
	})
	.on('app:unpackPackages', (e, deferId) => {
		unpackPackages().then(_ => {
			e.sender.send('app:unpackPackages', deferId, true, true)
		}, err => {
			e.sender.send('app:unpackPackages', deferId, false, err)
		}, progress => {
			e.sender.send('app:unpackPackages', deferId, "notify", progress)
		})
	})
	.on("app:loadPackages", (e, deferId) => {
		loadPackages().then(packages => {
			e.sender.send('app:loadPackages', deferId, true, packages)
		}, err => {
			e.sender.send('app:loadPackages', deferId, false, err)
		})
	})
	.on("app:checkUpdate", (e, deferId, checkUrl) => {
		checkUpdate(checkUrl).then(updateInfo => {
			e.sender.send("app:checkUpdate", deferId, true, updateInfo)
		}, err => {
			e.sender.send("app:checkUpdate", deferId, false, err)
		})
	})
	.on("app:request", (e, deferId, options) => {
		util.request(options).then(result => {
			e.sender.send("app:request", deferId, true, result)
		}, err => {
			e.sender.send("app:request", deferId, false, err)
		})
	})
	.on("app:showItemInFolder", (e, deferId, filePath) => {
		shell.showItemInFolder(path.normalize(filePath))
		e.sender.send("app:showItemInFolder", deferId, true, true)
	})
}

/**
 * 检查更新
 * @param {*} checkUrl 
 */
function checkUpdate(checkUrl) {
	var deferred = Q.defer()

	var info = util.getAppInfo()
	var url = `${checkUrl}&version=${info.version}&platform=${info.platform}&arch=${info.arch}&features=${info.feature}&ext=${info.ext}`
	log.debug(`checkUpdate: ${url}`)

	util.request({
		method: "GET",
		url: url,
		json: true,
	}).then(result => {
		deferred.resolve(result)
	}, err => {
		log.error(err)
		deferred.reject(err)
	})

	return deferred.promise
}

/**
 * 载入配置
 */
function loadConfig() {
	var deferred = Q.defer()

	log.debug("loadConfig")
	var configPath = path.join(util.getAppDataPath(), "config.json")
	if(!fs.existsSync(configPath)) {
		setTimeout(_ => {
			deferred.resolve({})
		}, 10)
		return deferred.promise
	}

	util.readJson(configPath).then(data => {
		deferred.resolve(data)
	}, err => {
		deferred.resolve({})
	})

	return deferred.promise
}

/**
 * 载入配置
 */
function writeConfig(sync) {
	sync = sync == true
	var configPath = path.join(util.getAppDataPath(), "config.json")
	log.debug(`writeConfig, path: ${configPath}, sync: ${sync}`)
	if(sync) {
		fs.writeJsonSync(configPath, config)
	} else {
		return util.writeJson(configPath, config)
	}
}

/**
 * 解压资源包
 */
function unpackPackages() {
	var deferred = Q.defer()

	if(config.version && config.version == util.getVersion()) {
		log.debug("skip unpack packages")
		setTimeout(_ => {
			deferred.resolve()
		}, 10)

		return deferred.promise
	}

	log.debug("unpack packages")
	var packagesPath = path.join(util.getResourcePath(), "packages")
	util.readJson(path.join(packagesPath, "packages.json")).then(packages => {
		var oldPackages = config.packages || []
		var list = packages.filter(p => !oldPackages.find(o => o.name == p.name && o.checksum == p.checksum))

		var doUnzip = _ => {
			if(list.length == 0) {
				deferred.resolve()
				return
			}

			var total = list.length
			var p = list.pop()
			util.unzip(path.join(packagesPath, p.archiveName), getPackagesPath(), true).then(_ => {
				var oldPackage = oldPackages.find(o => o.name == p.name)
				if(oldPackage) {
					oldPackage.checksum = p.checksum
				} else {
					oldPackages.push(p)
				}
			}, err => {

			}, progress => {
				deferred.notify({
					progress: progress,
					name: p.name,
					version: p.version,
					count: total - list.length,
					total: total,
				})
			})
			.fin(_ => {
				doUnzip()
			})
		}

		doUnzip()
	}, err => {
		log.error(err)
		deferred.reject()
	})

	return deferred.promise
}

/**
 * 加载所有包
 */
function loadPackages() {
	var deferred = Q.defer()

	var packages = []
	var packagesPath = getPackagesPath()
	log.debug(`loadPackages: ${packagesPath}`)
	
	util.searchFiles(`${packagesPath}/*/package.json`).then(pathList => {
		Q.all(pathList.map(p => {
			var d = Q.defer()
			util.readJson(p).then(packageConfig => {
				packageConfig.path = path.dirname(p)
				packageConfig.boards && packageConfig.boards.forEach(board => {
					board.build && board.build.prefs && Object.keys(board.build.prefs).forEach(key => {
						board.build.prefs[key] = board.build.prefs[key].replace("PACKAGE_PATH", packageConfig.path)
					})

					if(board.upload && board.upload.command) {
						board.upload.command = board.upload.command.replace(/PACKAGE_PATH/g, packageConfig.path)
					}
				})
				packages.push(packageConfig)
				var packageSrcPath = path.join(packageConfig.path, "src")
				fs.existsSync(packageSrcPath) && arduinoOptions.librariesPath.push(packageSrcPath)
			})
			.fin(_ => {
				d.resolve()
			})
			return d.promise	
		}))
		.then(_ => {
			deferred.resolve(packages)
		})
	}, err => {
		log.error(err)
		deferred.reject(err)
	})

	return deferred.promise
}

/**
 * 打开示例
 * @param {*} category 分类
 * @param {*} name 名字
 */
function openExample(category, name) {
	var deferred = Q.defer()

	var examplePath = path.join(util.getResourcePath(), "examples", category, name)
	log.debug(`openExample: ${examplePath}`)
	util.readJson(path.join(examplePath, "project.json")).then(projectInfo => {
		deferred.resolve(projectInfo)
	}, err => {
		log.error(err)
		deferred.reject(err)
	})

	return deferred.promise
}

/**
 * 加载示例
 */
function loadExamples() {
	var deferred = Q.defer()

	log.debug('loadExamples')
	util.readJson(path.join(util.getResourcePath(), "examples", "examples.json")).then(examples => {
		deferred.resolve(examples)
	}, err => {
		log.error(err)
		deferred.reject(err)
	})

	return deferred.promise
}

/**
 * 安装驱动
 * @param {*} driverPath 
 */
function installDriver(driverPath) {
	var deferred = Q.defer()

	log.debug(`installDriver: ${driverPath}`)
	var dir = path.dirname(driverPath)
	util.unzip(driverPath, dir).then(_ => {
		var exePath = path.join(dir, path.basename(driverPath, path.extname(driverPath)), "setup.exe")
		util.execFile(exePath).then(_ => {
			deferred.resolve()
		})
	}, err => {
		log.error(err)
		deferred.reject(err)
	})

	return deferred.promise
}

/**
 * 查询串口
 */
function listSerialPort() {
	var deferred = Q.defer()

	log.debug("listSerialPort")
	SerialPort.list((err, ports) => {
		if(err) {
			log.error(err)
			deferred.reject(err)
			return
		}

		if(ports.length == 0) {
			deferred.reject()
			return
		}

		matchBoardNames(ports).then(_ => {
			log.debug(ports.map(p => `${p.comName}, pid: ${p.productId}, vid: ${p.vendorId}, boardName: ${p.boardName || ""}`).join('\n'))
			deferred.resolve(ports)
		}, err1 => {
			log.error(err1)
			deferred.reject(err1)
		})
	})

	return deferred.promise
}

/**
 * 打开串口
 * @param {*} comName 串口路径
 * @param {*} options 选项
 */
function openSerialPort(comName, options) {
	var deferred = Q.defer()

	log.debug(`openSerialPort: ${comName}, options: ${JSON.stringify(options)}`)
	options.autoOpen = false
	if(options.parser == "raw") {
		options.parser = SerialPort.parsers.raw
	} else {
		var newline = options.parser.replace("NL", '\n').replace("CR", '\r')
		options.parser = SerialPort.parsers.readline(newline)
	}

	var port = new SerialPort(comName, options)
	port.open(err => {
		if(err) {
			log.error(err)
			deferred.reject(err)
			return
		}

		var portId = ++connectedPorts.autoPortId
		connectedPorts.ports[portId] = port

		port.on('error', err => {
			util.postMessage("app:onSerialPortError", portId, err)
		})
		.on('close', _ => {
			delete connectedPorts.ports[portId]
			util.postMessage("app:onSerialPortClose", portId)
		})
		.on('data', data => {
			util.postMessage("app:onSerialPortData", portId, data)
		})

		port.flush(_ => {
			deferred.resolve(portId)
		})
	})

	return deferred.promise
}

/**
 * 串口发送
 * @param {*} portId 串口id
 * @param {*} buffer 发送内容，Buffer | String
 */
function writeSerialPort(portId, buffer) {
	var  deferred = Q.defer()

	log.debug(`writeSerialPort: ${portId}, ${buffer}`)
	var port = connectedPorts.ports[portId]
	if(!port) {
		setTimeout(_ => {
			deferred.reject()
		}, 10)
		return deferred.promise
	}

	port.write(buffer, err => {
		if(err) {
			log.error(err)
			deferred.reject(err)
			return
		}

		port.drain(_ => {
			deferred.resolve()
		})
	})

	return deferred.promise
}

/**
 * 关闭串口
 * @param {*} portId 串口id
 */
function closeSerialPort(portId) {
	var  deferred = Q.defer()

	log.debug(`closeSerialPort, portId: ${portId}`)
	var port = connectedPorts.ports[portId]
	if(!port) {
		setTimeout(_ => {
			deferred.reject()
		}, 10)
		return deferred.promise
	}

	port.close(_ => {
		deferred.resolve()
	})

	return deferred.promise
}

/**
 * 关闭所有串口
 */
function closeAllSerialPort() {
	log.debug(`closeAllSerialPort`)
	for(var key in connectedPorts.ports) {
		connectedPorts.ports[key].close()
	}
	connectedPorts.ports = {}
}

/**
 * 更新串口设置
 * @param {*} portId 串口id
 * @param {*} options 选项
 */
function updateSerialPort(portId, options) {
	var  deferred = Q.defer()

	log.debug(`updateSerialPort, portId: ${portId}`)
	var port = connectedPorts.ports[portId]
	if(!port) {
		setTimeout(_ => {
			deferred.reject()
		}, 10)
		return deferred.promise
	}

	port.update(options, _ => {
		deferred.resolve()
	})

	return deferred.promise
}

/**
 * 清空串口缓冲区
 * @param {*} portId 串口id
 * @param {*} options 选项
 */
function flushSerialPort(portId, options) {
	var  deferred = Q.defer()

	log.debug(`flushSerialPort, portId: ${portId}`)
	var port = connectedPorts.ports[portId]
	if(!port) {
		setTimeout(_ => {
			deferred.reject()
		}, 10)
		return deferred.promise
	}

	port.flush(_ => {
		deferred.resolve()
	})

	return deferred.promise
}

/**
 * 保存项目
 * @param {*} oldProjectPath 
 * @param {*} projectInfo 
 * @param {*} isTemp 
 */
function saveProject(oldProjectPath, projectInfo, isTemp) {
	var deferred = Q.defer()
	isTemp = isTemp === true

	log.debug(`saveProject: isTemp:${isTemp}`)

	var save = projectPath => {
		var updated_at = new Date()
		projectInfo.updated_at = updated_at
		projectInfo.project_name = path.basename(projectPath)

		Q.all([
			util.writeFile(path.join(projectPath, path.basename(projectPath) + ".ino"), projectInfo.project_data.code),
			util.writeJson(path.join(projectPath, "project.json"), projectInfo)
		]).then(_ => {
			deferred.resolve({
				path: projectPath,
				updated_at: projectInfo.updated_at,
				project_name: projectInfo.project_name
			})
		}, _ => {
			deferred.reject()
		})
	}

	if(oldProjectPath) {
		save(oldProjectPath)
	} else if(isTemp) {
		var projectPath = path.join(app.getPath("temp"), "build", "sketch" + new Date().getTime())
		save(projectPath)
	} else {
		util.showSaveDialog(mainWindow).then(projectPath => {
			save(projectPath)
		}, _ => {
			deferred.reject()
		})
	}
	
	return deferred.promise
}

/**
 * 打开项目
 * @param {*} projectPath 项目路径 
 */
function openProject(projectPath) {
	var deferred = Q.defer()

	log.debug(`openProject ${projectPath}`)
	var read = projectPath => {
		util.readJson(path.join(projectPath, "project.json")).then(projectInfo => {
			deferred.resolve({
				path: projectPath,
				projectInfo: projectInfo
			})
		}, err => {
			log.error(err)
			deferred.reject(err)
		})
	}
	if(projectPath) {
		read(projectPath)
	} else {
		util.showOpenDialog(mainWindow, {
			properties: ["openDirectory"]
		}).then(projectPath => {
			read(projectPath)
		}, err => {
			log.error(err)
			deferred.reject(err)
		})
	}

	return deferred.promise
}

/**
 * 编译项目
 * @param {*} projectPath 项目路径 
 * @param {*} options 编译选项
 */
function buildProject(projectPath, options) {
	var deferred = Q.defer()

	preBuild(projectPath, options).then(commandPath => {
		log.debug(`buildProject: ${projectPath}, command path: ${commandPath}`)
		var scriptPath = getScriptPath("call")
		util.spawnCommand(`"${scriptPath}"`, [`"${commandPath}"`], {shell: true}).then(_ => {
			deferred.resolve()
		}, err => {
			log.error(err)
			deferred.reject(err)
		}, progress => {
			deferred.notify(progress)
		})
	}, err => {
		log.error(err)
		deferred.reject(err)
	})
	
	return deferred.promise
}

function preBuild(projectPath, options) {
	var deferred = Q.defer()

	log.debug('pre-build')

	var buildSpecs = []
	options = Object.assign({}, arduinoOptions.default.build, options)

	var packagesPath = getPackagesPath()
	if(fs.existsSync(packagesPath)) {
		buildSpecs.push(`-hardware=${packagesPath}`)
	}
	
	buildSpecs.push(`-fqbn=${options.fqbn}`)
	var arduinoPath = getArduinoPath()
	Object.keys(options.prefs).forEach(key => {
		var value = util.handleQuotes(options.prefs[key])
		value = value.replace(/ARDUINO_PATH/g, arduinoPath)
		buildSpecs.push(`-prefs=${key}=${value}`)
	})

	arduinoOptions.librariesPath.forEach(libraryPath => {
		buildSpecs.push(`-libraries=${libraryPath}`)
	})

	var projectBuildPath = path.join(projectPath, 'build')
	fs.ensureDirSync(projectBuildPath)
	var commandPath = path.join(getCommandDir(), 'command.txt')
	var command = util.handleQuotes(options.command)
	command = command.replace(/ARDUINO_PATH/g, getArduinoPath())
		.replace("BUILD_SPECS", buildSpecs.join(' '))
		.replace("PROJECT_BUILD_PATH", projectBuildPath)
		.replace("PROJECT_ARDUINO_FILE", path.join(projectPath, `${path.basename(projectPath)}.ino`))

	util.writeFile(commandPath, command).then(_ => {
		var optionPath = path.join(projectPath, 'build', 'build.options.json')
		if(!fs.existsSync(optionPath)) {
			setTimeout(_ => {
				deferred.resolve(commandPath)
			}, 10)
			return deferred.promise
		}

		util.readJson(optionPath).then(opt => {
			if(options.fqbn == opt.fqbn) {
				deferred.resolve(commandPath)
				return
			}

			util.removeFile(path.join(projectPath, 'build')).fin(_ => {
				fs.ensureDirSync(path.join(projectPath, 'build'))
				deferred.resolve(commandPath)
			})
		}, err => {
			log.error(err)
			deferred.resolve(commandPath)
		})
	}, err => {
		log.error(err)
		deferred.reject()
	})

	return deferred.promise
}

/**
 * 上传
 * @param {*} projectPath 项目路径
 * @param {*} comName 串口路径
 * @param {*} options 选项
 */
function upload(projectPath, comName, options) {
	var deferred = Q.defer()

	preUpload(projectPath, comName, options).then(commandPath => {
		log.debug(`upload: ${projectPath}, ${comName}, command path: ${commandPath}`)
		var scriptPath = getScriptPath("call")
		util.spawnCommand(`"${scriptPath}"`, [`"${commandPath}"`], {shell: true}).then(_ => {
			deferred.resolve()
		}, err => {
			log.error(err)
			deferred.reject(err)
		}, progress => {
			deferred.notify(progress)
		})
	}, err => {
		log.error(err)
		deferred.reject(err)
	})
	
	return deferred.promise
}

/**
 * 上传预处理
 */
function preUpload(projectPath, comName, options) {
	var deferred = Q.defer()

	log.debug("pre upload")
	options = Object.assign({}, arduinoOptions.default.upload, options)
	var targetPath = path.join(projectPath, 'build', `${path.basename(projectPath)}.ino.${options.target_type}`)

	var commandPath = path.join(getCommandDir(), 'command.txt')
	var command = util.handleQuotes(options.command)
	command = command.replace(/ARDUINO_PATH/g, getArduinoPath())
		.replace("ARDUINO_MCU", options.mcu)
		.replace("ARDUINO_BURNRATE", options.baudrate)
		.replace("ARDUINO_PROGRAMMER", options.programer)
		.replace("ARDUINO_COMPORT", comName)
		.replace("TARGET_PATH", targetPath)

	util.writeFile(commandPath, command).then(_ => {
		var serialPort = new SerialPort(comName, {
			baudRate: 1200
		})

		serialPort.on('open', _ => {
			serialPort.set({
				rts: true,
				dtr: false,
			})
			setTimeout(_ => {
				serialPort.close(_ => {
					deferred.resolve(commandPath)
				})
			}, 650)
		}).on('error', err => {
			log.error(err)
			serialPort.close(_ => {
				deferred.reject(err)
			})
		})
	}, err => {
		log.error(err)
		deferred.reject(err)
	})

	return deferred.promise
}

/**
 * 加载主板
 * @param {*} forceReload 
 */
function loadBoards(forceReload) {
	var deferred = Q.defer()

	if(config.boardNames && !forceReload) {
		log.debug("skip loadBoards")
		setTimeout(_ => {
			deferred.resolve(config.boardNames)
		}, 10)

		return deferred.promise
	}

	log.debug("loadBoards")
	var boardNames = {}
	var pidReg = /\n(([^\.\n]+)\.pid(\.\d)?)=([^\r\n]+)/g
	var vidReg = /\n(([^\.\n]+)\.vid(\.\d)?)=([^\r\n]+)/g
	var nameReg = /\n([^\.\n]+)\.name=([^\r\n]+)/g
	
	var searchPath = 'arduino-' + util.getPlatform()
	util.searchFiles(`${searchPath}/**/boards.txt`).then(pathList => {
		Q.all(pathList.map(p => {
			var d = Q.defer()
			util.readFile(p).then(content => {
				var pidList = content.match(pidReg)
				var vidList = content.match(vidReg)
				var nameList = content.match(nameReg)
				var names = []
				nameList.forEach(n => {
					var type = n.substring(0, n.indexOf(".name")).trim()
					var name = n.substring(n.indexOf("=") + 1).trim()
					names[type] = name
				})

				var types = pidList.map(pid => pid.substring(0, pid.indexOf('.pid')).trim())
				pidList = pidList.map(pid => pid.substring(pid.indexOf('=') + 3))
				vidList = vidList.map(vid => vid.substring(vid.indexOf('=') + 3))

				for(var i = 0; i < pidList.length; i++) {
					boardNames[pidList[i] + "_" + vidList[i]] = {
						pid: pidList[i],
						vid: vidList[i],
						type: types[i],
						name: names[types[i]]
					}
				}
			})
			.fin(_ => {
				d.resolve()
			})
			return d.promise
		})).then(_ => {
			config.boardNames = boardNames
			writeConfig().then(_ => {
				deferred.resolve(config.boardNames)
			}, err => {
				log.error(err)
				deferred.reject(err)
			})
		})
	}, err => {
		log.error(err)
		deferred.reject(err)
	})

	return deferred.promise
}

/**
 * 匹配主板名
 * @param {*} ports 
 */
function matchBoardNames(ports) {
	var deferred = Q.defer()

	log.debug("matchBoardNames")
	loadBoards().then(names => {
		ports.forEach(p => {
			if(p.productId && p.vendorId) {
				var board = config.boardNames[p.productId + "_" + p.vendorId]
				if(board) {
					p.boardName = board.name
				}
			}
		})
		deferred.resolve(ports)
	}, err => {
		log.error(err)
		deferred.reject(err)
	})

	return deferred.promise
}

/**
 * 获取脚本路径
 * @param {*} name 
 * @param {*} type 
 */
function getScriptPath(name) {
	var ext = is.windows() ? "bat" : "sh"
	return path.resolve(path.join(util.getResourcePath(), "scripts", `${name}.${ext}`))
}

/**
 * 获取command目录路径
 */
function getCommandDir() {
	return fs.mkdtempSync(path.join(app.getPath("temp"), `${app.getName()}-`))
}

/**
 * 获取arduino路径
 */
function getArduinoPath() {
	return path.resolve(path.join(util.getResourcePath(), `arduino-${util.getPlatform()}`))
}

/**
 * 获取解压后的packages路径
 */
function getPackagesPath() {
	return path.resolve(path.join(app.getPath("documents"), app.getName(), "packages"))
}
