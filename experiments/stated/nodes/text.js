module.exports = function TextNode(value) {
  this.type = 'VashText';
  this.value = value || '';
  this.startloc = null;
  this.endloc = null;
}