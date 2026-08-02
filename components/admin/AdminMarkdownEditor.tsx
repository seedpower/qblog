'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { resolveBlogImageSrc } from '@/utils/resolveBlogImageSrc'
import '@/css/admin-markdown-editor.css'
import '@uiw/react-md-editor/markdown-editor.css'

const MDEditor = dynamic(() => import('@uiw/react-md-editor').then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div className="admin-md-loading">Loading markdown editor…</div>
  ),
})

type BodyEditAction =
  | 'polish'
  | 'shorten'
  | 'expand'
  | 'casual'
  | 'professional'
  | 'continue'
  | 'custom'

type SelectionSnap = {
  text: string
  start: number
  end: number
}

type PendingEdit = {
  beforeValue: string
  start: number
  end: number
}

const BUBBLE_ACTIONS: { action: BodyEditAction; label: string }[] = [
  { action: 'polish', label: '润色' },
  { action: 'shorten', label: '精简' },
  { action: 'expand', label: '扩写' },
  { action: 'casual', label: '更口语' },
  { action: 'professional', label: '更专业' },
  { action: 'continue', label: '续写' },
]

function getTextarea(root: HTMLElement | null): HTMLTextAreaElement | null {
  return root?.querySelector('textarea') ?? null
}

/** Map a textarea caret index to viewport coordinates via a mirror element. */
function getTextareaCaretPoint(textarea: HTMLTextAreaElement, position: number) {
  const style = window.getComputedStyle(textarea)
  const mirror = document.createElement('div')
  const props = [
    'boxSizing',
    'width',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'fontFamily',
    'lineHeight',
    'letterSpacing',
    'textTransform',
    'textAlign',
    'textIndent',
    'whiteSpace',
    'wordBreak',
    'overflowWrap',
    'tabSize',
  ] as const

  mirror.setAttribute('aria-hidden', 'true')
  Object.assign(mirror.style, {
    position: 'absolute',
    visibility: 'hidden',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    overflow: 'hidden',
    top: '0',
    left: '-99999px',
    height: 'auto',
  })
  for (const prop of props) {
    mirror.style[prop] = style[prop]
  }
  mirror.style.width = `${textarea.clientWidth}px`

  const before = textarea.value.slice(0, position)
  mirror.textContent = before
  const marker = document.createElement('span')
  marker.textContent = '\u200b'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)

  const markerRect = marker.getBoundingClientRect()
  const mirrorRect = mirror.getBoundingClientRect()
  const taRect = textarea.getBoundingClientRect()
  const lineHeight =
    markerRect.height || Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) || 21

  const top =
    taRect.top +
    (markerRect.top - mirrorRect.top) -
    textarea.scrollTop +
    Number.parseFloat(style.borderTopWidth || '0')
  const left =
    taRect.left +
    (markerRect.left - mirrorRect.left) -
    textarea.scrollLeft +
    Number.parseFloat(style.borderLeftWidth || '0')

  document.body.removeChild(mirror)
  return { top, left, height: lineHeight }
}

function getSelectionBounds(textarea: HTMLTextAreaElement, start: number, end: number) {
  const from = getTextareaCaretPoint(textarea, start)
  const to = getTextareaCaretPoint(textarea, Math.max(start, end))
  const taRect = textarea.getBoundingClientRect()
  const top = Math.min(from.top, to.top)
  const bottom = Math.max(from.top + from.height, to.top + to.height)
  const left = Math.min(from.left, to.left)
  const right = Math.max(from.left, to.left)
  // Clamp to visible textarea so scrolled-away selection doesn't float off-screen.
  return {
    top: Math.max(top, taRect.top),
    bottom: Math.min(bottom, taRect.bottom),
    left: Math.max(left, taRect.left),
    right: Math.min(Math.max(right, left + 8), taRect.right),
    midX: (Math.max(left, taRect.left) + Math.min(Math.max(right, left + 8), taRect.right)) / 2,
  }
}

