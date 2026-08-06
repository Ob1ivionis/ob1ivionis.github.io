// Convert ==text== to <mark>text</mark> before markdown rendering
hexo.extend.filter.register('before_post_render', function(data) {
  data.content = data.content.replace(/==(.+?)==/g, '<mark>$1</mark>');
  return data;
});
