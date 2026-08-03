import { after, NextRequest, NextResponse } from 'next/server'
import { defaultLocale, normalizeAppLocale } from '@/i18n/locales'
import { requireAdmin } from '@/lib/auth'
import { deletePostFamily, getPostById, updatePost } from '@/lib/posts'
import { ensurePostTranslations } from '@/lib/translate-post'
import type { PostInput } from '@/lib/types'

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

  const locale = normalizeAppLocale(body.locale, defaultLocale)
  const sourceLocale = normalizeAppLocale(body.sourceLocale || body.locale, locale)

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
    locale,
    translationKey: body.translationKey ? String(body.translationKey) : undefined,
    sourceLocale,
  }
}

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await context.params
  const post = await getPostById(id)
  if (!post) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ post })
}

export async function PUT(request: NextRequest, context: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { id } = await context.params
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
    const post = await updatePost(id, input)
    if (!post) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    after(async () => {
      try {
        await ensurePostTranslations(id)
      } catch (error) {
        console.error(
          '[translate:background]',
          error instanceof Error ? error.message : 'Translation failed'
        )
      }
    })

    return NextResponse.json({ post, translating: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Update failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: Ctx) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await context.params
  const deleted = await deletePostFamily(id)
  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, deleted })
}
