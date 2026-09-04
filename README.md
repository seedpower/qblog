# QBlog

[English](README.md) · [中文](README.zh-CN.md)

**QBlog** is a multilingual blogging platform built with Next.js. Posts live in MongoDB, media in Cloudflare R2, and an admin console covers writing, translation, and asset management.

Live site: [blog.seedpower.app](https://blog.seedpower.app)

## Highlights

- **MongoDB-backed posts** — create, edit, draft, and publish from `/admin` instead of committing Markdown for every change
- **19 locales** — UI and content via `next-intl`; default locale is English (`en`) with `as-needed` URL prefixes
- **AI translation** — OpenRouter can translate a source post into sibling locales (title, summary, body, tags)
- **Media library** — upload and organize images/audio/video on Cloudflare R2 with a public CDN URL
- **MDX rendering** — GFM, math, citations, Mermaid diagrams, syntax highlighting, TOC, and medium-zoom images
- **Search & SEO** — kbar search, sitemap, robots, Open Graph images, RSS feed, reading time
- **Deploy-ready** — Dockerfile (Node 22, standalone) and `railway.toml` with health checks

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4, next-themes |
| i18n | next-intl |
| Content | MongoDB + MDX (`next-mdx-remote`) |
| Admin auth | Password + JWT cookie (`jose`) |
| Media | Cloudflare R2 (S3 API) |
| AI | OpenRouter |
| Package manager | Yarn 3 (Berry) |

## Requirements

- Node.js **≥ 22**
- Yarn 3 (Corepack: `corepack enable`)
- MongoDB (local, Atlas, or Railway plugin)
- Optional: Cloudflare R2 credentials, OpenRouter API key

## Quick start

```bash
git clone https://github.com/seedpower/qblog.git
cd qblog
corepack enable
yarn install
cp .env.example .env.local
# Edit .env.local — at least MONGODB_URI, MONGODB_DB, ADMIN_PASSWORD, AUTH_SECRET
yarn seed          # optional: import sample MDX from data/blog into MongoDB
yarn dev
```

Open [http://localhost:3000](http://localhost:3000). Admin: [http://localhost:3000/admin](http://localhost:3000/admin).

## Environment variables

See [`.env.example`](.env.example) for the full list. Minimum for local use:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DB` | Database name (default `blog`) |
| `ADMIN_PASSWORD` | Password for `/admin` |
| `AUTH_SECRET` | Long random string for JWT sessions |

Optional:

| Variable | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` | Auto-translate posts (overridable in Admin → Settings) |
| `TRANSLATE_CONCURRENCY` | Parallel locale jobs (1–12, default 5) |
| `R2_*` / `R2_PUBLIC_BASE_URL` | Media manager + public asset URLs |
| Newsletter / comments / analytics | Pliny-compatible providers as needed |

Site title, locales, analytics IDs, and search config live in [`data/siteMetadata.js`](data/siteMetadata.js).

## Admin

| Path | Role |
| --- | --- |
| `/admin` | Post list (including drafts) |
| `/admin/posts/new` | Create post (MD editor) |
| `/admin/posts/[id]` | Edit post, trigger translation |
| `/admin/media` | R2 media browser |
| `/admin/settings` | Runtime OpenRouter / translation settings |
| `/admin/login` | Sign in |

Sessions use an HTTP-only cookie (`blog_admin_session`, 7-day TTL).

## Scripts

```bash
yarn dev              # development server
yarn build            # production build
yarn serve            # serve production build
yarn seed             # seed MongoDB from data/blog/*.mdx
yarn translate:ui     # translate UI message JSON via OpenRouter
yarn lint             # ESLint
yarn analyze          # bundle analyzer
```

## Docker / Railway

```bash
docker build -t qblog .
docker run --rm -p 3000:3000 --env-file .env.local qblog
```

Railway uses the root Dockerfile (`railway.toml`). Health check: `/api/health/`. Inject secrets as runtime env vars — do not bake them into the image.

More notes: [`faq/deploy-with-docker.md`](faq/deploy-with-docker.md).

## Project layout

```
app/           # App Router — public [locale] routes, /admin, /api
components/    # UI, MDX helpers, admin widgets
data/          # siteMetadata, nav, authors, sample MDX
i18n/          # locales, routing, request config
lib/           # MongoDB, posts, auth, R2, OpenRouter, translation
layouts/       # Post and list layouts
messages/      # next-intl UI strings per locale
scripts/       # seed, translate, RSS helpers
```

## License

MIT. Derived from [tailwind-nextjs-starter-blog](https://github.com/timlrx/tailwind-nextjs-starter-blog); QBlog adds MongoDB CMS, admin, i18n, AI translation, and R2 media.
