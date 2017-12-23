const electron = require('electron')
// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow
const ipc = electron.ipcMain
const dialog = electron.dialog

const path = require('path')
const url = require('url')
const fs = require('fs-extra')
const iconv = require('iconv-lite')
const Config = require('electron-config')
const config = new Config({
	defaults: {
		bounds: {
			width: 640,
			height: 400
		},
		saiVer: 0,
		saiDir: 'C:\\PaintToolSAI',
		lastImgDir: app.getPath('pictures'),
		sameName: 'ask'
	}
})

const errMsg = {
	typeUndef: '存在しない素材タイプが指定されるという起こり得ないエラーが発生しました(´；ω；`)\nIssue投げてくださると助かります(´；ω；`)',
	writeConf: '設定ファイルの書き込みに失敗しました(´；ω；`)\n他のアプリで開いている場合は閉じてから再実行してください(＞人＜;)\n\n',
	readConf: '設定ファイルの読み込みに失敗しました(´；ω；`)\n他のアプリで開いている場合は閉じてから再実行してください(＞人＜;)\n\n',
	fileCopy: '下記ファイルのコピーに失敗しました(´；ω；`)\n他のアプリで開いている場合は閉じてから再実行してください(＞人＜;)\n\n',
	readFile: '下記ファイルの読み込みに失敗しました(´；ω；`)\n他のアプリで開いている場合は閉じてから再実行してください(＞人＜;)\n\n',
	fakeFile: '下記ファイルはフェイクファイルみたいだから除外したよ(/・ω・)/\n\n'
}

const mateTypes = (() => {
	let ver1 = (() => {
		let rObj = {}
		let types = ['blotmap', 'elemap', 'brushtex', 'papertex']

		types.forEach((type) => {
			rObj[type] = { dir: type, conf: type + '.conf', firstNum: 1 }

			if (type === 'blotmap' || type === 'elemap') {
				rObj[type]['conf'] = 'brushform.conf'
			}

			if (type === 'elemap') {
				rObj[type]['firstNum'] = 2
			}
		})

		return rObj
	})()

	let ver2 = (() => {
		let rObj = {}
		let types = ['blotmap', 'elemap', 'brushtex', 'papertex']

		types.forEach((type) => {
			rObj[type] = { dir: type }

			if (type === 'elemap') {
				rObj[type]['dir'] = 'bristle'
			}
		})

		return rObj
	})()

	return {1: ver1, 2: ver2}
})()

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow () {
	let bounds = config.get('bounds')

	// Create the browser window.
	mainWindow = new BrowserWindow({
		width: bounds.width,
		height: bounds.height,
		minWidth: 640,
		minHeight: 400,
		x: bounds.x,
		y: bounds.y,
		show: false,
		fullscreenable: false,
		useContentSize: true,
		minimizable: true,
		maximizable: true,
		resizable: true,
		title: app.getName(),
		icon: path.join(__dirname, 'app_icon.ico'),
		webPreferences: {
			webgl: false,
			webaudio: false
		}
	})

	mainWindow.once('ready-to-show', () => {
		mainWindow.show()

		if (checkSaiDir() === 0) {
			initSaiDir()
		}
	})

	// and load the index.html of the app.
	mainWindow.loadURL(url.format({
		pathname: path.join(__dirname, 'index.html'),
		protocol: 'file:',
		slashes: true
	}))

	// Open the DevTools.
	// mainWindow.webContents.openDevTools()

	mainWindow.on('close', () => {
		config.set('bounds', mainWindow.getContentBounds())
	})

	// Emitted when the window is closed.
	mainWindow.on('closed', () => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		mainWindow = null
	})
}

const isSecondInstance = app.makeSingleInstance((commandLine, workingDirectory) => {
	// Someone tried to run a second instance, we should focus our window.
	if (mainWindow) {
		if (mainWindow.isMinimized()) mainWindow.restore()
		mainWindow.focus()
	}
})

