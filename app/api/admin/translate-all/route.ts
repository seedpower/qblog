import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getAllPosts } from '@/lib/posts'
import { ensurePostTranslation } from '@/lib/translate-post'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Translate all source-locale posts that don't yet have a paired translation,
 * or re-translate all when ?force=1.
 */
export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const force = new URL(request.url).searchParams.get('force') === '1'
  const posts = await getAllPosts({ includeDrafts: true })

  // Prefer zh-CN as source when both exist; otherwise translate whichever is alone.
  const byKey = new Map<string, typeof posts>()
  for (const post of posts) {
    const key = post.translationKey || post.slug
    const list = byKey.get(key) || []
    list.push(post)
    byKey.set(key, list)
  }

  const results: Array<{ key: string; status: string; error?: string }> = []

  for (const [key, group] of byKey) {
    const hasZh = group.find((p) => p.locale === 'zh-CN')
    const hasEn = group.find((p) => p.locale === 'en')
    const source = hasZh || hasEn
    if (!source?._id) continue

    if (!force && hasZh && hasEn) {
      results.push({ key, status: 'skipped' })
      continue
    }

    try {
      await ensurePostTranslation(source._id)
      results.push({ key, status: 'translated' })
    } catch (error) {
      results.push({
        key,
        status: 'error',
        error: error instanceof Error ? error.message : 'failed',
      })
    }
  }

  return NextResponse.json({
    total: results.length,
    translated: results.filter((r) => r.status === 'translated').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed: results.filter((r) => r.status === 'error').length,
    results,
  })
}
