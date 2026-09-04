# QBlog

[English](README.md) · [中文](README.zh-CN.md)

**QBlog** 是基于 Next.js 的多语言博客平台。文章存储在 MongoDB，媒体文件放在 Cloudflare R2，管理后台支持写作、翻译与资源管理。

在线站点：[blog.seedpower.app](https://blog.seedpower.app)

## 特性

- **MongoDB 文章库** — 在 `/admin` 中创建、编辑、草稿与发布，无需为每次改动提交 Markdown
- **19 种语言** — 通过 `next-intl` 支持界面与内容；默认语言为英文（`en`），URL 采用 `as-needed` 前缀策略
- **AI 翻译** — 借助 OpenRouter，可将源语言文章翻译为其它语言版本（标题、摘要、正文、标签）
- **媒体库** — 在 Cloudflare R2 上传与整理图片/音视频，并通过公共 CDN 访问
- **MDX 渲染** — 支持 GFM、数学公式、引用、Mermaid、代码高亮、目录与图片缩放
- **搜索与 SEO** — kbar 搜索、sitemap、robots、Open Graph、RSS、阅读时长
- **开箱即部署** — Dockerfile（Node 22、standalone）与带健康检查的 `railway.toml`

## 技术栈

| 层级 | 选型 |
| --- | --- |
| 应用 | Next.js 15（App Router）、React 19、TypeScript |
| 样式 | Tailwind CSS 4、next-themes |
| 国际化 | next-intl |
| 内容 | MongoDB + MDX（`next-mdx-remote`） |
| 管理鉴权 | 密码 + JWT Cookie（`jose`） |
| 媒体 | Cloudflare R2（S3 API） |
| AI | OpenRouter |
| 包管理 | Yarn 3（Berry） |

## 环境要求

- Node.js **≥ 22**
- Yarn 3（建议 `corepack enable`）
- MongoDB（本地、Atlas 或 Railway 插件）
- 可选：Cloudflare R2 凭证、OpenRouter API Key

## 快速开始

```bash
git clone https://github.com/seedpower/qblog.git
cd qblog
corepack enable
yarn install
cp .env.example .env.local
# 编辑 .env.local — 至少配置 MONGODB_URI、MONGODB_DB、ADMIN_PASSWORD、AUTH_SECRET
yarn seed          # 可选：将 data/blog 中的示例 MDX 导入 MongoDB
yarn dev
```

访问 [http://localhost:3000](http://localhost:3000)。管理后台：[http://localhost:3000/admin](http://localhost:3000/admin)。

## 环境变量

完整列表见 [`.env.example`](.env.example)。本地最小配置：

| 变量 | 用途 |
| --- | --- |
| `MONGODB_URI` | MongoDB 连接串 |
| `MONGODB_DB` | 数据库名（默认 `blog`） |
| `ADMIN_PASSWORD` | `/admin` 登录密码 |
| `AUTH_SECRET` | JWT 会话用的长随机字符串 |

可选：

| 变量 | 用途 |
| --- | --- |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` | 文章自动翻译（可在「管理 → 设置」中覆盖） |
| `TRANSLATE_CONCURRENCY` | 并行翻译语言数（1–12，默认 5） |
| `R2_*` / `R2_PUBLIC_BASE_URL` | 媒体管理与公共资源地址 |
| 邮件订阅 / 评论 / 分析 | 按需配置 Pliny 兼容服务商 |

站点标题、语言列表、分析 ID、搜索等配置见 [`data/siteMetadata.js`](data/siteMetadata.js)。

## 管理后台

| 路径 | 功能 |
| --- | --- |
| `/admin` | 文章列表（含草稿） |
| `/admin/posts/new` | 新建文章（Markdown 编辑器） |
| `/admin/posts/[id]` | 编辑文章、触发翻译 |
| `/admin/media` | R2 媒体浏览与管理 |
| `/admin/settings` | OpenRouter / 翻译运行时配置 |
| `/admin/login` | 登录 |

会话使用 HTTP-only Cookie（`blog_admin_session`，有效期 7 天）。

## 常用脚本

```bash
yarn dev              # 开发服务器
yarn build            # 生产构建
yarn serve            # 启动生产构建
yarn seed             # 从 data/blog/*.mdx 导入 MongoDB
yarn translate:ui     # 通过 OpenRouter 翻译 UI 文案 JSON
yarn lint             # ESLint
yarn analyze          # 包体积分析
```

## Docker / Railway

```bash
docker build -t qblog .
docker run --rm -p 3000:3000 --env-file .env.local qblog
```

Railway 使用根目录 Dockerfile（见 `railway.toml`）。健康检查路径：`/api/health/`。密钥请作为运行时环境变量注入，不要写进镜像。

更多说明见 [`faq/deploy-with-docker.md`](faq/deploy-with-docker.md)。

## 目录结构

```
app/           # App Router — 公开 [locale] 路由、/admin、/api
components/    # UI、MDX 组件、管理端组件
data/          # siteMetadata、导航、作者、示例 MDX
i18n/          # 语言列表、路由与请求配置
lib/           # MongoDB、文章、鉴权、R2、OpenRouter、翻译
layouts/       # 文章与列表布局
messages/      # 各语言 UI 文案
scripts/       # 种子数据、翻译、RSS 等脚本
```

## 许可证

MIT。基于 [tailwind-nextjs-starter-blog](https://github.com/timlrx/tailwind-nextjs-starter-blog) 发展而来；QBlog 增加了 MongoDB CMS、管理后台、国际化、AI 翻译与 R2 媒体能力。
