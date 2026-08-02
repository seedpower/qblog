'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { PostDetail } from '@/lib/types'
import AdminMarkdownEditor from '@/components/admin/AdminMarkdownEditor'
import { generateTitleCoverFile } from '@/utils/generateTitleCover'
import { resolveBlogImageSrc } from '@/utils/resolveBlogImageSrc'

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

const fieldClass =
  'glass-strong mt-1 w-full rounded-2xl border border-[var(--glass-stroke)] bg-[var(--control-fill)] px-3 py-2.5 text-[var(--ink)] outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-500/30'
const labelClass = 'block text-sm font-medium text-[var(--ink-soft)]'

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
  const [saving, setSaving] = useState<'publish' | 'draft' | null>(null)
  const [copyStatus, setCopyStatus] = useState('')
  const [editorMeta, setEditorMeta] = useState('0 chars · Markdown')
  const [editorStatus, setEditorStatus] = useState<{ message: string; kind: 'ok' | 'error' | '' }>({
    message: '',
    kind: '',
  })
  const [coverBusy, setCoverBusy] = useState(false)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('')
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

  const uploadPrefix = useMemo(() => {
    const clean = (form.slug || titleHint || '').replace(/^\/+|\/+$/g, '').replace(/\\/g, '/')
    return clean ? `blog/${clean}/` : ''
  }, [form.slug, titleHint])

  const coverSrc = useMemo(() => {
    if (coverPreviewUrl) return coverPreviewUrl
    const first = form.images
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)[0]
    if (!first) return ''
    const blogPath = uploadPrefix.replace(/\/$/, '')
    return resolveBlogImageSrc(first, blogPath) || first
  }, [coverPreviewUrl, form.images, uploadPrefix])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function generateCover() {
    const title = form.title.trim()
    if (!title) {
      setError('Add a title before generating a cover')
      return
    }
    if (!uploadPrefix) {
      setError('Set a slug (or title) before generating a cover')
      return
    }

    setCoverBusy(true)
    setError('')
    try {
      const file = await generateTitleCoverFile({ title }, 'cover.png')
      const body = new FormData()
      body.append('file', file)
      body.append('prefix', uploadPrefix)
      body.append('filename', 'cover.png')

      const res = await fetch('/api/admin/media/', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Cover upload failed')

      const preview =
        typeof data.url === 'string' && data.url
          ? data.url
          : URL.createObjectURL(file)
      setCoverPreviewUrl((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
        return preview
      })

      setForm((prev) => {
        const list = prev.images
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((name) => name !== 'cover.png')
        return { ...prev, images: ['cover.png', ...list].join(', ') }
      })
      setEditorStatus({ message: 'Cover uploaded (overwrote cover.png on R2)', kind: 'ok' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cover generation failed')
    } finally {
      setCoverBusy(false)
    }
  }

  async function copyBody() {
    const body = form.body.trim()
    if (!body) {
      setCopyStatus('Nothing to copy.')
      return
    }
    try {
      await navigator.clipboard.writeText(body)
      setCopyStatus('Copied.')
      window.setTimeout(() => setCopyStatus(''), 2000)
    } catch {
      setCopyStatus('Copy failed.')
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const asDraft = submitter?.value !== 'publish'
    if (!form.body.trim()) {
      setError('Body is required')
      return
    }
    setSaving(asDraft ? 'draft' : 'publish')
    setError('')
    try {
      const payload = {
        title: form.title,
        slug: form.slug || titleHint,
        date: new Date(form.date).toISOString(),
        tags: form.tags,
        draft: asDraft,
        summary: form.summary,
        images: form.images,
        youtube: form.youtube || undefined,
        layout: form.layout || undefined,
        body: form.body,
        authors: ['default'],
        locale: form.locale,
        sourceLocale: form.locale,
      }
      const res = await fetch(isEdit ? `/api/admin/posts/${postId}/` : '/api/admin/posts/', {
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
      setSaving(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[96rem] px-2 py-6 sm:px-3 sm:py-8">
      <div className="glass glass-card mb-4 flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--ink)]">
          {isEdit ? 'Edit post' : 'New post'}
        </h1>
        <Link
          href="/admin"
          className="glass glass-pill px-3 py-1.5 text-sm text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
        >
          Back to list
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(280px,22rem)_minmax(0,1fr)] lg:items-stretch lg:gap-4">
          <aside className="glass space-y-4 rounded-[var(--radius-glass)] px-3 py-5 sm:px-4">
            <label className={labelClass}>
              Title
              <input
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                className={fieldClass}
                required
              />
            </label>

            <label className={labelClass}>
              Slug
              <input
                value={form.slug}
                onChange={(e) => update('slug', e.target.value)}
                placeholder={titleHint || 'ai-tools/my-post'}
                className={`${fieldClass} font-mono text-sm`}
                required={!titleHint}
              />
            </label>

            <label className={labelClass}>
              Date
              <input
                type="date"
                value={form.date}
                onChange={(e) => update('date', e.target.value)}
                className={fieldClass}
                required
              />
            </label>

            <label className={labelClass}>
              Source language
              <select
                value={form.locale}
                onChange={(e) => update('locale', e.target.value as 'zh-CN' | 'en')}
                className={fieldClass}
              >
                <option value="zh-CN">中文 (zh-CN)</option>
                <option value="en">English (en)</option>
              </select>
              <span className="mt-1 block text-xs text-[var(--ink-soft)]">
                Authors usually write in Chinese. Saving auto-translates the other locale via
                OpenRouter.
              </span>
            </label>

            <label className={labelClass}>
              Layout
              <select
                value={form.layout}
                onChange={(e) => update('layout', e.target.value)}
                className={fieldClass}
              >
                <option value="PostSimple">PostSimple</option>
                <option value="PostLayout">PostLayout</option>
                <option value="PostBanner">PostBanner</option>
              </select>
            </label>

            <label className={labelClass}>
              Tags (comma separated)
              <input
                value={form.tags}
                onChange={(e) => update('tags', e.target.value)}
                className={fieldClass}
              />
            </label>

            <label className={labelClass}>
              Summary
              <textarea
                value={form.summary}
                onChange={(e) => update('summary', e.target.value)}
                rows={4}
                className={fieldClass}
              />
            </label>

            <div>
              <div className="flex items-center justify-between gap-2">
                <span className={labelClass}>Images (comma separated)</span>
                <button
                  type="button"
                  onClick={() => void generateCover()}
                  disabled={coverBusy || !form.title.trim()}
                  className="glass glass-pill px-3 py-1 text-xs font-semibold text-[var(--ink-soft)] transition hover:text-[var(--ink)] disabled:opacity-50"
                >
                  {coverBusy ? 'Generating…' : 'Generate cover'}
                </button>
              </div>
              <input
                value={form.images}
                onChange={(e) => update('images', e.target.value)}
                className={fieldClass}
                placeholder="cover.png, gallery-1.jpg"
              />
              <p className="mt-1 text-xs text-[var(--ink-soft)]">
                First image is the cover. Generate cover draws the title onto a 1200×630 PNG (no AI).
              </p>
              {coverSrc ? (
                // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                <img
                  src={coverSrc}
                  alt=""
                  className="mt-2 aspect-[1200/630] w-full rounded-2xl border border-[var(--glass-stroke)] object-cover"
                />
              ) : null}
            </div>

            <label className={labelClass}>
              YouTube URL
              <input
                value={form.youtube}
                onChange={(e) => update('youtube', e.target.value)}
                className={fieldClass}
              />
            </label>
          </aside>

          <section className="glass min-w-0 rounded-[var(--radius-glass)] px-2 pt-4 pb-2 sm:px-3">
            <AdminMarkdownEditor
              value={form.body}
              onChange={(body) => update('body', body)}
              title={form.title}
              locale={form.locale}
              slug={form.slug || titleHint}
              onMetaChange={setEditorMeta}
              onStatusChange={setEditorStatus}
              onFileUploaded={(filename, kind) => {
                if (kind !== 'image') return
                setForm((prev) => {
                  const list = prev.images
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                  if (list.includes(filename)) return prev
                  return { ...prev, images: [...list, filename].join(', ') }
                })
              }}
            />
          </section>
        </div>

        <div className="glass flex flex-wrap items-center justify-end gap-3 rounded-[var(--radius-glass)] px-3 py-3 sm:px-4">
          <div className="mr-auto flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {error && <p className="w-full text-sm text-red-600 sm:w-auto">{error}</p>}
            <span className="text-xs font-medium text-[var(--ink-soft)]">
              {form.draft ? 'Current: Draft' : 'Current: Published'}
            </span>
            <span className="font-mono text-xs text-[var(--ink-soft)]">{editorMeta}</span>
            {editorStatus.message ? (
              <p
                className={`admin-md-status m-0${editorStatus.kind ? ` ${editorStatus.kind}` : ''}`}
                role="status"
              >
                {editorStatus.message}
              </p>
            ) : null}
            {copyStatus && (
              <span className="text-xs text-[var(--ink-soft)]" role="status">
                {copyStatus}
              </span>
            )}
          </div>
          <button
            type="submit"
            name="intent"
            value="publish"
            disabled={saving !== null}
            className="via-primary-500 rounded-full bg-gradient-to-b from-[#3d9dff] to-[#0a76e6] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(10,132,255,0.35)] transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {saving === 'publish' ? 'Publishing…' : 'Publish'}
          </button>
          <button
            type="submit"
            name="intent"
            value="draft"
            disabled={saving !== null}
            className="glass glass-pill px-5 py-2.5 text-sm font-semibold text-[var(--ink-soft)] transition hover:text-[var(--ink)] disabled:opacity-60"
          >
            {saving === 'draft' ? 'Saving…' : 'Save as Draft'}
          </button>
          <button
            type="button"
            onClick={copyBody}
            className="glass glass-pill px-5 py-2.5 text-sm font-semibold text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
          >
            Copy
          </button>
          <Link
            href="/admin"
            className="glass glass-pill px-5 py-2.5 text-sm font-semibold text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