function safeUploadFilename(file: File) {
  const raw = file.name || `file-${Date.now()}`
  const cleaned = raw
    .normalize('NFKC')
    .replace(/[^\w.\u4e00-\u9fff-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return cleaned || `file-${Date.now()}`
}

function fileKindFromName(name: string, mime = ''): 'image' | 'audio' | 'video' | 'other' {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (
    mime.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico', 'bmp'].includes(ext)
  ) {
    return 'image'
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
    return 'audio'
  }
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv'].includes(ext)) {
    return 'video'
  }
  return 'other'
}

/** Images keep bare filenames (resolved via blogPath). Other files use public CDN URLs. */
function markdownForUploadedFile(name: string, url: string, kind: string) {
  const label = name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') || name
  if (kind === 'image') return `![${label}](${name})`
  if (kind === 'video') return `<video controls src="${url}"></video>`
  if (kind === 'audio') return `<audio controls src="${url}"></audio>`
  return `[${name}](${url})`
}

export default function AdminMarkdownEditor({
  value,
  onChange,
  title,
  locale = 'zh-CN',
  slug,
  onFileUploaded,
  onMetaChange,
  onStatusChange,
}: {
  value: string
  onChange: (value: string) => void
  title?: string
  locale?: 'zh-CN' | 'en'
  /** Post slug used as R2 folder: blog/{slug}/ */
  slug?: string
  /** Called after a successful upload (bare filename + kind) */
  onFileUploaded?: (filename: string, kind: 'image' | 'audio' | 'video' | 'other') => void
  onMetaChange?: (meta: string) => void
  onStatusChange?: (status: { message: string; kind: 'ok' | 'error' | '' }) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const valueRef = useRef(value)
  const onFileUploadedRef = useRef(onFileUploaded)
  const onMetaChangeRef = useRef(onMetaChange)
  const onStatusChangeRef = useRef(onStatusChange)
  const pendingRef = useRef<PendingEdit | null>(null)
  const bubbleSelectionRef = useRef<SelectionSnap | null>(null)
  const bubbleTimerRef = useRef(0)
  const pointerDownRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const manageUploadRef = useRef<HTMLInputElement>(null)
  const caretRef = useRef<{ start: number; end: number } | null>(null)

  const [mounted, setMounted] = useState(false)
  const [bubbleVisible, setBubbleVisible] = useState(false)
  const [bubbleStyle, setBubbleStyle] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const [reviewVisible, setReviewVisible] = useState(false)
  const [reviewStyle, setReviewStyle] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const [highlightRange, setHighlightRange] = useState<{ start: number; end: number } | null>(null)
  const [mediaBusy, setMediaBusy] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerItems, setPickerItems] = useState<
    { key: string; name: string; url: string; kind: string }[]
  >([])
  const [pickerLoading, setPickerLoading] = useState(false)

  const instructionRef = useRef<HTMLInputElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const reviewRef = useRef<HTMLDivElement>(null)

  onChangeRef.current = onChange
  valueRef.current = value
  onFileUploadedRef.current = onFileUploaded
  onMetaChangeRef.current = onMetaChange
  onStatusChangeRef.current = onStatusChange

  const uploadPrefix = useMemo(() => {
    const clean = (slug || '').replace(/^\/+|\/+$/g, '').replace(/\\/g, '/')
    return clean ? `blog/${clean}/` : ''
  }, [slug])

  const blogPath = useMemo(() => uploadPrefix.replace(/\/$/, ''), [uploadPrefix])

  const previewOptions = useMemo(
    () => ({
      rehypeRewrite: (node: {
        type?: string
        tagName?: string
        properties?: Record<string, unknown>
      }) => {
        if (!blogPath || node.type !== 'element' || !node.properties) return
        const tag = node.tagName
        const rewrite = (attr: 'src' | 'href') => {
          const raw = node.properties?.[attr]
          if (typeof raw !== 'string' || !raw) return
          const resolved = resolveBlogImageSrc(raw, blogPath)
          if (resolved && resolved !== raw) {
            node.properties![attr] = resolved
          }
        }
        if (tag === 'img' || tag === 'video' || tag === 'audio' || tag === 'source') {
          rewrite('src')
        }
        if (tag === 'a') rewrite('href')
      },
    }),
    [blogPath]
  )

  const setEditorStatus = useCallback((message: string, kind: 'ok' | 'error' | '' = '') => {
    onStatusChangeRef.current?.({ message, kind })
  }, [])

  const getSelection = useCallback((): SelectionSnap => {
    const ta = getTextarea(wrapRef.current)
    if (!ta) return { text: '', start: 0, end: 0 }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    if (start === end) return { text: '', start, end }
    return {
      text: ta.value.slice(start, end),
      start,
      end,
    }
  }, [])

  const updateMeta = useCallback(
    (body = value) => {
      const selected = getSelection().text.length
      const next = selected
        ? `${body.length} chars · selected ${selected} · Markdown`
        : `${body.length} chars · Markdown`
      onMetaChangeRef.current?.(next)
    },
    [getSelection, value]
  )

  const hideBubble = useCallback(() => {
    setBubbleVisible(false)
  }, [])

  const hideReview = useCallback(() => {
    setReviewVisible(false)
  }, [])

  const positionReview = useCallback(() => {
    const pending = pendingRef.current
    const root = wrapRef.current
    if (!pending || !root) {
      hideReview()
      return
    }

    const rect = root.getBoundingClientRect()
    const w = reviewRef.current?.offsetWidth || 280
    const h = reviewRef.current?.offsetHeight || 40
    const pad = 8

    let left = rect.left + (rect.width - w) / 2
    left = Math.max(pad, Math.min(left, window.innerWidth - w - pad))

    let top = rect.top - h - 10
    if (top < pad) top = Math.min(rect.bottom + 10, window.innerHeight - h - pad)

    setReviewStyle({ left: Math.round(left), top: Math.round(top) })
    setReviewVisible(true)
  }, [hideReview])

  const dismissPending = useCallback(
    (restore = false) => {
      const pending = pendingRef.current
      if (!pending) {
        hideReview()
        setHighlightRange(null)
        return
      }
      if (restore) {
        onChangeRef.current(pending.beforeValue)
        updateMeta(pending.beforeValue)
      } else {
        updateMeta()
      }
      pendingRef.current = null
      setHighlightRange(null)
      hideReview()
    },
    [hideReview, updateMeta]
  )

  const acceptPending = useCallback(() => {
    if (!pendingRef.current) return
    pendingRef.current = null
    setHighlightRange(null)
    hideReview()
    updateMeta()
    setEditorStatus('AI edit accepted.', 'ok')
  }, [hideReview, setEditorStatus, updateMeta])

  const applyRewrite = useCallback(
    (
      content: string,
      mode: 'full' | 'selection' | 'append',
      beforeValue: string,
      from?: number,
      to?: number
    ) => {
      const next = String(content ?? '')
      pendingRef.current = null

      let full: string
      let start: number
      let end: number

      if (mode === 'append') {
        const base = beforeValue.replace(/\s+$/, '')
        const sep = base ? '\n\n' : ''
        full = base + sep + next.trim()
        start = base.length + sep.length
        end = full.length
      } else if (mode === 'selection' && typeof from === 'number' && typeof to === 'number') {
        full = beforeValue.slice(0, from) + next + beforeValue.slice(to)
        start = from
        end = from + next.length
      } else {
        full = next
        start = 0
        end = next.length
      }

      pendingRef.current = { beforeValue, start, end }
      setHighlightRange({ start, end })
      onChangeRef.current(full)
      updateMeta(full)

      requestAnimationFrame(() => {
        const ta = getTextarea(wrapRef.current)
        if (ta) {
          ta.focus()
          ta.setSelectionRange(end, end)
          const lineHeight = 22
          const linesBefore = full.slice(0, start).split('\n').length
          ta.scrollTop = Math.max(0, (linesBefore - 4) * lineHeight)
        }
        positionReview()
      })
    },
    [positionReview, updateMeta]
  )

  const positionBubble = useCallback(
    (_anchor?: { x: number; y: number } | null) => {
      const sel = getSelection()
      if (!sel.text.trim()) {
        hideBubble()
        return
      }

      const ta = getTextarea(wrapRef.current)
      if (!ta) {
        hideBubble()
        return
      }

      const place = () => {
        const live = getSelection()
        if (!live.text.trim()) {
          hideBubble()
          return
        }
        const bounds = getSelectionBounds(ta, live.start, live.end)
        const bubbleW = Math.max(bubbleRef.current?.offsetWidth || 0, 320)
        const bubbleH = Math.max(bubbleRef.current?.offsetHeight || 0, 72)
        const pad = 8
        const gap = 14

        let left = bounds.midX - bubbleW / 2
        left = Math.max(pad, Math.min(left, window.innerWidth - bubbleW - pad))

        // Prefer above the selection; fall back below; never cover the selected range.
        const above = bounds.top - bubbleH - gap
        const below = bounds.bottom + gap
        let top: number

        if (above >= pad) {
          top = above
        } else if (below + bubbleH <= window.innerHeight - pad) {
          top = below
        } else {
          const spaceAbove = bounds.top - pad
          const spaceBelow = window.innerHeight - pad - bounds.bottom
          top = spaceAbove >= spaceBelow ? Math.max(pad, bounds.top - bubbleH - gap) : below
          top = Math.max(pad, Math.min(top, window.innerHeight - bubbleH - pad))
          const overlaps = top < bounds.bottom + 4 && top + bubbleH > bounds.top - 4
          if (overlaps) {
            top =
              spaceBelow >= spaceAbove
                ? Math.min(below, window.innerHeight - bubbleH - pad)
                : Math.max(pad, bounds.top - bubbleH - gap)
          }
        }

        setBubbleStyle({ left: Math.round(left), top: Math.round(top) })
        setBubbleVisible(true)
      }

      place()
      // Remeasure after paint so real bubble size is used (avoids covering selection).
      requestAnimationFrame(place)
    },
    [getSelection, hideBubble]
  )

  const scheduleBubble = useCallback(() => {
    if (pointerDownRef.current) return
    window.clearTimeout(bubbleTimerRef.current)
    bubbleTimerRef.current = window.setTimeout(() => {
      const sel = getSelection()
      if (!sel.text.trim()) {
        hideBubble()
        return
      }
      bubbleSelectionRef.current = sel
      positionBubble()
    }, 120)
  }, [getSelection, hideBubble, positionBubble])

  const runEdit = useCallback(
    async (action: BodyEditAction, extraInstruction = '') => {
      if (pendingRef.current) {
        setEditorStatus('Accept or discard the current AI edit first.', 'error')
        positionReview()
        return
      }

      const content = value
      if (!content.trim()) {
        setEditorStatus('Write some content before using AI edit.', 'error')
        return
      }

      const live = getSelection()
      const sel =
        bubbleSelectionRef.current?.text?.trim()
          ? bubbleSelectionRef.current
          : live.text?.trim()
            ? live
            : null
      const useSelection = action !== 'continue' && !!sel?.text?.trim()
      const selectionSnap = useSelection && sel ? sel : null

      setBusy(true)
      hideBubble()
      setEditorStatus(useSelection ? 'AI editing selection…' : 'AI editing…')

      try {
        const res = await fetch('/api/admin/body-edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            title,
            action,
            instruction: extraInstruction,
            selection: selectionSnap ? selectionSnap.text : undefined,
            locale,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'AI edit failed')

        applyRewrite(
          data.content,
          data.mode || 'full',
          content,
          selectionSnap ? selectionSnap.start : undefined,
          selectionSnap ? selectionSnap.end : undefined
        )
        setInstruction('')
        bubbleSelectionRef.current = null
        setEditorStatus('AI edit applied. Accept or discard.', 'ok')
      } catch (err) {
        setEditorStatus(err instanceof Error ? err.message : 'AI edit failed', 'error')
      } finally {
        setBusy(false)
      }
    },
    [
      applyRewrite,
      getSelection,
      hideBubble,
      locale,
      positionReview,
      setEditorStatus,
      title,
      value,
    ]
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const root = wrapRef.current
    if (!root) return

    const syncFullscreen = () => {
      const on = Boolean(root.querySelector('.w-md-editor-fullscreen'))
      document.documentElement.classList.toggle('admin-md-fs', on)
    }

    const observer = new MutationObserver(syncFullscreen)
    observer.observe(root, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
    })
    syncFullscreen()

    return () => {
      observer.disconnect()
      document.documentElement.classList.remove('admin-md-fs')
    }
  }, [])

  useEffect(() => {
    updateMeta(value)
  }, [updateMeta, value])

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const root = wrapRef.current
      if (!root?.contains(e.target as Node)) return
      if (bubbleRef.current?.contains(e.target as Node)) return
      if (reviewRef.current?.contains(e.target as Node)) return
      pointerDownRef.current = true
      hideBubble()
    }

    const onMouseUp = (e: MouseEvent) => {
      pointerDownRef.current = false

      if (bubbleRef.current?.contains(e.target as Node)) return
      if (reviewRef.current?.contains(e.target as Node)) return

      const root = wrapRef.current
      if (!root?.contains(e.target as Node)) {
        hideBubble()
        return
      }

      requestAnimationFrame(() => {
        const sel = getSelection()
        if (!sel.text.trim()) {
          bubbleSelectionRef.current = null
          hideBubble()
          return
        }
        bubbleSelectionRef.current = sel
        positionBubble()
      })
    }

    const onScroll = () => {
      if (pendingRef.current) positionReview()
      if (getSelection().text.trim()) positionBubble()
    }

    const onKeyUp = () => {
      updateMeta()
      scheduleBubble()
    }

    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.clearTimeout(bubbleTimerRef.current)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [getSelection, hideBubble, positionBubble, positionReview, scheduleBubble, updateMeta])

  const handleChange = useCallback(
    (next?: string) => {
      const body = next ?? ''
      if (pendingRef.current) {
        // Editing while a suggestion is pending cancels the review UI but keeps the text.
        pendingRef.current = null
        setHighlightRange(null)
        hideReview()
      }
      onChangeRef.current(body)
      updateMeta(body)
    },
    [hideReview, updateMeta]
  )

  const keepSelection = useCallback((e: ReactMouseEvent) => {
    e.preventDefault()
  }, [])

  const rememberCaret = useCallback(() => {
    const ta = getTextarea(wrapRef.current)
    if (!ta) return
    caretRef.current = { start: ta.selectionStart, end: ta.selectionEnd }
  }, [])

  const insertMarkdown = useCallback(
    (snippet: string, preferCaret = true) => {
      const body = valueRef.current
      const ta = getTextarea(wrapRef.current)
      const caret =
        preferCaret && caretRef.current
          ? caretRef.current
          : ta
            ? { start: ta.selectionStart, end: ta.selectionEnd }
            : { start: body.length, end: body.length }

      const before = body.slice(0, caret.start)
      const after = body.slice(caret.end)
      const needsLead = before.length > 0 && !before.endsWith('\n')
      const needsTrail = after.length > 0 && !after.startsWith('\n')
      const block = `${needsLead ? '\n' : ''}${snippet}${needsTrail ? '\n' : ''}`
      const next = before + block + after
      valueRef.current = next
      onChangeRef.current(next)
      updateMeta(next)

      const cursor = before.length + block.length
      caretRef.current = { start: cursor, end: cursor }
      requestAnimationFrame(() => {
        const live = getTextarea(wrapRef.current)
        if (!live) return
        live.focus()
        live.setSelectionRange(cursor, cursor)
      })
    },
    [updateMeta]
  )

  const loadFolder = useCallback(async () => {
    if (!uploadPrefix) {
      setEditorStatus('Set the post slug first to browse blog/{slug}/.', 'error')
      return
    }
    setPickerLoading(true)
    try {
      const res = await fetch(`/api/admin/media?prefix=${encodeURIComponent(uploadPrefix)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to list files')
      setPickerItems(data.objects || [])
    } catch (err) {
      setPickerItems([])
      setEditorStatus(err instanceof Error ? err.message : 'Failed to list files', 'error')
    } finally {
      setPickerLoading(false)
    }
  }, [setEditorStatus, uploadPrefix])

  const openFolderManager = useCallback(async () => {
    if (!uploadPrefix) {
      setEditorStatus('Set the post slug first to browse blog/{slug}/.', 'error')
      return
    }
    setPickerOpen(true)
    setEditorStatus('')
    await loadFolder()
  }, [loadFolder, setEditorStatus, uploadPrefix])

  const uploadFiles = useCallback(
    async (files: File[], options?: { insert?: boolean; refresh?: boolean }) => {
      const shouldInsert = options?.insert !== false
      const shouldRefresh = options?.refresh || pickerOpen
      if (!uploadPrefix) {
        setEditorStatus('Set the post slug first so files upload to blog/{slug}/.', 'error')
        return
      }
      if (!files.length) {
        setEditorStatus('No files selected.', 'error')
        return
      }

      if (shouldInsert) rememberCaret()
      setMediaBusy(true)
      setEditorStatus(`Uploading ${files.length} file(s) to ${uploadPrefix}…`)

      try {
        for (const file of files) {
          const filename = safeUploadFilename(file)
          const form = new FormData()
          form.append('file', file)
          form.append('prefix', uploadPrefix)
          form.append('filename', filename)
          const res = await fetch('/api/admin/media', { method: 'POST', body: form })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || `Upload failed: ${file.name}`)

          const name = String(data.key || '').split('/').pop() || filename
          const url = String(data.url || '')
          const kind =
            (data.kind as 'image' | 'audio' | 'video' | 'other') ||
            fileKindFromName(name, file.type)
          if (shouldInsert) {
            insertMarkdown(markdownForUploadedFile(name, url, kind))
          }
          onFileUploadedRef.current?.(name, kind)
        }
        setEditorStatus(`Uploaded ${files.length} file(s) to ${uploadPrefix}`, 'ok')
        if (shouldRefresh) await loadFolder()
      } catch (err) {
        setEditorStatus(err instanceof Error ? err.message : 'Upload failed', 'error')
      } finally {
        setMediaBusy(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
        if (manageUploadRef.current) manageUploadRef.current.value = ''
      }
    },
    [insertMarkdown, loadFolder, pickerOpen, rememberCaret, setEditorStatus, uploadPrefix]
  )

  const insertPicked = useCallback(
    (item: { name: string; url: string; kind: string }) => {
      rememberCaret()
      const kind = (['image', 'audio', 'video', 'other'].includes(item.kind)
        ? item.kind
        : fileKindFromName(item.name)) as 'image' | 'audio' | 'video' | 'other'
      insertMarkdown(markdownForUploadedFile(item.name, item.url, kind))
      onFileUploadedRef.current?.(item.name, kind)
      setEditorStatus(`Inserted ${item.name}`, 'ok')
    },
    [insertMarkdown, rememberCaret, setEditorStatus]
  )

  const copyText = useCallback(
    async (label: string, text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        setEditorStatus(`${label} copied.`, 'ok')
      } catch {
        setEditorStatus('Copy failed.', 'error')
      }
    },
    [setEditorStatus]
  )

  const deletePicked = useCallback(
    async (item: { key: string; name: string }) => {
      if (!confirm(`Delete ${item.name} from ${uploadPrefix}?`)) return
      try {
        const res = await fetch(`/api/admin/media?key=${encodeURIComponent(item.key)}`, {
          method: 'DELETE',
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Delete failed')
        setEditorStatus(`Deleted ${item.name}`, 'ok')
        await loadFolder()
      } catch (err) {
        setEditorStatus(err instanceof Error ? err.message : 'Delete failed', 'error')
      }
    },
    [loadFolder, setEditorStatus, uploadPrefix]
  )

  useEffect(() => {
    const root = wrapRef.current
    if (!root) return

    const onPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items || [])
      const files = items
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter((file): file is File => !!file)
      if (!files.length) return
      e.preventDefault()
      void uploadFiles(files)
    }

    const onDrop = (e: DragEvent) => {
      const files = Array.from(e.dataTransfer?.files || [])
      if (!files.length) return
      e.preventDefault()
      void uploadFiles(files)
    }

    const onDragOver = (e: DragEvent) => {
      if (Array.from(e.dataTransfer?.types || []).includes('Files')) {
        e.preventDefault()
      }
    }

    root.addEventListener('paste', onPaste)
    root.addEventListener('drop', onDrop)
    root.addEventListener('dragover', onDragOver)
    return () => {
      root.removeEventListener('paste', onPaste)
      root.removeEventListener('drop', onDrop)
      root.removeEventListener('dragover', onDragOver)
    }
  }, [uploadFiles])

  const bubble = mounted
    ? createPortal(
        <div
          ref={bubbleRef}
          className={`admin-md-bubble${bubbleVisible ? '' : ' hidden'}`}
          style={{ left: bubbleStyle.left, top: bubbleStyle.top }}
          role="toolbar"
          aria-label="AI text assist"
        >
          <div className="admin-md-bubble-actions">
            {BUBBLE_ACTIONS.map(({ action, label }) => (
              <button
                key={action}
                type="button"
                className="admin-md-bubble-btn"
                disabled={busy}
                onMouseDown={keepSelection}
                onClick={() => runEdit(action)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="admin-md-bubble-instruct">
            <input
              ref={instructionRef}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Custom instruction…"
              disabled={busy}
              onMouseDown={keepSelection}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const text = instruction.trim()
                  if (!text) {
                    setEditorStatus('Enter an instruction first.', 'error')
                    instructionRef.current?.focus()
                    return
                  }
                  runEdit('custom', text)
                }
              }}
            />
            <button
              type="button"
              className="admin-md-bubble-run"
              disabled={busy}
              onMouseDown={keepSelection}
              onClick={() => {
                const text = instruction.trim()
                if (!text) {
                  setEditorStatus('Enter an instruction first.', 'error')
                  instructionRef.current?.focus()
                  return
                }
                runEdit('custom', text)
              }}
            >
              Run
            </button>
          </div>
        </div>,
        document.body
      )
    : null

  const review = mounted
    ? createPortal(
        <div
          ref={reviewRef}
          className={`admin-md-review${reviewVisible ? '' : ' hidden'}`}
          style={{ left: reviewStyle.left, top: reviewStyle.top }}
          role="status"
          aria-live="polite"
        >
          <span className="admin-md-review-label">
            AI edit ready{highlightRange ? ` · ${highlightRange.end - highlightRange.start} chars` : ''}
          </span>
          <button
            type="button"
            className="rounded-full bg-gradient-to-b from-[#3d9dff] to-[#0a76e6] px-3 py-1 text-xs font-semibold text-white"
            onMouseDown={keepSelection}
            onClick={acceptPending}
          >
            Accept
          </button>
          <button
            type="button"
            className="glass glass-pill px-3 py-1 text-xs text-[var(--ink-soft)]"
            onMouseDown={keepSelection}
            onClick={() => {
              dismissPending(true)
              setEditorStatus('AI edit discarded.')
            }}
          >
            Discard
          </button>
        </div>,
        document.body
      )
    : null

  return (
    <div
      ref={wrapRef}
      className={`admin-md-compose${highlightRange ? ' admin-md-has-suggestion' : ''}`}
      data-color-mode="light"
    >
      <div className="admin-md-media-bar">
        <div className="admin-md-media-bar-info">
          <span className="admin-md-media-label">Files</span>
          <code className="admin-md-media-prefix">
            {uploadPrefix || 'blog/{slug}/ (set slug first)'}
          </code>
        </div>
        <div className="admin-md-media-bar-actions">
          <button
            type="button"
            className="admin-md-media-btn"
            disabled={mediaBusy || !uploadPrefix}
            onClick={() => {
              rememberCaret()
              fileInputRef.current?.click()
            }}
          >
            {mediaBusy ? 'Uploading…' : 'Upload file'}
          </button>
          <button
            type="button"
            className="admin-md-media-btn"
            disabled={mediaBusy || !uploadPrefix}
            onClick={() => {
              rememberCaret()
              void openFolderManager()
            }}
          >
            Manage folder
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || [])
            if (files.length) void uploadFiles(files)
          }}
        />
      </div>
      <MDEditor
        value={value}
        onChange={handleChange}
        height="calc(100vh - 8rem)"
        visibleDragbar={false}
        preview="live"
        previewOptions={previewOptions}
        textareaProps={{
          placeholder: 'Write MDX/Markdown…',
          onSelect: () => {
            rememberCaret()
            updateMeta()
            scheduleBubble()
          },
          onClick: rememberCaret,
          onKeyUp: rememberCaret,
        }}
      />
      {bubble}
      {review}
      {pickerOpen &&
        createPortal(
          <div
            className="admin-md-picker-backdrop"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPickerOpen(false)
            }}
          >
            <div
              className="admin-md-picker"
              role="dialog"
              aria-modal="true"
              aria-label="Manage post folder"
            >
              <div className="admin-md-picker-head">
                <div>
                  <h2>Manage folder</h2>
                  <p>
                    <code>{uploadPrefix}</code>
                  </p>
                </div>
                <div className="admin-md-picker-head-actions">
                  <button
                    type="button"
                    className="admin-md-media-btn"
                    disabled={mediaBusy || pickerLoading}
                    onClick={() => void loadFolder()}
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    className="admin-md-media-btn"
                    disabled={mediaBusy}
                    onClick={() => manageUploadRef.current?.click()}
                  >
                    {mediaBusy ? 'Uploading…' : 'Upload'}
                  </button>
                  <button
                    type="button"
                    className="admin-md-media-btn"
                    onClick={() => setPickerOpen(false)}
                  >
                    Close
                  </button>
                  <input
                    ref={manageUploadRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || [])
                      if (files.length) void uploadFiles(files, { insert: false, refresh: true })
                    }}
                  />
                </div>
              </div>
              {pickerLoading ? (
                <p className="admin-md-picker-empty">Loading…</p>
              ) : pickerItems.length === 0 ? (
                <p className="admin-md-picker-empty">
                  No files in this folder yet. Upload here or use Upload file in the editor.
                </p>
              ) : (
                <div className="admin-md-picker-grid">
                  {pickerItems.map((item) => (
                    <div key={item.key} className="admin-md-picker-card">
                      <div className="admin-md-picker-preview">
                        {item.kind === 'image' ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.url} alt={item.name} />
                        ) : item.kind === 'video' ? (
                          // Admin thumbnail preview only — no captions available.
                          // eslint-disable-next-line jsx-a11y/media-has-caption
                          <video src={item.url} preload="metadata" />
                        ) : (
                          <span className="admin-md-picker-kind">{item.kind}</span>
                        )}
                      </div>
                      <p className="admin-md-picker-name" title={item.name}>
                        {item.name}
                      </p>
                      <div className="admin-md-picker-actions">
                        <button type="button" onClick={() => insertPicked(item)}>
                          Insert
                        </button>
                        <button type="button" onClick={() => void copyText('URL', item.url)}>
                          URL
                        </button>
                        <button type="button" onClick={() => void copyText('Filename', item.name)}>
                          Name
                        </button>
                        <a href={item.url} target="_blank" rel="noreferrer">
                          Open
                        </a>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => void deletePicked(item)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
