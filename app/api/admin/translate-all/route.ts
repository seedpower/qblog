import { NextResponse } from 'next/server'
import { locales, pickSourceLocale } from '@/i18n/locales'
import { requireAdmin } from '@/lib/auth'
import { getAllPosts } from '@/lib/posts'
import { ensurePostTranslations } from '@/lib/translate-post'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Translate all source-locale posts into every missing configured locale,
 * or re-translate all targets when ?force=1.
 */
export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const force = new URL(request.url).searchParams.get('force') === '1'
  const posts = await getAllPosts({ includeDrafts: true })

  const byKey = new Map<string, typeof posts>()
  for (const post of posts) {
    const key = post.translationKey || post.slug
    const list = byKey.get(key) || []
    list.push(post)
    byKey.set(key, list)
  }

  const results: Array<{
    key: string
    status: string
    missing?: string[]
    error?: string
    errors?: Array<{ locale: string; error: string }>
  }> = []

  for (const [key, group] of byKey) {
    const sourceLocale = pickSourceLocale(group)
    const source = group.find((p) => p.locale === sourceLocale) || group[0]
    if (!source?._id) continue

    const present = new Set(group.map((p) => p.locale))
    const missing = locales.filter((l) => l !== source.locale && !present.has(l))

    if (!force && missing.length === 0) {
      results.push({ key, status: 'skipped' })
      continue
    }

    try {
      const result = await ensurePostTranslations(source._id, {
        force,
        targets: force ? locales.filter((l) => l !== source.locale) : missing,
      })
      if (result?.errors?.length) {
        results.push({
          key,
          status: 'partial',
          missing,
          errors: result.errors,
        })
      } else {
        results.push({ key, status: 'translated', missing })
      }
    } catch (error) {
      results.push({
        key,
        status: 'error',
        missing,
        error: error instanceof Error ? error.message : 'failed',
      })
    }
  }

  return NextResponse.json({
    total: results.length,
    translated: results.filter((r) => r.status === 'translated').length,
    partial: results.filter((r) => r.status === 'partial').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed: results.filter((r) => r.status === 'error').length,
    results,
  })
}
