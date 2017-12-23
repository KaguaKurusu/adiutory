const fs = require('fs-extra')

let dirs = ['dist', 'tmp', 'node_modules']

dirs.forEach(dir => {
	fs.remove(dir, err => {
		if (err) return console.error(err)
	})
})