if (isSecondInstance) {
	app.quit()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit()
	}
})

app.on('activate', () => {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (mainWindow === null) {
		createWindow()
	}
})

ipc.on('material-install', (event, type, filePaths) => {
	let saiVer = config.get('saiVer')

	if (mateTypes[saiVer][type] !== undefined) {
		installMaterial(saiVer, type, filePaths)
		showInstallEndDialog()
	}
	else {
		showTypeUndefErrorDialog()
	}

})

ipc.on('material-select', (event, type) => {
	let saiVer = config.get('saiVer')
	let result = false

	if (mateTypes[saiVer][type] !== undefined) {
		selectMaterial(event, saiVer, type)
	}
	else {
		showTypeUndefErrorDialog()
	}
})

ipc.on('get-sai-dir', (event) => {
	sendSaiDir(event)
})

ipc.on('select-sai-dir', (event) => {
	selectSaiDir()
	sendSaiDir(event)
})

ipc.on('get-same-name-process', (event) => {
	event.sender.send('same-name-process', config.get('sameName'))
})

ipc.on('set-same-name-process', (event, rcv_process) => {
	let set_process = false

	switch (rcv_process) {
		case 'overwrite':
		case 'skip':
			set_process = rcv_process
			break
		default:
			set_process = 'ask'
	}

	config.set('sameName', rcv_process)
})

function checkSaiDir() {
	let saiDir = config.get('saiDir')

	if (fs.existsSync(path.join(saiDir, 'sai.exe'))) {
		config.set('saiVer', 1)

		return 1
	}
	else if (fs.existsSync(path.join(saiDir, 'sai2.exe'))) {
		config.set('saiVer', 2)

		return 2
	}
	else {
		return 0
	}
}

function initSaiDir() {
	dialog.showMessageBox(
		mainWindow,
		{
			type: 'info',
			title: 'SAIインストール先の設定',
			message: 'SAIのインストール先を選択してね(・ω・)ノ'
		}
	)
	selectSaiDir
}

function selectSaiDir() {
	let filePaths = dialog.showOpenDialog(
		mainWindow,
		{
			titile: 'SAIインストール先選択',
			properties: ['openDirectory'],
			defaultPath: 'C:\\'
		}
	)

	if (filePaths !== undefined) {
		let dir = filePaths[0]
		config.set('saiDir', dir)
	}

	if (checkSaiDir() === 0) {
		selectSaiDir()
	}
}

function sendSaiDir(event) {
	event.sender.send('sai-dir', config.get('saiDir'))
}

function installMaterial(saiVer, type, filePaths) {
	copyMaterial(saiVer, type, filePaths)

	if (saiVer === 1) {
		fixConf(saiVer, type, filePaths)
	}
}

function copyMaterial(saiVer, type, filePaths) {
	let fakeFiles = new Array()
	let readErrFiles = new Array()
	let filePathsBuf = filePaths.slice()
	let excludeCnt = 0

	filePathsBuf.forEach((filePath, index) => {
		let fileName = path.basename(filePath)
		let distPath = path.join(
			config.get('saiDir'),
			mateTypes[saiVer][type]['dir'],
			fileName
		)
		let isCopy = true
		let isExclude = false

		if (fs.existsSync(distPath)) {
			switch (config.get('sameName')) {
				case 'skip':
					isCopy = false
					break
				case 'overwrite':
					isCopy = true
					break
				default:
					let res = dialog.showMessageBox(mainWindow, {
						type: 'question',
						title: '同名のファイルが既にインストールされてるよ(´・ω・`)',
						message: `${fileName}を上書きしていいですか(´・ω・)？`,
						buttons: ['いいよ (&Y)', 'だめです (&N)'],
						cancelId: 1
					})

					if (res === 1) {
						isCopy = false
					}
			}
		}

		if (isCopy) {
			let checkResult = checkFakeFile(filePath)

			if (checkResult) {
				try {
					fs.copySync(filePath, distPath)
				}
				catch (err) {
					showErrorDialog(errMsg.fileCopy + fileName)

					isExclude = true
				}
			}
			else {
				if (checkResult === false) {
					fakeFiles.push(fileName)
				}
				else {
					readErrFiles.push(fileName)
				}

				isExclude = true
			}
		}

		if (isExclude) {
			filePaths.splice(index - excludeCnt, 1)
			excludeCnt++
		}
	})

	let errStr = new Array()
	let isErr = false

	if (fakeFiles.length > 0) {
		errStr.push(errMsg.fakeFile + fakeFiles.join('\n'))
		isErr = true
	}

	if (readErrFiles.length > 0) {
		errStr.push(errMsg.readFile + readErrFiles.join('\n'))
		isErr = true
	}

	if (isErr) {
		showErrorDialog(errStr.join('\n\n'))
	}
}

