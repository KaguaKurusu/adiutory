const fs = require('fs-extra')

fs.emptyDir('tmp', err => {
	if (err) return console.error(err)

	fs.copy('src', 'tmp', {
		preserveTimestamps: true
	},
	err => {
		if (err) return console.error(err)
	})

	fs.copy('package.json', 'tmp/package.json', {
		preserveTimestamps: true
	},
	err => {
		if (err) return console.error(err)
	})

	fs.copy('node_modules', 'tmp/node_modules', {
		preserveTimestamps: true
	},
	err => {
		if (err) return console.error(err)
	})

	fs.copy('LICENSE', 'tmp/LICENSE', {
		preserveTimestamps: true
	},
	err => {
		if (err) return console.error(err)
	})
})
