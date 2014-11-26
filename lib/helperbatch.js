
var slice = Array.prototype.slice

  , reHelperFuncHead = /vash\.helpers\.([^= ]+?)\s*=\s*function([^(]*?)\(([^)]*?)\)\s*{/
  , reHelperFuncTail = /\}$/

  , reBatchSeparator = /^\/\/\s*@\s*batch\s*=\s*(.*?)$/

// The logic for compiling a giant batch of templates or several
// helpers is nearly exactly the same. The only difference is the
// actual compilation method called, and the regular expression that
// determines how the giant string is split into named, uncompiled
// template strings.
module.exports = function compile(type, compile, str, options){

  var separator = type === 'helper'
    ? reHelperFuncHead
    : reBatchSeparator;

  var tpls = splitByNamedTpl(separator, str, function(ma, name){
    return name.replace(/^\s+|\s+$/, '');
  }, type === 'helper' ? true : false);

  if(tpls){
    Object.keys(tpls).forEach(function(path){
      tpls[path] = type === 'helper'
        ? compileSingleHelper(compile, tpls[path], options)
        : compile('@{' + tpls[path] + '}', options);
    });

    tpls.toClientString = function(){
      return Object.keys(tpls).reduce(function(prev, curr){
        if(curr === 'toClientString'){
          return prev;
        }
        return prev + tpls[curr].toClientString() + '\n';
      }, '')
    }
  }

  return tpls;
}

// Given a separator regex and a function to transform the regex result
// into a name, take a string, split it, and group the rejoined strings
// into an object.
// This is useful for taking a string, such as
//
//    // tpl1
//    what what
//    and more
//
//    // tpl2
//    what what again
//
// and returning:
//
//    {
//      tpl1: 'what what\nand more\n',
//      tpl2: 'what what again'
//    }
var splitByNamedTpl = function(reSeparator, markup, resultHandler, keepSeparator){

  var  lines = markup.split(/[\n\r]/g)
    ,tpls = {}
    ,paths = []
    ,currentPath = ''

  lines.forEach(function(line, i){

    var  pathResult = reSeparator.exec(line)
      ,handlerResult = pathResult ? resultHandler.apply(pathResult, pathResult) : null

    if(handlerResult){
      currentPath = handlerResult;
      tpls[currentPath] = [];
    }

    if((!handlerResult || keepSeparator) && line){
      tpls[currentPath].push(line);
    }
  });

  Object.keys(tpls).forEach(function(key){
    tpls[key] = tpls[key].join('\n');
  })

  return tpls;
}

var compileSingleHelper = function(compile, str, options){

  options = options || {};

    // replace leading/trailing spaces, and parse the function head
  var  def = str.replace(/^[\s\n\r]+|[\s\n\r]+$/, '').match(reHelperFuncHead)
    // split the function arguments, kill all whitespace
    ,args = def[3].split(',').map(function(arg){ return arg.replace(' ', '') })
    ,name = def[1]
    ,body = str
      .replace( reHelperFuncHead, '' )
      .replace( reHelperFuncTail, '' )

  // Wrap body in @{} to simulate it actually being inside a function
  // definition, since we manually stripped it. Without this, statements
  // such as `this.what = "what";` that are at the beginning of the body
  // will be interpreted as markup.
  body = '@{' + body + '}';

  // `args` and `asHelper` inform `vash.compile/link` that this is a helper
  options.args = args;
  options.asHelper = name;
  return compile(body, options);
}
