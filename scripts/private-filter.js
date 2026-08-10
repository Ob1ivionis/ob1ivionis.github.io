'use strict';

const crypto = require('crypto');

function encryptPrivatePosts(hexo, posts, password) {
  const config = hexo.config;
  const themeCfg2 = hexo.config.theme_config || hexo.theme.config || {};
  const defaultCover = (themeCfg2.cover || {}).default_cover;
  const coverImg = Array.isArray(defaultCover) ? defaultCover[0] : defaultCover;
  const data = posts.map(p => ({
    title: p.title || '',
    date: p.date ? p.date.format('YYYY-MM-DD') : '',
    categories: (p.categories && p.categories.data) ? p.categories.data.map(c => c.name) : [],
    tags: (p.tags && p.tags.data) ? p.tags.data.map(t => t.name) : [],
    excerpt: p.excerpt || '',
    content: p.content || '',
    cover: p.cover || coverImg || '',
    path: p.path,
    url: config.root + p.path
  }));

  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  hexo._encryptedData = JSON.stringify({
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted.toString('hex')
  });
}

hexo.extend.filter.register('before_generate', function() {
  let cfg = (hexo.config.theme_config || hexo.theme.config || {}).private;
  // 从独立文件读取密码（不提交到公开仓库）
  if (cfg && cfg.enable) {
    const fs = require('fs');
    const path = require('path');
    const pwFile = path.join(hexo.base_dir, '_private_password');
    try {
      const pw = fs.readFileSync(pwFile, 'utf8').trim();
      if (pw) cfg = Object.assign({}, cfg, { password: pw });
    } catch (e) { /* 文件不存在，使用 config 中的值 */ }
  }
  if (!cfg || !cfg.enable) return;

  const Post = hexo.database.model('Post');
  if (!Post) return;

  const privatePosts = Post.toArray().filter(p => p.private === true);
  console.log('[private-filter] total:', Post.toArray().length, 'private:', privatePosts.length);

  if (privatePosts.length > 0) {
    encryptPrivatePosts(hexo, privatePosts, cfg.password);
  }

  const pagination = require('hexo-pagination');

  // === 重写 post generator（从模型直接读，确保私密文章页面生成）===
  hexo.extend.generator.register('post', locals => {
    const imgTestReg2 = /\.(png|jpe?g|gif|svg|webp|avif)(\?.*)?$/i;
    const postAssetFolder = hexo.config.post_asset_folder;
    const defCov = coverSrc;

    function * covGen() {
      if (!defCov) { while (true) yield false; }
      if (!Array.isArray(defCov)) { while (true) yield defCov; }
      const count = defCov.length;
      if (count === 1) { while (true) yield defCov[0]; }
      const maxHist = Math.min(3, count - 1);
      const hist = [];
      while (true) {
        let idx;
        do { idx = Math.floor(Math.random() * count); } while (hist.includes(idx));
        hist.push(idx);
        if (hist.length > maxHist) hist.shift();
        yield defCov[idx];
      }
    }
    const coverGen = covGen();

    const handleImg = data => {
      let { cover: cv, top_img: ti } = data;
      if (postAssetFolder) {
        if (ti && ti.indexOf('/') === -1 && imgTestReg2.test(ti)) data.top_img = data.path + ti;
        if (cv && cv.indexOf('/') === -1 && imgTestReg2.test(cv)) data.cover = data.path + cv;
      }
      if (cv === false) return data;
      if (!cv) { const rc = coverGen.next().value; data.cover = rc; cv = rc; }
      if (cv && (cv.indexOf('//') !== -1 || imgTestReg2.test(cv))) data.cover_type = 'img';
      return data;
    };

    const Post = hexo.database.model('Post');
    const posts = Post.toArray().sort((a, b) => b.date - a.date);
    posts.forEach((p, i) => {
      if (i > 0) p.prev = posts[i - 1];
      if (i < posts.length - 1) p.next = posts[i + 1];
    });
    // prev/next 只在同类（公开/私密）文章间跳转
    posts.forEach(p => {
      var prev = p.prev;
      while (prev && prev.private !== p.private) prev = prev.prev;
      p.prev = prev || null;
      var next = p.next;
      while (next && next.private !== p.private) next = next.next;
      p.next = next || null;
    });
    const result = posts.map(p => {
      p.__post = true;
      return { data: handleImg(p), layout: 'post', path: p.path };
    });
    console.log('[private-filter] post generator returning ' + result.length + ' pages');
    return result;
  });

  // === 重写 category generator（从数据库直接查，绕过 locals）===
  hexo.extend.generator.register('category', function(locals) {
    const config = this.config;
    const Post = hexo.database.model('Post');
    const allPosts = Post.toArray().filter(p => !p.private);

    // 手动重建分类-文章映射
    const catMap = new Map();
    allPosts.forEach(p => {
      (p.categories || []).data.forEach(c => {
        if (!catMap.has(c._id)) catMap.set(c._id, { name: c.name, path: c.path, posts: [] });
        catMap.get(c._id).posts.push(p);
      });
    });

    return [...catMap.values()].reduce((result, cat) => {
      const sorted = cat.posts.sort((a, b) => b.date - a.date);
      return result.concat(pagination(cat.path, sorted, {
        perPage: config.category_generator.per_page,
        layout: ['category', 'archive', 'index'],
        format: (config.pagination_dir || 'page') + '/%d/',
        data: { category: cat.name }
      }));
    }, []);
  });

  // === 重写 tag generator（从数据库直接查）===
  hexo.extend.generator.register('tag', function(locals) {
    const config = this.config;
    const Post = hexo.database.model('Post');
    const allPosts = Post.toArray().filter(p => !p.private);

    const tagMap = new Map();
    allPosts.forEach(p => {
      (p.tags || []).data.forEach(t => {
        if (!tagMap.has(t._id)) tagMap.set(t._id, { name: t.name, path: t.path, posts: [] });
        tagMap.get(t._id).posts.push(p);
      });
    });

    return [...tagMap.values()].reduce((result, tag) => {
      const sorted = tag.posts.sort((a, b) => b.date - a.date);
      return result.concat(pagination(tag.path, sorted, {
        perPage: config.tag_generator.per_page,
        layout: ['tag', 'archive', 'index'],
        format: (config.pagination_dir || 'page') + '/%d/',
        data: { tag: tag.name }
      }));
    }, []);
  });

  // === 删除多余的"搜索"菜单项 ===
  if (hexo.theme.config.menu && hexo.theme.config.menu['搜索']) {
    delete hexo.theme.config.menu['搜索'];
  }

  // === 注册过滤版 helpers（必须在 before_generate 中，覆盖主题的注册）===
  registerFilteredHelpers(hexo);

  // === 确保 cover_type 在任何 generator 之前就设置好 ===
  const imgTest = /\.(png|jpe?g|gif|svg|webp|avif)(\?.*)?$/i;
  const themeCfg3 = hexo.config.theme_config || hexo.theme.config || {};
  const defCover = (themeCfg3.cover || {}).default_cover;
  const defCoverSrc = Array.isArray(defCover) ? defCover[0] : defCover;
  var allPosts = Post.toArray();
  allPosts.forEach(p => {
    if (!p.cover && defCoverSrc) { p.cover = defCoverSrc; p.cover_type = 'img'; }
    if (p.cover && !p.cover_type && imgTest.test(p.cover)) { p.cover_type = 'img'; }
    if (p.date) {
      p._link = p.date.format('YYYY/MM/DD') + '/' + (p.slug || '');
    }
  });
  console.log('[private-filter] _link set on ' + allPosts.length + ' posts, first: ' + (allPosts[0] ? allPosts[0]._link : 'none'));


  // === toObject 过滤（只过滤 posts/pages，不动 categories/tags）===
  const themeCfg = hexo.config.theme_config || hexo.theme.config || {};
  const defaultCover = (themeCfg.cover || {}).default_cover;
  const coverSrc = Array.isArray(defaultCover) ? defaultCover[0] : defaultCover;
  const imgTestReg = /\.(png|jpe?g|gif|svg|webp|avif)(\?.*)?$/i;

  const LocalsProto = Object.getPrototypeOf(hexo.locals);
  const origToObject = LocalsProto.toObject;
  LocalsProto.toObject = function() {
    const result = origToObject.call(this);
    ['posts', 'pages'].forEach(key => {
      if (result[key] && result[key].data) {
        result[key].data = result[key].data.filter(p => !p.private);
        // 确保每个公开文章都有封面图
        result[key].data.forEach(p => {
          if (!p.cover && coverSrc) { p.cover = coverSrc; p.cover_type = 'img'; }
          if (p.cover && !p.cover_type && imgTestReg.test(p.cover)) { p.cover_type = 'img'; }
        });
        try { result[key].length = result[key].data.length; } catch(e) {}
      }
    });
    // 过滤 tags 和 categories 的计数（排除私密文章的标签/分类）
    if (Post) {
      const publicTags = new Set();
      const publicCats = new Set();
      Post.toArray().filter(p => !p.private).forEach(p => {
        (p.tags || []).data.forEach(t => publicTags.add(t.name));
        (p.categories || []).data.forEach(c => publicCats.add(c.name));
      });
      if (result.tags) try { result.tags.length = publicTags.size; } catch(e) {}
      if (result.categories) try { result.categories.length = publicCats.size; } catch(e) {}
    }
    return result;
  };

  console.log('[private-filter] Setup complete');
});

