'use strict';

// 在 before_generate 的最末尾注册（覆盖主题的 helper）
hexo.extend.filter.register('before_generate', function() {
  registerAll();
}, 999);

function registerAll() {
  if (hexo._helpersRegistered) return;
  hexo._helpersRegistered = true;

// 计算公开分类/标签
function getPublicData() {
  const Post = hexo.database.model('Post');
  const cats = new Set(), tags = new Set(), catN = new Map(), tagN = new Map();
  if (!Post) return { cats, tags, catN, tagN };
  Post.toArray().filter(p => !p.private).forEach(p => {
    (p.categories || []).data.forEach(c => { cats.add(c.name); catN.set(c.name, (catN.get(c.name)||0)+1); });
    (p.tags || []).data.forEach(t => { tags.add(t.name); tagN.set(t.name, (tagN.get(t.name)||0)+1); });
  });
  return { cats, tags, catN, tagN };
}

// 分类列出 helper（分类列表页）
hexo.extend.helper.register('list_categories', function(categories, options) {
  if (!options && (!categories || typeof categories.length === 'undefined')) {
    options = categories;
    categories = this.site.categories;
  }
  if (!categories || !categories.length) return '';
  const { cats, catN } = getPublicData();
  const filtered = categories.toArray().filter(c => cats.has(c.name));
  if (!filtered.length) return '';
  options = options || {};
  const depth = options.depth ? parseInt(options.depth, 10) : 0;
  const showCount = options.show_count !== false;

  function render(parent) {
    let html = '';
    filtered.forEach(function(cat) {
      if (String(cat.parent || '') !== String(parent || '')) return;
      const child = depth ? render(cat._id) : '';
      html += '<li class="category-list-item">';
      html += '<a class="category-list-link" href="' + this.url_for(cat.path) + '">' + cat.name + '</a>';
      if (showCount) html += '<span class="category-list-count">' + (catN.get(cat.name)||0) + '</span>';
      if (child) html += '<ul class="category-list-child">' + child + '</ul>';
      html += '</li>';
    }, this);
    return html;
  }
  return '<ul class="category-list">' + render.call(this, null) + '</ul>';
});

// 标签颜色方案
const TAG_COLORS = ['#e91e63','#9c27b0','#673ab7','#3f51b5','#2196f3','#009688','#4caf50','#ff9800','#ff5722','#795548','#607d8b'];

// 标签云 helper（标签列表页）
hexo.extend.helper.register('cloudTags', function(options) {
  options = options || {};
  const { tags, tagN } = getPublicData();
  const source = (options.source || this.site.tags).toArray().filter(t => tags.has(t.name));
  if (!source.length) return '';

  const min = options.minfontsize || 1, max = options.maxfontsize || 2;
  const orderby = options.orderby || 'name', order = options.order || 1;
  const unit = options.unit || 'em';

  source.sort((a,b) => orderby==='length' ? (order*((tagN.get(a.name)||0)-(tagN.get(b.name)||0))) : (order*a.name.localeCompare(b.name)));

  let html = '';
  const maxCount = Math.max(1, ...source.map(x => tagN.get(x.name)||0));
  source.forEach(function(t, i) {
    const s = min + ((tagN.get(t.name)||0) / maxCount) * (max - min);
    const color = TAG_COLORS[i % TAG_COLORS.length];
    html += '<a href="' + this.url_for(t.path) + '" style="font-size:' + s.toFixed(1) + unit + ';color:' + color + ';background:' + color + '15;padding:4px 12px;border-radius:16px;display:inline-block;margin:4px;transition:all .25s ease" onmouseover="this.style.transform=\'scale(1.1)\';this.style.boxShadow=\'0 4px 12px ' + color + '66\'" onmouseout="this.style.transform=\'scale(1)\';this.style.boxShadow=\'none\'">' + t.name + '</a>';
  }, this);
  return html;
});

// 侧边栏分类
hexo.extend.helper.register('aside_categories', function(categories, options) {
  if (!options && (!categories || typeof categories.length === 'undefined')) {
    options = categories; categories = this.site.categories;
  }
  if (!categories || !categories.length) return '';
  const { cats, catN } = getPublicData();
  const filtered = categories.toArray().filter(c => cats.has(c.name));
  if (!filtered.length) return '';
  options = options || {};
  const showCount = options.show_count !== false;

  function render(parent) {
    let html = '';
    filtered.forEach(function(cat) {
      if (String(cat.parent || '') !== String(parent || '')) return;
      html += '<li class="card-category-list-item">';
      html += '<a class="card-category-list-link" href="' + this.url_for(cat.path) + '">';
      html += '<span class="card-category-list-name">' + cat.name + '</span>';
      if (showCount) html += '<span class="card-category-list-count">' + (catN.get(cat.name)||0) + '</span>';
      html += '</a></li>';
    }, this);
    return html;
  }
  return '<ul class="card-category-list">' + render.call(this, null) + '</ul>';
});

// 侧边栏标签云
hexo.extend.helper.register('tagcloud', function(tags, options) {
  if (!options && (!tags || typeof tags.length === 'undefined')) {
    options = tags; tags = this.site.tags;
  }
  const { tags: pubTags, tagN } = getPublicData();
  const filtered = tags.toArray().filter(t => pubTags.has(t.name));
  if (!filtered.length) return '';
  options = options || {};
  const min = options.min_font||1, max = options.max_font||2, amount = options.amount||40;
  const orderby = options.orderby||'name', order = options.order||1;

  filtered.sort((a,b) => orderby==='length' ? (order*((tagN.get(a.name)||0)-(tagN.get(b.name)||0))) : (order*a.name.localeCompare(b.name)));

  let html = '';
  const maxCount = Math.max(1, ...filtered.map(x => tagN.get(x.name)||0));
  filtered.slice(0,amount).forEach(function(t, i) {
    const s = min + ((tagN.get(t.name)||0) / maxCount) * (max - min);
    const color = TAG_COLORS[i % TAG_COLORS.length];
    html += '<a href="' + this.url_for(t.path) + '" style="font-size:' + s.toFixed(1) + 'em;color:' + color + ';transition:all .2s ease" onmouseover="this.style.opacity=\'0.7\';this.style.transform=\'scale(1.08)\'" onmouseout="this.style.opacity=\'1\';this.style.transform=\'scale(1)\'">' + t.name + '</a> ';
  }, this);
  return html;
});
hexo.extend.helper.register('tag_cloud', function() { return this.tagcloud.apply(this, arguments); });

// 标签列出 helper（归档页等）
hexo.extend.helper.register('list_tags', function(tags, options) {
  if (!options && (!tags || typeof tags.length === 'undefined')) {
    options = tags; tags = this.site.tags;
  }
  const { tags: pubTags } = getPublicData();
  const filtered = tags.toArray().filter(t => pubTags.has(t.name));
  if (!filtered.length) return '';
  return '<ul class="tag-list">' + filtered.map(function(t) {
    return '<li class="tag-list-item"><a class="tag-list-link" href="' + this.url_for(t.path) + '">' + t.name + '</a></li>';
  }, this).join('') + '</ul>';
});

} // end registerAll
