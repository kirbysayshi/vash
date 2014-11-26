
exports.context = function(input, lineno, columnno, linebreak) {
  linebreak = linebreak || '!LB!';

  var lines = input.split(linebreak)
    , contextSize = lineno === 0 && columnno === 0 ? lines.length - 1 : 3
    , start = Math.max(0, lineno - contextSize)
    , end = Math.min(lines.length, lineno + contextSize);

  return lines
    .slice(start, end)
    .map(function(line, i, all){
      var curr = i + start + 1;

      return (curr === lineno ? '  > ' : '    ')
        + (curr < 10 ? ' ' : '')
        + curr
        + ' | '
        + line;
    }).join('\n');
}