import { NextRequest, NextResponse } from 'next/server'
import { defaultLocale, normalizeAppLocale } from '@/i18n/locales'
import { getAllPosts } from '@/lib/posts'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const localeParam = request.nextUrl.searchParams.get('locale')
  const locale = normalizeAppLocale(localeParam, defaultLocale)
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