// === 注入保护：私密文章独立页面需要密码 ===
hexo.extend.filter.register('after_render:html', function(str, data) {
  if (data.page && data.page.private === true) {
    const check = `
<div id="private-post-gate" style="display:flex;justify-content:center;align-items:center;min-height:60vh;text-align:center">
  <div style="max-width:400px;padding:40px;background:var(--card-bg,#fff);border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
    <h2>🔒 私密文章</h2>
    <p style="color:#999;margin-bottom:20px">此文章需要密码才能访问</p>
    <input id="private-post-pw" type="password" placeholder="请输入密码" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;margin-bottom:12px;box-sizing:border-box">
    <button id="private-post-submit" style="padding:10px 32px;background:#49b1f5;color:#fff;border:none;border-radius:6px;cursor:pointer">解锁</button>
    <p id="private-post-error" style="display:none;color:#f44336;margin-top:12px"></p>
  </div>
</div>
<script>
(function(){
  var STORAGE_KEY='private_space_unlocked';
  function hex2(h){var b=new Uint8Array(h.length/2);for(var i=0;i<h.length;i+=2)b[i/2]=parseInt(h.substr(i,2),16);return b;}
  var gate=document.getElementById('private-post-gate');
  var pwInput=document.getElementById('private-post-pw');
  var submit=document.getElementById('private-post-submit');
  var error=document.getElementById('private-post-error');
  var article=document.getElementById('article-container');
  var postInfo=document.getElementById('post-info');
  var pagination=document.getElementById('pagination');
  var copyright=document.querySelector('.post-copyright');
  var tagShare=document.querySelector('.tag_share');
  var relatedPosts=document.querySelector('.related-posts');
  var comments=document.getElementById('post-comment');
  var elHide=[article,postInfo,pagination,copyright,tagShare,relatedPosts,comments];
  function hideAll(){elHide.forEach(function(el){if(el)el.style.display='none';});}
  function showAll(){elHide.forEach(function(el){if(el)el.style.display='';});}
  if (sessionStorage.getItem(STORAGE_KEY)==='true') {if(gate)gate.style.display='none';showAll();}
  else {hideAll();}
  async function unlock(){
    var pw=pwInput.value.trim();
    if(!pw){error.textContent='请输入密码';error.style.display='block';return;}
    try{
      var resp=await fetch('/private-posts.enc');
      if(!resp.ok)throw new Error('no file');
      var enc=await resp.text();
      var o=JSON.parse(enc);
      var s=hex2(o.salt),iv=hex2(o.iv),at=hex2(o.authTag),d=hex2(o.data);
      var enc2=new TextEncoder();
      var km=await crypto.subtle.importKey('raw',enc2.encode(pw),'PBKDF2',false,['deriveKey']);
      var key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:s,iterations:100000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['decrypt']);
      var c=new Uint8Array(d.length+at.length);c.set(d);c.set(at,d.length);
      await crypto.subtle.decrypt({name:'AES-GCM',iv:iv,tagLength:128},key,c);
      sessionStorage.setItem(STORAGE_KEY,'true');
      if(gate)gate.style.display='none';
      showAll();
    }catch(e){error.textContent='密码错误';error.style.display='block';}
  }
  submit.addEventListener('click',unlock);
  pwInput.addEventListener('keydown',function(e){if(e.key==='Enter')unlock();error.style.display='none';});
})();
</script>`;
    return str.replace('</article>', check + '</article>');
  }
  return str;
});

