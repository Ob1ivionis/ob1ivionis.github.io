'use strict';

const fs = require('fs');
const path = require('path');

// 在 hexo 初始化后、处理源文件前，把私有文章复制到 source/_posts/
hexo.extend.filter.register('after_init', function() {
  const privateDir = path.join(hexo.base_dir, 'private-posts');
  const targetDir = path.join(hexo.source_dir, '_posts');

  if (!fs.existsSync(privateDir)) {
    fs.mkdirSync(privateDir, { recursive: true });
    return;
  }

  const files = fs.readdirSync(privateDir).filter(f => {
    // 只导入有 YAML frontmatter 的文章，跳过 README 等
    if (!f.endsWith('.md')) return false;
    if (f === 'README.md') return false;
    const content = fs.readFileSync(path.join(privateDir, f), 'utf8');
    return content.trimStart().startsWith('---');
  });
  if (files.length === 0) return;

  files.forEach(file => {
    const src = path.join(privateDir, file);
    const dest = path.join(targetDir, file);
    const srcStat = fs.statSync(src);

    // 只在源文件更新时才复制
    if (fs.existsSync(dest)) {
      const destStat = fs.statSync(dest);
      if (srcStat.mtime <= destStat.mtime) return;
    }

    fs.copyFileSync(src, dest);
    hexo.log.info('[import-private] Copied: ' + file);
  });

  // 清理目标目录中不在源目录的旧私密文章
  const privateNames = new Set(files);
  const existingFiles = fs.readdirSync(targetDir).filter(f => f.endsWith('.md'));
  existingFiles.forEach(file => {
    // 检查是否是私密文章（含有 private: true）
    const content = fs.readFileSync(path.join(targetDir, file), 'utf8');
    if (/private:\s*true/.test(content)) {
      if (!privateNames.has(file)) {
        fs.unlinkSync(path.join(targetDir, file));
        hexo.log.info('[import-private] Removed stale: ' + file);
      }
    }
  });
});
