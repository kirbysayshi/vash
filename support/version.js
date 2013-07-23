var  semver = require('semver')
    ,fs = require('fs')
    ,path = require('path')
    ,program = require('commander');

var  pkgpath = path.join(__dirname, '../', 'package.json')
    ,pkg = JSON.parse( fs.readFileSync(pkgpath, 'utf8') )
    ,types = ['major', 'minor', 'patch', 'build'];

function bump(type){
    pkg.version = semver.inc( pkg.version, type );
    fs.writeFileSync( pkgpath, JSON.stringify(pkg, null, '  '), 'utf8' );
    process.stdout.write(pkg.version);
}

types.forEach(function(type){
    program
        .command(type)
        .description('Increment the ' + type + ' number in package.json')
        .action( bump.bind(null, type) );
});

program
    .command('replace')
    .description('Replace {{ version }} with the current version from package.json')
    .action(function(){
        var buf = '';
        process.stdin.on('data', function(chunk){ buf += chunk; })
        process.stdin.on('end', function(){
            process.stdout.write( buf.replace('{{ version }}', pkg.version) );
        })
        process.stdin.resume(); // required for < 0.10
    })

program.parse(process.argv)
if (!program.args.length) process.stdout.write(pkg.version)