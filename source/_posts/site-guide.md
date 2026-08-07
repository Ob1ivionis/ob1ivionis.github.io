---
title: 网站使用与发文指南
date: 2026-08-08 12:00:00
categories: 网站
tags:
  - 指南
---

欢迎来到 Aya's SEKAI！本文档介绍如何在本站发布文章，以及公开和私密空间的使用方法。

## 环境准备

本站基于 Hexo 搭建，部署在 GitHub Pages。发布文章前需要确保本地环境正常：

```bash
cd library-aya
npm install      # 首次
hexo server      # 本地预览 → http://localhost:4000
```

---

## 发布公开文章

### 1. 创建文件

在 `source/_posts/` 目录下创建 `.md` 文件：

```
source/_posts/my-article.md
```

### 2. 编写 Frontmatter

```yaml
---
title: 文章标题
date: 2026-08-08 12:00:00
categories: 判型分析
tags:
  - SEI
  - 文学家
---
```

| 字段 | 说明 | 必填 |
|------|------|:--:|
| `title` | 文章标题 | ✅ |
| `date` | 发布日期，格式 `YYYY-MM-DD HH:MM:SS` | ✅ |
| `categories` | 分类，支持多级如 `判型分析/群友判型分析` | 推荐 |
| `tags` | 标签列表 | 推荐 |
| `cover` | 自定义封面图，如 `/img/custom.jpg` | 可选 |

### 3. 写正文

支持标准 Markdown 及扩展语法：

```markdown
## 二级标题

> 引用文字

==高亮文字==

{% note success %}
提示框
{% endnote %}

{% hideToggle 点击展开 %}
折叠内容
{% endhideToggle %}
```

### 4. 提交并部署

```bash
git add source/_posts/my-article.md
git commit -m "新文章：标题"
git push

hexo generate && hexo deploy
```

---

## 发布私密文章

私密文章存放在 `private-posts/` 目录，通过私有 Git 仓库备份，不会出现在公开仓库。

### 1. 创建文件

在 `private-posts/` 目录下创建 `.md` 文件：

```
private-posts/secret-article.md
```

### 2. 编写 Frontmatter

==与公开文章唯一区别：加一行 `private: true`==

```yaml
---
title: 争议人物判型
date: 2026-08-08 12:00:00
categories: 私密判型
tags:
  - 争议
private: true
---
```

> `private: true` 必须写在两个 `---` 之间。这是区分公开/私密的唯一标记。

### 3. 备份到私有仓库

```bash
cd private-posts
git add .
git commit -m "新增：文章标题"
git push
cd ..
```

### 4. 生成并部署

```bash
hexo generate && hexo deploy
```

`hexo generate` 会自动把 `private-posts/` 下的文件导入、加密、生成页面。私密文章部署后会：

- 自动生成受密码保护的独立页面
- 加密存入 `private-posts.enc`
- 从首页、分类、标签、搜索中完全隐藏

### 5. 验证

访问 `网站域名/private/`，输入密码，在卡片列表中确认新文章出现。

---

## 网站结构速查

| 目录 | 提交到 | 内容 |
|------|:--:|------|
| `source/_posts/` | 公开仓库 | 公开文章源文件 |
| `private-posts/` | 私有仓库 | 私密文章源文件 |
| `source/img/` | 公开仓库 | 图片资源 |
| `_config.butterfly.yml` | 公开仓库 | 主题配置（含私密密码） |

## 常用命令

```bash
hexo server                   # 本地预览
hexo generate                 # 生成静态文件
hexo deploy                   # 部署
hexo clean && hexo generate   # 清理缓存重新生成
```

## 注意事项

- 私密文章**务必**在 frontmatter 中加 `private: true`
- 私密源文件写完及时 `cd private-posts && git push` 备份
- 图片放在 `source/img/`，文章中引用 `/img/文件名.jpg`
- 私密密码在 `_config.butterfly.yml` → `private.password`
- 部署前先 `hexo server` 本地确认