// 确保 categories 和 tags 列表页生成
hexo.extend.generator.register('category-index', function(locals) {
  return {
    path: 'categories/index.html',
    layout: ['page'],
    data: { type: 'categories', title: '分类', top_img: '/img/background.jpg' }
  };
});
hexo.extend.generator.register('tag-index', function(locals) {
  return {
    path: 'tags/index.html',
    layout: ['page'],
    data: { type: 'tags', title: '所有标签', top_img: '/img/background.jpg' }
  };
});

// 加密数据文件生成器
hexo.extend.generator.register('private-data', function(locals) {
  if (!hexo._encryptedData) return;
  return { path: 'private-posts.enc', data: hexo._encryptedData };
});

// 计算公开分类/标签数据（供所有 helper 共享）
function getPublicTaxData(hexo) {
  const Post = hexo.database.model('Post');
  const catNames = new Set();
  const tagNames = new Set();
  const catCounts = new Map();
  const tagCounts = new Map();
  if (!Post) return { catNames, tagNames, catCounts, tagCounts };
  Post.toArray().filter(p => !p.private).forEach(p => {
    (p.categories || []).data.forEach(c => {
      catNames.add(c.name);
      catCounts.set(c.name, (catCounts.get(c.name) || 0) + 1);
    });
    (p.tags || []).data.forEach(t => {
      tagNames.add(t.name);
      tagCounts.set(t.name, (tagCounts.get(t.name) || 0) + 1);
    });
  });
  return { catNames, tagNames, catCounts, tagCounts };
}

