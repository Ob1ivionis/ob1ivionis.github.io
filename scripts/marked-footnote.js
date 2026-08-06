// Register marked-footnote extension for Hexo
const markedFootnote = require('marked-footnote');

hexo.extend.filter.register('marked:use', function(markedUse) {
  markedUse(markedFootnote());
});
