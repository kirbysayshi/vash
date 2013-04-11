var  semver = require('semver')
	,fs = require('fs')
	,program = require('commander')

var  pkgpath = __dirname + '/../package.json'
	,pkg = JSON.parse( fs.readFileSync(pkgpath, 'utf8') )
	,buildnum = semver.inc( pkg.version, 'build' )

program
	.command('exports')
	.description('Write src/vexports.js with current version to stdout')
	.action(function(){
		var  vexportspath = __dirname + '/../src/vexports.js'
			,vexports = fs.readFileSync( vexportspath, 'utf8' )
			,reVersion = /^(exports\["version"\] = ").+?(";)/;

		vexports = vexports.replace( reVersion, function( ma, c1, c2 ){
			return c1 + buildnum + c2;
		});

		process.stdout.write( vexports );
	});

program
	.command('license')
	.description('Write the license with current version to stdout')
	.action(function(){
		var license = fs.readFileSync( __dirname + '/license.header.js', 'utf8' );
		license = license.replace('{{ version }}', buildnum);
		process.stdout.write( license );
	});

program.parse(process.argv);
if (!program.args.length) program.help();