function registerFilteredHelpers(hexo) {
  const h = hexo.extend.helper;
  const Post = hexo.database.model('Post');
  const catNames = new Set();
  const tagNames = new Set();
  const catCounts = new Map();
  const tagCounts = new Map();
  Post.toArray().filter(p => !p.private).forEach(p => {
    (p.categories || []).data.forEach(c => {
      catNames.add(c.name);
      catCounts.set(c.name, (catCounts.get(c.name) || 0) + 1);
    });
    (p.tags || []).data.forEach(t => {
      tagNames.add(t.name);
      tagCounts.set(t.name, (tagCounts.get(t.name) || 0) + 1);
    });
  });
  return { catNames, tagNames, catCounts, tagCounts };
}

// 过滤版 list_categories helper
hexo.extend.helper.register('list_categories', function(categories, options) {
  if (!options && (!categories || typeof categories.length === 'undefined')) {
    options = categories;
    categories = this.site.categories;
  }
  if (!categories || !categories.length) return '';

  const { catNames, catCounts } = getPublicTaxData();
  const filtered = categories.toArray().filter(c => catNames.has(c.name));

  options = options || {};
  const style = options.style || 'list';
  const showCount = options.show_count !== undefined ? options.show_count : true;
  const depth = options.depth ? parseInt(options.depth, 10) : 0;

  // 简化版：只支持 list 样式
  var result = '<ul class="category-list">';
  var render = function(parent) {
    var html = '';
    filtered.forEach(function(cat) {
      var catParent = cat.parent ? String(cat.parent) : '';
      if (catParent !== String(parent || '')) return;
      var child = render(cat._id);
      html += '<li class="category-list-item">';
      html += '<a class="category-list-link" href="' + this.url_for(cat.path) + '">' + cat.name + '</a>';
      if (showCount) html += '<span class="category-list-count">' + (catCounts.get(cat.name) || 0) + '</span>';
      if (child) html += '<ul class="category-list-child">' + child + '</ul>';
      html += '</li>';
    }, this);
    return html;
  }.bind(this);
  result += render(null);
  result += '</ul>';
  return result;
});

// 过滤版 list_tags helper
hexo.extend.helper.register('list_tags', function(tags, options) {
  if (!options && (!tags || typeof tags.length === 'undefined')) {
    options = tags;
    tags = this.site.tags;
  }
  if (!tags || !tags.length) return '';

  const { tagNames, tagCounts } = getPublicTaxData();
  const filtered = tags.toArray().filter(t => tagNames.has(t.name));
  if (!filtered.length) return '';

  options = options || {};
  const min = options.min_font || 1;
  const max = options.max_font || 2;
  const unit = options.unit || 'em';
  const orderby = options.orderby || 'name';
  const order = options.order || 1;

  filtered.sort((a, b) => orderby === 'length' ?
    (order * (a.length - b.length)) : (order * a.name.localeCompare(b.name)));

  var html = '<div class="tag-cloud-list text-center">';
  filtered.forEach(function(t) {
    var size = min + (((tagCounts.get(t.name) || 0) / Math.max(...filtered.map(x => x.posts.data.filter(p => !p.private).length))) * (max - min));
    if (isNaN(size)) size = min;
    html += '<a href="' + this.url_for(t.path) + '" style="font-size: ' + size.toFixed(1) + unit + '">' + t.name + '</a>';
  }, this);
  html += '</div>';
  return html;
});

