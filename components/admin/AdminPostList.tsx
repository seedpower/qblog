'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { PostListItem, PostLocale } from '@/lib/types'

type PostGroup = {
  key: string
  primary: PostListItem
  locales: PostLocale[]
}

function groupPosts(posts: PostListItem[]): PostGroup[] {
  const map = new Map<string, PostListItem[]>()
  for (const post of posts) {
    const key = post.translationKey || post.slug
    const list = map.get(key) || []
    list.push(post)
    map.set(key, list)
  }

  return Array.from(map.entries())
    .map(([key, group]) => {
      const sourceLocale =
        group.find((p) => p.sourceLocale)?.sourceLocale ||
        group.find((p) => p.locale === 'zh-CN')?.locale ||
        group[0]?.locale ||
        'zh-CN'
      const primary =
        group.find((p) => p.locale === sourceLocale) ||
        group.find((p) => p.locale === 'zh-CN') ||
        group[0]
      const locales = Array.from(new Set(group.map((p) => p.locale))).sort() as PostLocale[]
      return { key, primary, locales }
    })
    .sort((a, b) => +new Date(b.primary.date) - +new Date(a.primary.date))
}

const btnPrimary =
  'rounded-full bg-gradient-to-b from-[#3d9dff] via-primary-500 to-[#0a76e6] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(10,132,255,0.35)] transition hover:-translate-y-0.5'
const btnGlass =
  'glass glass-pill px-4 py-2 text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] hover:-translate-y-0.5'

export default function AdminPostList({ posts }: { posts: PostListItem[] }) {
  const router = useRouter()
  const groups = useMemo(() => groupPosts(posts), [posts])

  async function logout() {
    await fetch('/api/admin/login', { method: 'DELETE' })
    router.replace('/admin/login')
    router.refresh()
  }

  async function translateAll() {
    if (
      !confirm('Auto-translate all posts missing a pair via OpenRouter? This may take a while.')
    ) {
      return
    }
    const res = await fetch('/api/admin/translate-all', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error || 'Translate failed')
      return
    }
    alert(`Done. translated=${data.translated}, skipped=${data.skipped}, failed=${data.failed}`)
    router.refresh()
  }

  async function remove(id?: string) {
    if (!id) return
    if (!confirm('Delete this post and all its translations?')) return
    const res = await fetch(`/api/admin/posts/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      alert(data.error || 'Delete failed')
      return
    }
    router.refresh()
  }

  return (
    <div className="mx-auto w-full max-w-[96rem] px-2 py-6 sm:px-3 sm:py-8">
      <div className="glass glass-card mb-4 flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--ink)]">Posts</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            One row per article. Translations are managed automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/posts/new" className={btnPrimary}>
            New post
          </Link>
          <button type="button" onClick={translateAll} className={btnGlass}>
            Translate missing
          </button>
          <button type="button" onClick={logout} className={btnGlass}>
            Logout
          </button>
        </div>
      </div>

      <div className="glass glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/40 text-xs tracking-wide text-[var(--ink-soft)] uppercase dark:border-white/10">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Languages</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(({ key, primary, locales }) => (
                <tr
                  key={key}
                  className="border-t border-white/35 align-top transition hover:bg-white/35 dark:border-white/10 dark:hover:bg-white/5"
                >
                  <td className="px-4 py-3 font-medium text-[var(--ink)]">{primary.title}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--ink-soft)]">
                    {primary.slug}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {locales.map((locale) => (
                        <span
                          key={locale}
                          className="glass glass-pill inline-flex px-2 py-0.5 text-xs font-medium text-[var(--ink-soft)]"
                        >
                          {locale}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        primary.draft
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }
                    >
                      {primary.draft ? 'Draft' : 'Published'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--ink-soft)]">
                    {new Date(primary.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-3">
                      <Link
                        href={`/admin/posts/${primary._id}`}
                        className="text-primary-600 dark:text-primary-400 font-medium hover:underline"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/blog/${primary.slug}`}
                        className="text-[var(--ink-soft)] hover:underline"
                        target="_blank"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => remove(primary._id)}
                        className="text-red-600 hover:underline dark:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {groups.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[var(--ink-soft)]">
                    No posts yet. Create one or run the seed script.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
