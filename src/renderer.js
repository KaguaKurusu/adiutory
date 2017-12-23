"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
const electron = require('electron')
const app = electron.remote.app
const ipc = electron.ipcRenderer
const shell = electron.shell
const path = require('path')
const fs = require('fs-extra')
const pkg = require(path.join(__dirname, 'package.json'))

const app_name = app.getName()
const app_ver = app.getVersion()
const app_arch = process.arch

ipc.send('get-sai-dir')
ipc.send('get-same-name-process')

ipc.on('sai-dir', (event, saiDir) => {
	saiDirPath.innerText = saiDir
})

ipc.on('same-name-process', (event, rcv_process) => {
	let set_value

	switch (rcv_process) {
		case 'overwrite':
		case 'skip':
			set_value = rcv_process
			break
		default:
			set_value = 'ask'
	}

	sameName.value = set_value
})

saiDirSelect.onclick = () => {
	ipc.send('select-sai-dir')
}

sameName.onchange = (event) => {
	ipc.send('set-same-name-process', event.target.value)
}

document.title = app_name
pageSelector('install')
createInstallArea()
setAboutPageText()
document.onselectstart = (event) => {
	return event.target.parentElement.classList.contains('enable-select')
}

function pageSelector(page) {
	let menuItems = menuItem.children
	let menuClassName = 'selected'
	let pageClass ='hide'

	for (let i = 0; i < menuItems.length; i++) {
		let menu_elem = menuItems[i]
		let page_id = menu_elem.children[0].hash.substr(1)
		let page_elem = document.getElementById(page_id)

		menu_elem.onclick = (event) => {
			pageSelector(event.target.hash.substr(1))
		}

		if (page_id === page) {
			menu_elem.classList.add(menuClassName)
			page_elem.classList.remove(pageClass)
		}
		else {
			menu_elem.classList.remove(menuClassName)
			page_elem.classList.add(pageClass)
		}
	}
}

function createInstallArea() {
	let dropAreas = document.getElementsByClassName('dropArea')

	for (let idx = 0; idx < dropAreas.length; idx++) {
		let elem = dropAreas.item(idx)
		let type = elem.id.replace(/(.+?)Install/, (match, p1) => {
			return p1
		})

		setInstDnD(elem, type)

		elem.onclick = () => {
			ipc.send('material-select', type)
		}
	}
}

function setInstDnD(elem, type) {
	elem.ondragover = (event) => {
		event.preventDefault()
		elem.classList.add('dragOver')
		return false
	}

	elem.ondragleave = (event) => {
		event.preventDefault()
		elem.classList.remove('dragOver')
		return false
	}

	elem.ondrop = (event) => {
		event.preventDefault()

		elem.classList.remove('dragOver')

		let files = event.dataTransfer.files
		let paths = new Array()

		for (let i = 0; i < files.length; i++) {
			let file = files.item(i)

			if (file.type === 'image/bmp') {
				paths.push(file.path)
			}
		}

		if (paths.length > 0) {
			ipc.send('material-install', type, paths)
		}
	}
}


function setAboutPageText() {
	appName.innerText = `${app_ver} ${app_arch}`
	repository.setAttribute('href', pkg.repository)
	license.setAttribute('href', `${pkg.repository}/LICENSE`)
	release_note.setAttribute('href', `${pkg.repository}/releases/v${app_ver}` )
	copyright.innerText = `Copyright (C) 2017, ${pkg.author}`

	let links = appLink.children
	for (let i = 0; i < links.length; i++) {
		if (links[i].tagName === 'A') {
			links[i].onclick = (event) => {
				let url = links[i].getAttribute('href')
				shell.openExternal(url)

				return false
			}
		}
	}
}
