'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { PostListItem } from '@/lib/types'

export default function AdminPostList({ posts }: { posts: PostListItem[] }) {
  const router = useRouter()

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
    if (!confirm('Delete this post?')) return
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Posts</h1>
        <div className="flex gap-2">
          <Link
            href="/admin/posts/new"
            className="rounded bg-gray-900 px-4 py-2 text-sm text-white dark:bg-gray-100 dark:text-gray-900"
          >
            New post
          </Link>
          <button
            type="button"
            onClick={translateAll}
            className="rounded border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
          >
            Translate missing
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Locale</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr
                key={post._id || post.slug}
                className="border-t border-gray-200 dark:border-gray-700"
              >
                <td className="px-4 py-3">{post.title}</td>
                <td className="px-4 py-3 font-mono text-xs">{post.slug}</td>
                <td className="px-4 py-3">{post.locale || 'zh-CN'}</td>
                <td className="px-4 py-3">{post.draft ? 'Draft' : 'Published'}</td>
                <td className="px-4 py-3">{new Date(post.date).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <Link
                      href={`/admin/posts/${post._id}`}
                      className="text-primary-500 hover:underline"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="text-gray-500 hover:underline"
                      target="_blank"
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(post._id)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
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
