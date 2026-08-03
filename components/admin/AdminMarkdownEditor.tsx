'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { resolveBlogImageSrc } from '@/utils/resolveBlogImageSrc'
import AdminMdPreviewCode from '@/components/admin/AdminMdPreviewCode'
import '@uiw/react-md-editor/markdown-editor.css'
import '@/css/admin-markdown-editor.css'

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

/** True for any non-empty range, including whitespace / newlines only. */
function hasSelectionSnap(sel: SelectionSnap | null | undefined): boolean {
  return Boolean(sel && sel.end > sel.start)
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

type CaretPoint = { top: number; left: number; height: number }

/** Reuses one mirror node so multi-line selection measurement stays cheap. */
function createCaretMeasurer(textarea: HTMLTextAreaElement) {
  const style = window.getComputedStyle(textarea)
  const mirror = document.createElement('div')
  const marker = document.createElement('span')
  marker.textContent = '\u200b'
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
  document.body.appendChild(mirror)

  const value = textarea.value
  const taRect = textarea.getBoundingClientRect()
  const borderTop = Number.parseFloat(style.borderTopWidth || '0')
  const borderLeft = Number.parseFloat(style.borderLeftWidth || '0')
  const fallbackLineHeight =
    Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) || 21

  const measure = (position: number): CaretPoint => {
    const clamped = Math.max(0, Math.min(position, value.length))
    mirror.textContent = value.slice(0, clamped)
    mirror.appendChild(marker)
    const markerRect = marker.getBoundingClientRect()
    const mirrorRect = mirror.getBoundingClientRect()
    return {
      top: taRect.top + (markerRect.top - mirrorRect.top) - textarea.scrollTop + borderTop,
      left: taRect.left + (markerRect.left - mirrorRect.left) - textarea.scrollLeft + borderLeft,
      height: markerRect.height || fallbackLineHeight,
    }
  }

  const dispose = () => {
    mirror.remove()
  }

  return { measure, dispose, taRect }
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

/**
 * Build highlight rects per *visual* line for range [start, end) (exclusive end).
 *
 * Soft-wrap note: the caret *before* the first glyph on a wrapped line still sits at
 * the end of the previous visual line. Belonging line / left edge must come from the
 * caret *after* that glyph (or contentLeft when it wraps).
 */
function getSelectionHighlightRects(
  textarea: HTMLTextAreaElement,
  start: number,
  end: number
): Array<{ top: number; left: number; width: number; height: number }> {
  if (end <= start) return []

  const style = window.getComputedStyle(textarea)
  const padL = Number.parseFloat(style.paddingLeft) || 0
  const padR = Number.parseFloat(style.paddingRight) || 0
  const { measure, dispose, taRect } = createCaretMeasurer(textarea)
  const contentLeft = taRect.left + padL
  const contentRight = taRect.right - padR
  const value = textarea.value

  type LineRun = { top: number; left: number; right: number; height: number }
  const runs: LineRun[] = []

  try {
    const sameLine = (a: number, b: number) => Math.abs(a - b) < 1.5

    const pushChar = (top: number, left: number, right: number, height: number) => {
      const clampedLeft = Math.max(Math.min(left, right), taRect.left)
      const clampedRight = Math.min(Math.max(left, right), taRect.right)
      if (clampedRight - clampedLeft < 1) return
      const last = runs[runs.length - 1]
      if (last && sameLine(last.top, top) && Math.abs(last.right - clampedLeft) < 1.5) {
        last.right = Math.max(last.right, clampedRight)
        last.height = Math.max(last.height, height)
        return
      }
      runs.push({ top, left: clampedLeft, right: clampedRight, height })
    }

    for (let i = start; i < end; i++) {
      if (value[i] === '\n') {
        // Empty / newline-only selections still need a visible pin mark.
        const before = measure(i)
        const after = measure(i + 1)
        const top = sameLine(before.top, after.top) ? before.top : after.top
        const height = before.height || after.height
        const left = sameLine(before.top, after.top) ? before.left : contentLeft
        pushChar(top, left, Math.min(left + 8, contentRight), height)
        continue
      }

      const before = measure(i)
      const after = measure(i + 1)

      if (sameLine(before.top, after.top)) {
        // After a hard newline the before-caret can sit a few px inset; pin to contentLeft.
        const atHardLineStart = i === 0 || value[i - 1] === '\n'
        const left = atHardLineStart ? contentLeft : before.left
        pushChar(before.top, left, Math.max(after.left, left + 1), before.height)
        continue
      }

      // Soft wrap: glyph `i` is painted on the *next* visual line at contentLeft.
      pushChar(after.top, contentLeft, Math.max(after.left, contentLeft + 1), after.height || before.height)
    }
  } finally {
    dispose()
  }

  return runs
    .map((run) => {
      const top = Math.max(run.top, taRect.top)
      const bottom = Math.min(run.top + run.height, taRect.bottom)
      if (bottom <= top + 1) return null
      return {
        top,
        left: run.left,
        width: Math.max(4, Math.min(run.right, contentRight + 0.5) - run.left),
        height: bottom - top,
      }
    })
    .filter((rect): rect is { top: number; left: number; width: number; height: number } => !!rect)
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
  fillHeight = false,
  onFileUploaded,
  onFileRenamed,
  onMetaChange,
  onStatusChange,
}: {
  value: string
  onChange: (value: string) => void
  title?: string
  locale?: 'zh-CN' | 'en'
  /** Post slug used as R2 folder: blog/{slug}/ */
  slug?: string
  /** Fill parent height instead of a viewport-based default */
  fillHeight?: boolean
  /** Called after a successful upload (bare filename + kind) */
  onFileUploaded?: (filename: string, kind: 'image' | 'audio' | 'video' | 'other') => void
  /** Called after a successful rename so the parent can update images[] / body refs */
  onFileRenamed?: (fromName: string, toName: string) => void
  onMetaChange?: (meta: string) => void
  onStatusChange?: (status: { message: string; kind: 'ok' | 'error' | '' }) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const valueRef = useRef(value)
  const onFileUploadedRef = useRef(onFileUploaded)
  const onFileRenamedRef = useRef(onFileRenamed)
  const onMetaChangeRef = useRef(onMetaChange)
  const onStatusChangeRef = useRef(onStatusChange)
  const pendingRef = useRef<PendingEdit | null>(null)
  const bubbleSelectionRef = useRef<SelectionSnap | null>(null)
  /** Frozen copy used while the instruction field is focused — never overwritten by onSelect. */
  const pinnedSelectionRef = useRef<SelectionSnap | null>(null)
  const bubbleTimerRef = useRef(0)
  const pointerDownRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const manageUploadRef = useRef<HTMLInputElement>(null)
  const [editorHeight, setEditorHeight] = useState(fillHeight ? 480 : undefined)
  const caretRef = useRef<{ start: number; end: number } | null>(null)

  const [mounted, setMounted] = useState(false)
  const [bubbleVisible, setBubbleVisible] = useState(false)
  const [bubbleStyle, setBubbleStyle] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const [reviewVisible, setReviewVisible] = useState(false)
  const [reviewStyle, setReviewStyle] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const [highlightRange, setHighlightRange] = useState<{ start: number; end: number } | null>(null)
  const [selectionGhostRects, setSelectionGhostRects] = useState<
    Array<{ top: number; left: number; width: number; height: number }>
  >([])
  const selectionGhostPinnedRef = useRef(false)
  const [mediaBusy, setMediaBusy] = useState(false)
  const [zipBusy, setZipBusy] = useState(false)
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
  onFileRenamedRef.current = onFileRenamed
  onMetaChangeRef.current = onMetaChange
  onStatusChangeRef.current = onStatusChange

  const uploadPrefix = useMemo(() => {
    const clean = (slug || '').replace(/^\/+|\/+$/g, '').replace(/\\/g, '/')
    return clean ? `blog/${clean}/` : ''
  }, [slug])

  const blogPath = useMemo(() => uploadPrefix.replace(/\/$/, ''), [uploadPrefix])

  const previewOptions = useMemo(
    () => ({
      components: {
        code: AdminMdPreviewCode,
      },
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
    selectionGhostPinnedRef.current = false
    pinnedSelectionRef.current = null
    setSelectionGhostRects([])
  }, [])

  const resolvePinnedSelection = useCallback((): SelectionSnap | null => {
    const pinned = pinnedSelectionRef.current
    if (hasSelectionSnap(pinned)) return pinned
    const bubble = bubbleSelectionRef.current
    if (hasSelectionSnap(bubble)) return bubble
    return null
  }, [])

  const syncSelectionGhost = useCallback(() => {
    const snap = resolvePinnedSelection()
    const ta = getTextarea(wrapRef.current)
    if (!selectionGhostPinnedRef.current || !hasSelectionSnap(snap) || !ta) {
      setSelectionGhostRects([])
      return
    }
    setSelectionGhostRects(getSelectionHighlightRects(ta, snap!.start, snap!.end))
  }, [resolvePinnedSelection])

  const pinSelectionGhost = useCallback(() => {
    const existing = hasSelectionSnap(pinnedSelectionRef.current)
      ? pinnedSelectionRef.current
      : hasSelectionSnap(bubbleSelectionRef.current)
        ? bubbleSelectionRef.current
        : null
    const live = getSelection()
    const snap = hasSelectionSnap(existing) ? existing : hasSelectionSnap(live) ? live : null
    if (!hasSelectionSnap(snap)) return
    // Freeze the exact user range before focus steals the native selection.
    pinnedSelectionRef.current = { ...snap! }
    bubbleSelectionRef.current = { ...snap! }
    selectionGhostPinnedRef.current = true
    syncSelectionGhost()
  }, [getSelection, syncSelectionGhost])

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
      let next = String(content ?? '')
      pendingRef.current = null

      let full: string
      let start: number
      let end: number

      if (mode === 'append') {
        const base = beforeValue.replace(/[ \t]+$/u, '')
        const sep = base ? (base.endsWith('\n') ? '\n' : '\n\n') : ''
        // Keep internal newlines; only strip spaces/tabs at the very edges.
        const chunk = next.replace(/^[ \t]+/u, '').replace(/[ \t]+$/u, '')
        full = base + sep + chunk
        start = base.length + sep.length
        end = full.length
      } else if (mode === 'selection' && typeof from === 'number' && typeof to === 'number') {
        const original = beforeValue.slice(from, to)
        // Re-attach original leading/trailing newlines if the model trimmed them.
        const lead = original.match(/^\n*/)?.[0] ?? ''
        const trail = original.match(/\n*$/)?.[0] ?? ''
        let core = next
        if (lead) core = core.replace(/^\n+/, '')
        if (trail) core = core.replace(/\n+$/, '')
        next = `${lead}${core}${trail}`
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
      const live = getSelection()
      const pinned = resolvePinnedSelection()
      const sel = hasSelectionSnap(live) ? live : hasSelectionSnap(pinned) ? pinned : null
      if (!sel) {
        hideBubble()
        return
      }

      const ta = getTextarea(wrapRef.current)
      if (!ta) {
        hideBubble()
        return
      }

      const place = () => {
        const currentLive = getSelection()
        const current = hasSelectionSnap(currentLive)
          ? currentLive
          : resolvePinnedSelection()
        if (!hasSelectionSnap(current)) {
          hideBubble()
          return
        }
        const bounds = getSelectionBounds(ta, current!.start, current!.end)
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
    [getSelection, hideBubble, resolvePinnedSelection]
  )

  const scheduleBubble = useCallback(() => {
    if (pointerDownRef.current) return
    // Instruction field has focus / ghost pin — keep the original frozen range.
    if (selectionGhostPinnedRef.current || pinnedSelectionRef.current) return
    if (bubbleRef.current?.contains(document.activeElement)) return
    window.clearTimeout(bubbleTimerRef.current)
    bubbleTimerRef.current = window.setTimeout(() => {
      if (selectionGhostPinnedRef.current || pinnedSelectionRef.current) return
      const sel = getSelection()
      if (!hasSelectionSnap(sel)) {
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
      const frozen = resolvePinnedSelection()
      const sel = hasSelectionSnap(frozen) ? frozen : hasSelectionSnap(live) ? live : null
      const useSelection = action !== 'continue' && hasSelectionSnap(sel)
      const selectionSnap = useSelection && sel ? sel : null

      setBusy(true)
      hideBubble()
      setEditorStatus(useSelection ? 'AI editing selection…' : 'AI editing…')

      try {
        const res = await fetch('/api/admin/body-edit/', {
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
        pinnedSelectionRef.current = null
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
      resolvePinnedSelection,
      setEditorStatus,
      title,
      value,
    ]
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!fillHeight) return
    const root = wrapRef.current
    if (!root || typeof ResizeObserver === 'undefined') return

    const sync = () => {
      const mediaBar = root.querySelector('.admin-md-media-bar') as HTMLElement | null
      const barH = mediaBar?.offsetHeight ?? 0
      const next = Math.max(320, Math.floor(root.clientHeight - barH))
      setEditorHeight((prev) => (prev === next ? prev : next))
    }

    const ro = new ResizeObserver(sync)
    ro.observe(root)
    sync()
    return () => ro.disconnect()
  }, [fillHeight])

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
        if (selectionGhostPinnedRef.current || pinnedSelectionRef.current) return
        const sel = getSelection()
        if (!hasSelectionSnap(sel)) {
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
      if (hasSelectionSnap(getSelection())) positionBubble()
      else if (hasSelectionSnap(resolvePinnedSelection()) && bubbleVisible) positionBubble()
      if (selectionGhostPinnedRef.current) syncSelectionGhost()
    }

    const onKeyUp = () => {
      // Typing in the bubble instruction field clears the textarea selection;
      // don't treat that as “deselected” and hide the menu mid-keystroke.
      const active = document.activeElement
      if (bubbleRef.current?.contains(active)) return
      if (reviewRef.current?.contains(active)) return
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
  }, [
    bubbleVisible,
    getSelection,
    hideBubble,
    positionBubble,
    positionReview,
    resolvePinnedSelection,
    scheduleBubble,
    syncSelectionGhost,
    updateMeta,
  ])

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
    // Buttons: preventDefault keeps the textarea selection when clicking the bubble.
    e.preventDefault()
  }, [])

  const focusInstruction = useCallback(
    (e: ReactMouseEvent<HTMLInputElement>) => {
      // Keep native selection through mousedown, then focus the input and paint a ghost
      // so the range stays visible while typing the custom instruction.
      e.preventDefault()
      e.stopPropagation()
      pinSelectionGhost()
      requestAnimationFrame(() => {
        instructionRef.current?.focus({ preventScroll: true })
      })
    },
    [pinSelectionGhost]
  )

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

  const loadFolder = useCallback(async (opts?: { silent?: boolean }) => {
    if (!uploadPrefix) {
      setEditorStatus('Set the post slug first to browse blog/{slug}/.', 'error')
      return
    }
    if (!opts?.silent) setPickerLoading(true)
    try {
      const res = await fetch(`/api/admin/media/?prefix=${encodeURIComponent(uploadPrefix)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to list files')
      setPickerItems(data.objects || [])
    } catch (err) {
      if (!opts?.silent) setPickerItems([])
      setEditorStatus(err instanceof Error ? err.message : 'Failed to list files', 'error')
    } finally {
      if (!opts?.silent) setPickerLoading(false)
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

  const downloadFolderZip = useCallback(async () => {
    if (!uploadPrefix) {
      setEditorStatus('Set the post slug first.', 'error')
      return
    }
    setZipBusy(true)
    setEditorStatus('Packing folder…')
    try {
      const res = await fetch(
        `/api/admin/media/?prefix=${encodeURIComponent(uploadPrefix)}&download=zip`
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Download failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const folderName = uploadPrefix.replace(/\/+$/, '').split('/').pop() || 'folder'
      anchor.href = url
      anchor.download = `${folderName}.zip`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setEditorStatus(`Downloaded ${folderName}.zip`, 'ok')
    } catch (err) {
      setEditorStatus(err instanceof Error ? err.message : 'Download failed', 'error')
    } finally {
      setZipBusy(false)
    }
  }, [setEditorStatus, uploadPrefix])

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
          const res = await fetch('/api/admin/media/', { method: 'POST', body: form })
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
        if (shouldRefresh) await loadFolder({ silent: true })
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
        const res = await fetch(`/api/admin/media/?key=${encodeURIComponent(item.key)}`, {
          method: 'DELETE',
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Delete failed')
        setEditorStatus(`Deleted ${item.name}`, 'ok')
        setPickerItems((prev) => prev.filter((entry) => entry.key !== item.key))
        await loadFolder({ silent: true })
      } catch (err) {
        setEditorStatus(err instanceof Error ? err.message : 'Delete failed', 'error')
      }
    },
    [loadFolder, setEditorStatus, uploadPrefix]
  )

  const rewriteBodyFilename = useCallback(
    (fromName: string, toName: string) => {
      if (!fromName || fromName === toName) return
      const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const from = escape(fromName)
      const body = valueRef.current
      const next = body
        .replace(new RegExp(`(!\\[[^\\]]*\\]\\()${from}(\\))`, 'g'), `$1${toName}$2`)
        .replace(new RegExp(`(\\[[^\\]]*\\]\\()${from}(\\))`, 'g'), `$1${toName}$2`)
        .replace(new RegExp(`(src=["'])${from}(["'])`, 'g'), `$1${toName}$2`)
        .replace(new RegExp(`(href=["'])${from}(["'])`, 'g'), `$1${toName}$2`)
      if (next === body) return
      valueRef.current = next
      onChangeRef.current(next)
      updateMeta(next)
    },
    [updateMeta]
  )

  const renamePicked = useCallback(
    async (item: { key: string; name: string; url: string; kind: string }) => {
      const nextName = window.prompt('Rename file to:', item.name)?.trim()
      if (!nextName || nextName === item.name) return
      if (/[\\/]/.test(nextName)) {
        setEditorStatus('Filename cannot contain slashes.', 'error')
        return
      }
      try {
        const res = await fetch('/api/admin/media/', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: item.key, newName: nextName }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Rename failed')
        const toName = String(data.name || nextName)
        const toKey = String(data.key || item.key)
        const toUrl = String(data.url || item.url)
        const toKind = String(data.kind || item.kind)

        // Update the card in place — avoid full-grid Loading flash.
        setPickerItems((prev) =>
          [...prev]
            .map((entry) =>
              entry.key === item.key
                ? {
                    ...entry,
                    key: toKey,
                    name: toName,
                    url: toUrl.includes('?') ? toUrl : `${toUrl}?v=${Date.now()}`,
                    kind: toKind,
                  }
                : entry
            )
            .sort((a, b) => a.name.localeCompare(b.name))
        )

        rewriteBodyFilename(item.name, toName)
        onFileRenamedRef.current?.(item.name, toName)
        setEditorStatus(`Renamed to ${toName}`, 'ok')
        void loadFolder({ silent: true })
      } catch (err) {
        setEditorStatus(err instanceof Error ? err.message : 'Rename failed', 'error')
      }
    },
    [loadFolder, rewriteBodyFilename, setEditorStatus]
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
              onMouseDown={focusInstruction}
              onFocus={pinSelectionGhost}
              onKeyDown={(e) => {
                e.stopPropagation()
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

  const selectionGhost =
    mounted && selectionGhostRects.length
      ? createPortal(
          <div className="admin-md-sel-ghost" aria-hidden="true">
            {selectionGhostRects.map((rect, index) => (
              <div
                key={`${rect.top}-${rect.left}-${index}`}
                className="admin-md-sel-ghost-rect"
                style={{
                  top: rect.top,
                  left: rect.left,
                  width: rect.width,
                  height: rect.height,
                }}
              />
            ))}
          </div>,
          document.body
        )
      : null

  return (
    <div
      ref={wrapRef}
      className={`admin-md-compose${highlightRange ? ' admin-md-has-suggestion' : ''}${fillHeight ? ' admin-md-compose-fill' : ''}`}
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
        height={fillHeight ? editorHeight ?? 480 : 'calc(100vh - 8rem)'}
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
      {selectionGhost}
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
                    disabled={mediaBusy || zipBusy || pickerLoading || pickerItems.length === 0}
                    onClick={() => void downloadFolderZip()}
                  >
                    {zipBusy ? 'Packing…' : 'Download zip'}
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
              {pickerLoading && pickerItems.length === 0 ? (
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
                        <button type="button" onClick={() => void renamePicked(item)}>
                          Rename
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
