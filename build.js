const packager = require("electron-packager")
const package = require("./package.json")
const os = require('os')

let out_arch = null

switch (process.argv[2]) {
	case 'x64':
	case 'x86_64':
	case 'amd64':
		out_arch = 'x64'
		break
	case 'ia32':
	case 'x86':
		out_arch = 'ia32'
		break
	default:
		switch (os.arch()) {
			case 'x64':
				out_arch = 'x64'
				break
			case 'x86':
			case 'ia32':
				out_arch = 'ia32'
				break
			default:
				out_arch = null
		}
}

switch (out_arch) {
	case 'x64':
	case 'ia32':
		packager({
			name: package["name"],
			dir: "tmp",
			out: "dist",
			icon: "tmp/app_icon.ico",
			ignore: '.git',
			platform: "win32",
			arch: out_arch,
			electronVersion: package["devDependencies"]["electron"],
			overwrite: true,
			asar: true,
			appVersion: package["version"],
			appCopyright: `Copyright (C) 2017 ${package["author"]}.`,

			win32metadata: {// Windowsのみのオプション
				CompanyName: package["author"],
				FileDescription: package["name"],
				OriginalFilename: package["name"]+".exe",
				ProductName: package["name"],
				InternalName: package["name"]
			}

		}, function (err, appPaths) {// 完了時のコールバック
			if (err) console.log(err)
			console.log("Done: " + appPaths)
		})
		break
}
