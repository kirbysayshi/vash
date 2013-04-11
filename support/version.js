var  semver = require('semver')
    ,fs = require('fs')
    ,program = require('commander');

var  pkgpath = __dirname + '/../package.json'
    ,pkg = JSON.parse( fs.readFileSync(pkgpath, 'utf8') )
    ,types = ['major', 'minor', 'patch', 'build'];

function bump(type){
    pkg.version = semver.inc( pkg.version, type );
    fs.writeFileSync( pkgpath, JSON.stringify(pkg, null, '  '), 'utf8' );
}

types.forEach(function(type){
    program
        .command(type)
        .description('Increment the ' + type + ' number in package.json')
        .action( bump.bind(null, type) );
});

program.parse(process.argv)
if (!program.args.length) console.log(pkg.version)