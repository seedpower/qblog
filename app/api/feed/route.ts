import { NextRequest, NextResponse } from 'next/server'
import { escape } from 'pliny/utils/htmlEscaper.js'
import siteMetadata from '@/data/siteMetadata'
import { getAllPosts, getTagCounts } from '@/lib/posts'
import { slug } from 'github-slugger'

export const dynamic = 'force-dynamic'

function generateRssItem(post: {
  slug: string
  title: string
  summary?: string
  date: string
  tags: string[]
}) {
  return `
  <item>
    <guid>${siteMetadata.siteUrl}/blog/${post.slug}</guid>
    <title>${escape(post.title)}</title>
    <link>${siteMetadata.siteUrl}/blog/${post.slug}</link>
    ${post.summary ? `<description>${escape(post.summary)}</description>` : ''}
    <pubDate>${new Date(post.date).toUTCString()}</pubDate>
    <author>${siteMetadata.author}</author>
    ${post.tags.map((t) => `<category>${t}</category>`).join('')}
  </item>`
}

function generateRss(
  posts: { slug: string; title: string; summary?: string; date: string; tags: string[] }[],
  page = 'feed.xml'
) {
  const lastBuild = posts[0] ? new Date(posts[0].date).toUTCString() : new Date().toUTCString()
  return `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
    <channel>
      <title>${escape(siteMetadata.title)}</title>
      <link>${siteMetadata.siteUrl}/blog</link>
      <description>${escape(siteMetadata.description)}</description>
      <language>${siteMetadata.language}</language>
      <managingEditor>${siteMetadata.author}</managingEditor>
      <webMaster>${siteMetadata.author}</webMaster>
      <lastBuildDate>${lastBuild}</lastBuildDate>
      <atom:link href="${siteMetadata.siteUrl}/${page}" rel="self" type="application/rss+xml"/>
      ${posts.map((post) => generateRssItem(post)).join('')}
    </channel>
  </rss>`
}

export async function GET(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get('tag')
  const localeParam = request.nextUrl.searchParams.get('locale')
  const locale = localeParam === 'en' ? 'en' : 'zh-CN'
  const posts = await getAllPosts({ locale })
  const filtered = tag ? posts.filter((post) => post.tags.some((t) => slug(t) === tag)) : posts

  if (tag) {
    const counts = await getTagCounts({ locale })
    if (!counts[tag]) {
      return new NextResponse('Not found', { status: 404 })
    }
  }

  const xml = generateRss(filtered, tag ? `tags/${tag}/feed.xml` : 'feed.xml')
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
