---
title: 网站使用与发文指南
date: 2026-08-08 10:00:00
categories: 网站
tags:
  - 指南
---

欢迎来到 Aya's SEKAI！本文档介绍如何在本站发布文章，以及公开/私密空间的使用方法。

## 环境准备

本站基于 Hexo 搭建，部署在 GitHub Pages。发布文章前需要确保本地环境正常：

```bash
# 进入项目目录
cd library-aya

# 安装依赖（首次）
npm install

# 本地预览
hexo server
# 浏览器打开 http://localhost:4000
```

## 网站结构

### 公开空间

所有没有标记为私密的文章都会显示在公开空间。访客可以浏览：

- **首页** — 最新文章卡片（含封面图和悬停动效）
- **分类** — 按分类查找（如「判型分析」「网站」）
- **标签** — 按标签筛选（如 `SEI`、`EII`、`指南`）
- **归档** — 按年月浏览历史文章
- **搜索** — 全文搜索

### 私密空间

导航栏右侧的「🔒 私密空间」是密码保护区域，适合存放：

- 争议性人物的判型文
- 未完成的分析
- 需限制阅读范围的内容

私密空间内支持与公开空间相同的浏览功能（分类筛选、标签筛选、搜索）。关闭浏览器后需重新输入密码。

**密码配置位置：** `_config.butterfly.yml` → `private.password`

---

## 发布公开文章

### 1. 创建文章文件

在 `source/_posts/` 目录下创建 `.md` 文件。文件名建议使用英文短横线命名：

```
source/_posts/my-article.md
```

### 2. 编写 Frontmatter

文章开头必须包含 YAML 格式的元数据：

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
|------|------|------|
| `title` | 文章标题 | ✅ |
| `date` | 发布日期（`YYYY-MM-DD HH:MM:SS`） | ✅ |
| `categories` | 分类名，支持多级如 `判型分析/群友判型分析` | 推荐 |
| `tags` | 标签列表，用 `- ` 开头 | 推荐 |
| `cover` | 自定义封面图路径（如 `/img/custom.jpg`） | 可选 |

### 3. 编写正文

支持标准 Markdown 语法，以及本站扩展：

```markdown
## 二级标题

### 三级标题

正文段落。

> 引用文字

==高亮文字==

使用 `==文字==` 语法标记高亮内容。

{% note success %}
提示框内容
{% endnote %}

{% hideToggle 点击展开 %}
折叠隐藏的内容
{% endhideToggle %}

脚注：[^1]

[^1]: 脚注内容
```

### 4. 预览

```bash
hexo server
```

浏览器打开 `http://localhost:4000` 确认排版无误。

### 5. 提交并部署

```bash
# 将新文章加入 Git
git add source/_posts/my-article.md
git commit -m "添加文章：文章标题"

# 推送到 GitHub
git push

# 生成并部署
hexo generate && hexo deploy
```

部署后等待约 1 分钟，GitHub Pages 会自动更新。

---

## 发布私密文章

私密文章存放在独立目录 `private-posts/`，通过**私有 Git 仓库**备份，不会出现在公开仓库中。

### 1. 创建私密文章

在 `private-posts/` 目录下创建 `.md` 文件：

```
private-posts/secret-analysis.md
```

### 2. 编写 Frontmatter

与公开文章格式相同，只需额外添加一行 `private: true`：

```yaml
---
title: 争议人物判型
date: 2026-08-08 12:00:00
categories: 私密判型/争议分析
tags:
  - 争议
private: true
---
```

> `private: true` 是唯一区分公开/私密文章的标记。不要忘记。

### 3. 备份到私有仓库

```bash
cd private-posts
git add .
git commit -m "新增：争议人物判型"
git push
cd ..
```

### 4. 生成并部署

```bash
hexo generate && hexo deploy
```

`hexo generate` 会自动检测 `private-posts/` 中的新文件，复制到 `source/_posts/`，加密后生成静态页面。私密文章会：

- 自动生成独立页面（带密码保护）
- 加密存储到 `private-posts.enc`
- 从公开列表（首页、分类、标签、搜索）中完全隐藏

### 5. 验证

1. 访问 `你的域名/private/`，输入密码
2. 在私密空间卡片列表中确认新文章出现
3. 点击卡片进入文章页，确认排版正确

---

## 文件结构速查

```
library-aya/
├── source/_posts/          ← 公开文章（提交到公开仓库）
├── private-posts/          ← 私密文章（提交到私有仓库）
│   ├── README.md
│   └── secret-analysis.md
├── _config.butterfly.yml   ← 主题配置（含私密密码）
├── scripts/                ← 自动化脚本
└── source/img/             ← 图片资源
```

| 目录 | 公开仓库可见 | 说明 |
|------|:---:|------|
| `source/_posts/` | ✅ | 公开文章 |
| `source/_posts/private-*` | ❌ | 导入后的私密文章（已 gitignore） |
| `private-posts/` | ❌ | 私密文章源文件（已 gitignore，推送至私有仓库） |

---

## 常用命令

```bash
hexo server                   # 本地预览
hexo generate                 # 生成静态文件
hexo deploy                   # 部署到 GitHub Pages
hexo clean && hexo generate   # 清理缓存后重新生成
```

## 注意事项

1. **部署前先预览**：`hexo server` 在浏览器确认无误
2. **私密文章勿忘 `private: true`**：缺少此标记会被公开
3. **私密文章源文件及时推送**：`cd private-posts && git push`
4. **图片放在 `source/img/`**：文章中引用 `/img/文件名.jpg`
5. **密码在 `_config.butterfly.yml`** 的 `private.password` 中修改