// 过滤版 tagcloud helper（侧边栏用）
hexo.extend.helper.register('tagcloud', function(tags, options) {
  if (!options && (!tags || typeof tags.length === 'undefined')) {
    options = tags;
    tags = this.site.tags;
  }
  const { tagNames, tagCounts } = getPublicTaxData();
  const filtered = tags.toArray().filter(t => tagNames.has(t.name));
  if (!filtered.length) return '';

  options = options || {};
  const min = options.min_font || 1;
  const max = options.max_font || 2;
  const amount = options.amount || 40;
  const unit = options.unit || 'em';
  const color = options.color;
  const start_color = options.start_color || '#999';
  const end_color = options.end_color || '#99a9bf';
  const orderby = options.orderby || 'name';
  const order = options.order || 1;

  filtered.sort((a, b) => orderby === 'length' ?
    (order * (a.length - b.length)) : (order * a.name.localeCompare(b.name)));

  var html = '';
  filtered.slice(0, amount).forEach(function(t) {
    var size = min + (((tagCounts.get(t.name) || 0) / Math.max(...filtered.map(x => x.posts.data.filter(p => !p.private).length))) * (max - min));
    if (isNaN(size)) size = min;
    html += '<a href="' + this.url_for(t.path) + '" style="font-size: ' + size.toFixed(1) + unit + ';';
    if (color) html += ' color: ' + start_color;
    html += '">' + t.name + '</a> ';
  }, this);
  return html;
});
hexo.extend.helper.register('tag_cloud', function() { return this.tagcloud.apply(this, arguments); });

// 过滤版 cloudTags helper（标签列表页用）
hexo.extend.helper.register('cloudTags', function(options) {
  options = options || {};
  const { tagNames, tagCounts } = getPublicTaxData();
  const source = options.source || this.site.tags;
  const all = source.toArray().filter(t => tagNames.has(t.name));
  if (!all.length) return '';

  const min = options.minfontsize || 1;
  const max = options.maxfontsize || 2;
  const unit = options.unit || 'em';
  const orderby = options.orderby || 'name';
  const order = options.order || 1;

  all.sort((a, b) => orderby === 'length' ?
    (order * ((tagCounts.get(a.name) || 0) - (tagCounts.get(b.name) || 0))) :
    (order * a.name.localeCompare(b.name)));

  var html = '<div class="tag-cloud-list text-center">';
  all.forEach(function(t) {
    const count = tagCounts.get(t.name) || 0;
    const maxCount = Math.max(...all.map(x => tagCounts.get(x.name) || 0));
    const size = min + (count / maxCount) * (max - min);
    html += '<a href="' + this.url_for(t.path) + '" style="font-size: ' + (isNaN(size) ? min : size).toFixed(1) + unit + '">' + t.name + '</a>';
  }, this);
  html += '</div>';
  return html;
});

// 过滤版 aside_categories helper（侧边栏用）
hexo.extend.helper.register('aside_categories', function(categories, options) {
  if (!options && (!categories || typeof categories.length === 'undefined')) {
    options = categories;
    categories = this.site.categories;
  }
  const { catNames, catCounts } = getPublicTaxData();
  const filtered = categories.toArray().filter(c => catNames.has(c.name));
  if (!filtered.length) return '';

  options = options || {};
  const showCount = options.show_count !== undefined ? options.show_count : true;

  var html = '<ul class="card-category-list">';
  var render = function(parent) {
    var result = '';
    filtered.forEach(function(cat) {
      if (String(cat.parent || '') !== String(parent || '')) return;
      result += '<li class="card-category-list-item">';
      result += '<a class="card-category-list-link" href="' + this.url_for(cat.path) + '">';
      result += '<span class="card-category-list-name">' + cat.name + '</span>';
      if (showCount) result += '<span class="card-category-list-count">' + (catCounts.get(cat.name) || 0) + '</span>';
      result += '</a>';
      result += '</li>';
    }, this);
    return result;
  }.bind(this);
  html += render(null);
  html += '</ul>';
  return html;
});

// 私密页面生成器
hexo.extend.generator.register('private', function(locals) {
  const cfg = (hexo.config.theme_config || hexo.theme.config || {}).private;
  if (!cfg || !cfg.enable) return;
  return {
    path: (cfg.path || 'private').replace(/^\/+|\/+$/g, '') + '/index.html',
    layout: 'private',
    data: { title: cfg.title || '私密空间' }
  };
});
