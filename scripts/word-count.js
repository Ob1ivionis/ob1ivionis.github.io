'use strict';

// 中文字数统计（含标点）
function countChinese(str) {
  // 去掉 HTML 标签、Markdown 标记和空白字符
  const cleaned = str
    .replace(/<[^>]+>/g, '')           // HTML 标签
    .replace(/[#*`~>\[\]|_\-!(){}$]/g, '') // 常见 Markdown 标记
    .replace(/\s+/g, '');              // 空白字符

  // 统计中文字符和标点
  const chinese = (cleaned.match(/[一-鿿　-〿＀-￯]/g) || []).length;
  // 统计英文单词（以空格分隔）
  const englishOnly = cleaned.replace(/[一-鿿　-〿＀-￯]/g, ' ').trim();
  const english = englishOnly ? englishOnly.split(/\s+/).length : 0;

  return chinese + english;
}

hexo.extend.filter.register('after_render:html', function(str, data) {
  // 只处理文章页面（有 date 和 content 且 layout 为 post）
  const page = data.page || data;
  if (!page.content || !page.date) return str;
  if (page.layout === 'private') return str;
  if (page.__category || page.__tag || page.__index) return str;

  const content = data.page.content || '';
  const wordCount = countChinese(content);
  if (wordCount === 0) return str;

  const readingTime = Math.max(1, Math.ceil(wordCount / 300)); // 300字/分钟

  const info = `
<div class="post-word-count" style="margin-bottom:16px;padding:8px 16px;background:var(--card-bg,#fff);border-radius:8px;display:inline-flex;align-items:center;gap:16px;font-size:0.85em;color:var(--font-secondary-color,#999);border:1px solid #eee">
  <span><i class="fas fa-file-alt"></i> 全文共 ${wordCount} 字</span>
  <span><i class="fas fa-clock"></i> 阅读约 ${readingTime} 分钟</span>
</div>`;

  // 插入到文章内容开头
  const marker = '<article';
  const idx = str.indexOf(marker);
  if (idx === -1) return str;
  const endIdx = str.indexOf('>', idx);
  if (endIdx === -1) return str;
  return str.slice(0, endIdx + 1) + info + str.slice(endIdx + 1);
});