function checkFakeFile(filePath) {
	try {
		let data = fs.readFileSync(filePath)

		if (data[0] === 0x42 && data[1] ===  0x4d) {
			return true
		}
		else {
			return false
		}
	}
	catch (err) {
		if (err) {
			return undefined
		}
	}
}

function fixConf(saiVer, type, filePaths) {
	if (filePaths.length > 0) {
		let saiDir = config.get('saiDir')
		let confPath = path.join(saiDir, mateTypes[saiVer][type]['conf'])

		try {
			let data = iconv.decode(new Buffer(fs.readFileSync(confPath), 'binary'), 'Shift_JIS').trimRight()
			let lines = data.split(/\x0D\x0A/)
			let nl = []
			filePaths.forEach(filePath => {
				let fileName = path.basename(filePath)
				let line = `${mateTypes[saiVer][type]['firstNum']},${type}\\${fileName}`

				if (lines.includes(line) === false) {
					nl.push(line)
				}
			})

			if (type === 'blotmap') {
				let addIdx = lines.findIndex((element, index, array) => {
					if (element.search(/^2,/) !== -1) {
						return true
					}

					return false
				})

				lines.splice(addIdx, 0, ...nl)
			}
			else {
				Array.prototype.push.apply(lines, nl)
			}

			data = lines.join('\x0D\x0A') + '\x0D\x0A'

			writeConf(saiVer, type, data)
		}
		catch (err) {
			showErrorDialog(errMsg.readConf)
		}
	}
}

function writeConf(saiVer, type, data) {
	let saiDir = config.get('saiDir')
	let confPath = path.join(saiDir, mateTypes[saiVer][type]['conf'])

	try {
		fs.writeFileSync(confPath, iconv.encode(data, 'Shift_JIS'))
	}
	catch (err) {
		showErrorDialog(errMsg.writeConf)
	}
}

function selectMaterial(event, saiVer, type) {
	let lastDir = config.get('lastImgDir')

	let filePaths = dialog.showOpenDialog(
		mainWindow,
		{
			title: 'インストールしたい素材を選択してね！',
			defaultPath: lastDir,
			filters: [{name: '画像', extensions: ['bmp']}],
			properties: ['multiSelections']
		}
	)

	if (filePaths !== undefined) {
		config.set('lastImgDir', path.dirname(filePaths[0]))
		installMaterial(saiVer, type, filePaths)
		showInstallEndDialog()
	}
}

function showInstallEndDialog() {
	dialog.showMessageBox(mainWindow, {
		type: 'info',
		titile: 'インストール終了',
		message: 'インストール処理が終了したよ(｀・ω・´)'
	})
}

function showErrorDialog(msg) {
	dialog.showMessageBox(mainWindow, {
		type: 'error',
		title: 'Error',
		message: msg
	})
}

function showTypeUndefErrorDialog() {
	showErrorDialog(errMsg.typeUndef)
}
