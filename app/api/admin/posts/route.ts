import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createPost, getAllPosts } from '@/lib/posts'
import { ensurePostTranslation } from '@/lib/translate-post'
import type { PostInput, PostListItem } from '@/lib/types'

function parsePostInput(body: Record<string, unknown>): PostInput {
  const tagsRaw = body.tags
  const tags =
    typeof tagsRaw === 'string'
      ? tagsRaw
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : Array.isArray(tagsRaw)
        ? tagsRaw.map(String)
        : []

  const imagesRaw = body.images
  const images =
    typeof imagesRaw === 'string'
      ? imagesRaw
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : Array.isArray(imagesRaw)
        ? imagesRaw.map(String)
        : []

  return {
    title: String(body.title || ''),
    slug: String(body.slug || ''),
    date: String(body.date || new Date().toISOString()),
    lastmod: body.lastmod ? String(body.lastmod) : undefined,
    tags,
    draft: Boolean(body.draft),
    summary: body.summary ? String(body.summary) : undefined,
    images,
    authors: Array.isArray(body.authors) ? body.authors.map(String) : ['default'],
    layout: body.layout ? String(body.layout) : undefined,
    youtube: body.youtube ? String(body.youtube) : undefined,
    body: String(body.body || ''),
    locale: body.locale === 'en' ? 'en' : 'zh-CN',
    translationKey: body.translationKey ? String(body.translationKey) : undefined,
    sourceLocale:
      body.sourceLocale === 'en' || body.sourceLocale === 'zh-CN'
        ? body.sourceLocale
        : body.locale === 'en'
          ? 'en'
          : 'zh-CN',
  }
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const posts = await getAllPosts({ includeDrafts: true })
  return NextResponse.json({ posts })
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const input = parsePostInput(body)
    if (!input.title || !input.slug) {
      return NextResponse.json({ error: 'title and slug are required' }, { status: 400 })
    }
    if (!input.translationKey) {
      input.translationKey = input.slug
    }
    if (!input.sourceLocale) {
      input.sourceLocale = input.locale
    }
    const post = await createPost(input)

    let translation: PostListItem | null = null
    let translationError: string | undefined
    try {
      if (post._id) {
        const result = await ensurePostTranslation(post._id)
        translation = result?.translation || null
      }
    } catch (error) {
      translationError = error instanceof Error ? error.message : 'Translation failed'
      console.error('[translate]', translationError)
    }

    return NextResponse.json({ post, translation, translationError }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Create failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
