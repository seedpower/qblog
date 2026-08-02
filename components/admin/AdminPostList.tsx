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
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Posts</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            One row per article. Translations are managed automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/posts/new"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            New post
          </Link>
          <button
            type="button"
            onClick={translateAll}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800"
          >
            Translate missing
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs tracking-wide text-gray-500 uppercase dark:bg-gray-800/80 dark:text-gray-400">
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
              <tr key={key} className="border-t border-gray-200 align-top dark:border-gray-800">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  {primary.title}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">
                  {primary.slug}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {locales.map((locale) => (
                      <span
                        key={locale}
                        className="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200"
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
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {new Date(primary.date).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/admin/posts/${primary._id}`}
                      className="text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/blog/${primary.slug}`}
                      className="text-gray-500 hover:underline"
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
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  No posts yet. Create one or run the seed script.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
