import { NextRequest, NextResponse } from 'next/server'
import { getAllPosts } from '@/lib/posts'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const localeParam = request.nextUrl.searchParams.get('locale')
  const locale = localeParam === 'zh-CN' ? 'zh-CN' : 'en'
  const posts = await getAllPosts({ locale })
  const documents = posts.map((post) => ({
    title: post.title,
    date: post.date,
    summary: post.summary,
    tags: post.tags,
    slug: post.slug,
    path: post.path,
    locale: post.locale,
  }))
  return NextResponse.json(documents)
}
