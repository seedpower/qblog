'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { MediaFolder, MediaKind, MediaObject } from '@/lib/r2'

type ListResponse = {
  prefix: string
  folders: MediaFolder[]
  objects: MediaObject[]
  publicBaseUrl: string
  error?: string
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function kindLabel(kind: MediaKind) {
  if (kind === 'image') return 'Image'
  if (kind === 'audio') return 'Audio'
  if (kind === 'video') return 'Video'
  return 'File'
}

const btnPrimary =
  'rounded-full bg-gradient-to-b from-[#3d9dff] via-primary-500 to-[#0a76e6] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(10,132,255,0.35)] transition hover:-translate-y-0.5 disabled:opacity-60'
const btnGlass =
  'glass glass-pill px-3 py-1.5 text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] disabled:opacity-60'

export default function AdminMediaManager() {
  const [prefix, setPrefix] = useState('')
  const [folders, setFolders] = useState<MediaFolder[]>([])
  const [objects, setObjects] = useState<MediaObject[]>([])
  const [publicBaseUrl, setPublicBaseUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const crumbs = useMemo(() => {
    const parts = prefix.split('/').filter(Boolean)
    const items: { label: string; prefix: string }[] = [{ label: 'Root', prefix: '' }]
    let acc = ''
    for (const part of parts) {
      acc += `${part}/`
      items.push({ label: part, prefix: acc })
    }
    return items
  }, [prefix])

  const load = useCallback(async (nextPrefix = prefix) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/media/?prefix=${encodeURIComponent(nextPrefix)}`)
      const data = (await res.json()) as ListResponse
      if (!res.ok) throw new Error(data.error || 'Failed to load media')
      setPrefix(data.prefix || '')
      setFolders(data.folders || [])
      setObjects(data.objects || [])
      setPublicBaseUrl(data.publicBaseUrl || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load media')
      setFolders([])
      setObjects([])
    } finally {
      setLoading(false)
    }
  }, [prefix])

  useEffect(() => {
    void load('')
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setStatus(`${label} copied.`)
      window.setTimeout(() => setStatus(''), 2000)
    } catch {
      setStatus('Copy failed.')
    }
  }

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList)
    if (!files.length) return
    setUploading(true)
    setError('')
    setStatus(`Uploading ${files.length} file(s)…`)
    try {
      for (const file of files) {
        const form = new FormData()
        form.append('file', file)
        form.append('prefix', prefix)
        const res = await fetch('/api/admin/media/', { method: 'POST', body: form })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `Upload failed: ${file.name}`)
      }
      setStatus(`Uploaded ${files.length} file(s).`)
      await load(prefix)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function removeObject(key: string) {
    if (!confirm(`Delete ${key}?`)) return
    setError('')
    try {
      const res = await fetch(`/api/admin/media/?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setStatus('Deleted.')
      await load(prefix)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  function openFolder(next: string) {
    setPrefix(next)
    void load(next)
  }

  return (
    <div className="mx-auto w-full max-w-[96rem] px-2 py-6 sm:px-3 sm:py-8">
      <div className="glass glass-card mb-4 flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--ink)]">Media</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Manage R2 assets (images / audio / video). Public CDN:{' '}
            <span className="font-mono text-xs">{publicBaseUrl || 'https://static.seedpower.app'}</span>
          </p>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">
            Post images are stored as <code className="font-mono">blog/&#123;slug&#125;/filename</code>{' '}
            and referenced in posts by filename only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className={btnGlass}>
            Posts
          </Link>
          <button type="button" className={btnGlass} onClick={() => load(prefix)} disabled={loading}>
            Refresh
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*,audio/*,video/*,.svg,.pdf"
            onChange={(e) => {
              if (e.target.files) void uploadFiles(e.target.files)
            }}
          />
        </div>
      </div>

      <div className="glass glass-card mb-4 px-4 py-3 sm:px-5">
        <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Media path">
          {crumbs.map((crumb, index) => (
            <span key={crumb.prefix || 'root'} className="flex items-center gap-1">
              {index > 0 && <span className="text-[var(--ink-soft)]">/</span>}
              <button
                type="button"
                className="rounded-full px-2 py-0.5 text-[var(--ink)] transition hover:bg-white/50 dark:hover:bg-white/10"
                onClick={() => openFolder(crumb.prefix)}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </nav>
      </div>

      <div
        className={`glass glass-card mb-4 border-dashed px-4 py-8 text-center sm:px-5 ${
          dragOver ? 'border-primary-400 bg-primary-500/5' : ''
        }`}
        onDragEnter={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setDragOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files)
        }}
      >
        <p className="text-sm text-[var(--ink-soft)]">
          Drop files here to upload into{' '}
          <code className="font-mono text-xs">{prefix || '/'}</code>
        </p>
      </div>

      {(error || status) && (
        <p className={`mb-4 text-sm ${error ? 'text-red-600' : 'text-[var(--ink-soft)]'}`} role="status">
          {error || status}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-[var(--ink-soft)]">Loading…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {folders.map((folder) => (
            <button
              key={folder.prefix}
              type="button"
              onClick={() => openFolder(folder.prefix)}
              className="glass glass-card flex items-center gap-3 px-4 py-4 text-left transition hover:-translate-y-0.5"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/60 text-xs font-semibold tracking-wide text-[var(--ink-soft)] dark:bg-white/10">
                DIR
              </span>
              <span>
                <span className="block font-semibold text-[var(--ink)]">{folder.name}</span>
                <span className="text-xs text-[var(--ink-soft)]">Folder</span>
              </span>
            </button>
          ))}

          {objects.map((obj) => (
            <article
              key={obj.key}
              className="glass glass-card flex flex-col overflow-hidden"
            >
              <div className="flex h-40 items-center justify-center bg-black/5 dark:bg-white/5">
                {obj.kind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={obj.url} alt={obj.name} className="h-full w-full object-contain" />
                ) : obj.kind === 'video' ? (
                  // Admin preview only — source files may not include captions.
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video
                    src={obj.url}
                    className="h-full w-full object-contain"
                    controls
                    preload="metadata"
                  />
                ) : obj.kind === 'audio' ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <audio src={obj.url} controls className="w-full px-3" preload="metadata" />
                ) : (
                  <span className="text-sm text-[var(--ink-soft)]">{kindLabel(obj.kind)}</span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 px-3 py-3">
                <div>
                  <p className="truncate text-sm font-semibold text-[var(--ink)]" title={obj.name}>
                    {obj.name}
                  </p>
                  <p className="text-xs text-[var(--ink-soft)]">
                    {kindLabel(obj.kind)} · {formatBytes(obj.size)}
                  </p>
                  <p className="mt-1 truncate font-mono text-[10px] text-[var(--ink-soft)]" title={obj.key}>
                    {obj.key}
                  </p>
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btnGlass}
                    onClick={() => copyText('URL', obj.url)}
                  >
                    Copy URL
                  </button>
                  <button
                    type="button"
                    className={btnGlass}
                    onClick={() => copyText('Filename', obj.name)}
                  >
                    Copy name
                  </button>
                  <a
                    href={obj.url}
                    target="_blank"
                    rel="noreferrer"
                    className={btnGlass}
                  >
                    Open
                  </a>
                  <button
                    type="button"
                    className="glass glass-pill px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                    onClick={() => removeObject(obj.key)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}

          {!folders.length && !objects.length && (
            <p className="col-span-full py-10 text-center text-sm text-[var(--ink-soft)]">
              No files in this folder yet. Upload to create assets for a post path like{' '}
              <code className="font-mono">blog/your-slug/</code>.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
