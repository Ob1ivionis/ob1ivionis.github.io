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
  const cfg = (hexo.config.theme_config || hexo.theme.config || {}).private;
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
    return posts.map(p => {
      p.__post = true;
      return { data: handleImg(p), layout: 'post', path: p.path };
    });
  });

  // === 重写 category generator（过滤私密）===
  hexo.extend.generator.register('category', function(locals) {
    const config = this.config;
    return locals.categories.data
      .filter(cat => cat.posts && cat.posts.data && cat.posts.data.some(p => !p.private))
      .reduce((result, cat) => {
        const filtered = cat.posts.data.filter(p => !p.private).sort((a, b) => b.date - a.date);
        return result.concat(pagination(cat.path, filtered, {
          perPage: config.category_generator.per_page,
          layout: ['category', 'archive', 'index'],
          format: (config.pagination_dir || 'page') + '/%d/',
          data: { category: cat.name }
        }));
      }, []);
  });

  // === 重写 tag generator（过滤私密）===
  hexo.extend.generator.register('tag', function(locals) {
    const config = this.config;
    return locals.tags.data
      .filter(tag => tag.posts && tag.posts.data && tag.posts.data.some(p => !p.private))
      .reduce((result, tag) => {
        const filtered = tag.posts.data.filter(p => !p.private).sort((a, b) => b.date - a.date);
        return result.concat(pagination(tag.path, filtered, {
          perPage: config.tag_generator.per_page,
          layout: ['tag', 'archive', 'index'],
          format: (config.pagination_dir || 'page') + '/%d/',
          data: { tag: tag.name }
        }));
      }, []);
  });

  // === toObject 过滤 + 确保封面图 ===
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
        });
        delete result[key].length;
      }
    });
    ['categories', 'tags'].forEach(key => {
      if (result[key] && result[key].data) {
        result[key].data.forEach(item => {
          if (item.posts && item.posts.data) {
            item.posts.data = item.posts.data.filter(p => !p.private);
            delete item.posts.length;
          }
        });
        result[key].data = result[key].data.filter(item => {
          return item.posts && item.posts.data && item.posts.data.length > 0;
        });
        delete result[key].length;
      }
    });
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

// 加密数据文件生成器
hexo.extend.generator.register('private-data', function(locals) {
  if (!hexo._encryptedData) return;
  return { path: 'private-posts.enc', data: hexo._encryptedData };
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
