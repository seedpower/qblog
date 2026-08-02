'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { PostDetail } from '@/lib/types'

type FormState = {
  title: string
  slug: string
  date: string
  tags: string
  draft: boolean
  summary: string
  images: string
  youtube: string
  layout: string
  body: string
  locale: 'zh-CN' | 'en'
}

function toDateInput(value?: string) {
  if (!value) return new Date().toISOString().slice(0, 10)
  return new Date(value).toISOString().slice(0, 10)
}

function initialState(post?: PostDetail | null): FormState {
  return {
    title: post?.title || '',
    slug: post?.slug || '',
    date: toDateInput(post?.date),
    tags: (post?.tags || []).join(', '),
    draft: post?.draft ?? true,
    summary: post?.summary || '',
    images: (post?.images || []).join(', '),
    youtube: post?.youtube || '',
    layout: post?.layout || 'PostSimple',
    body: post?.body || '',
    locale: post?.locale || 'zh-CN',
  }
}

export default function AdminPostEditor({
  postId,
  initialPost,
}: {
  postId?: string
  initialPost?: PostDetail | null
}) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(() => initialState(initialPost))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const isEdit = Boolean(postId)

  const titleHint = useMemo(() => {
    if (form.slug || !form.title) return ''
    return form.title
      .trim()
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff/-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }, [form.slug, form.title])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        title: form.title,
        slug: form.slug || titleHint,
        date: new Date(form.date).toISOString(),
        tags: form.tags,
        draft: form.draft,
        summary: form.summary,
        images: form.images,
        youtube: form.youtube || undefined,
        layout: form.layout || undefined,
        body: form.body,
        authors: ['default'],
        locale: form.locale,
        sourceLocale: form.locale,
      }
      const res = await fetch(isEdit ? `/api/admin/posts/${postId}` : '/api/admin/posts', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Save failed')
        return
      }
      if (data.translationError) {
        setError(`Saved, but translation failed: ${data.translationError}`)
        return
      }
      router.replace('/admin')
      router.refresh()
    } catch {
      setError('Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {isEdit ? 'Edit post' : 'New post'}
        </h1>
        <Link href="/admin" className="text-sm text-gray-500 hover:underline">
          Back to list
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm">
          Title
          <input
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
            required
          />
        </label>

        <label className="block text-sm">
          Slug
          <input
            value={form.slug}
            onChange={(e) => update('slug', e.target.value)}
            placeholder={titleHint || 'ai-tools/my-post'}
            className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-900"
            required={!titleHint}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            Date
            <input
              type="date"
              value={form.date}
              onChange={(e) => update('date', e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
              required
            />
          </label>
          <label className="block text-sm">
            Source language
            <select
              value={form.locale}
              onChange={(e) => update('locale', e.target.value as 'zh-CN' | 'en')}
              className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
            >
              <option value="zh-CN">中文 (zh-CN)</option>
              <option value="en">English (en)</option>
            </select>
            <span className="mt-1 block text-xs text-gray-500">
              Saving auto-translates to the other language via OpenRouter.
            </span>
          </label>
        </div>

        <label className="block text-sm">
          Layout
          <select
            value={form.layout}
            onChange={(e) => update('layout', e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
          >
            <option value="PostSimple">PostSimple</option>
            <option value="PostLayout">PostLayout</option>
            <option value="PostBanner">PostBanner</option>
          </select>
        </label>

        <label className="block text-sm">
          Tags (comma separated)
          <input
            value={form.tags}
            onChange={(e) => update('tags', e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
          />
        </label>

        <label className="block text-sm">
          Summary
          <textarea
            value={form.summary}
            onChange={(e) => update('summary', e.target.value)}
            rows={3}
            className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
          />
        </label>

        <label className="block text-sm">
          Images (comma separated paths/URLs)
          <input
            value={form.images}
            onChange={(e) => update('images', e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
          />
        </label>

        <label className="block text-sm">
          YouTube URL
          <input
            value={form.youtube}
            onChange={(e) => update('youtube', e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.draft}
            onChange={(e) => update('draft', e.target.checked)}
          />
          Draft (unpublished)
        </label>

        <label className="block text-sm">
          Body (MDX)
          <textarea
            value={form.body}
            onChange={(e) => update('body', e.target.value)}
            rows={24}
            className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-900"
            required
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-gray-900 px-5 py-2 text-white disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900"
        >
          {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
        </button>
      </form>
    </div>
  )
}
