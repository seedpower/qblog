'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import '@/css/admin-markdown-editor.css'
import '@uiw/react-md-editor/markdown-editor.css'

const MDEditor = dynamic(() => import('@uiw/react-md-editor').then((m) => m.default), {
  ssr: false,
  loading: () => <div className="admin-md-loading">Loading markdown editor…</div>,
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
    markerRect.height ||
    Number.parseFloat(style.lineHeight) ||
    Number.parseFloat(style.fontSize) ||
    21

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

export default function AdminMarkdownEditor({
  value,
  onChange,
  title,
  locale = 'zh-CN',
}: {
  value: string
  onChange: (value: string) => void
  title?: string
  locale?: 'zh-CN' | 'en'
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const pendingRef = useRef<PendingEdit | null>(null)
  const bubbleSelectionRef = useRef<SelectionSnap | null>(null)
  const bubbleTimerRef = useRef(0)
  const pointerDownRef = useRef(false)

  const [meta, setMeta] = useState('0 chars · Markdown')
  const [status, setStatus] = useState('')
  const [statusKind, setStatusKind] = useState<'ok' | 'error' | ''>('')
  const [mounted, setMounted] = useState(false)
  const [bubbleVisible, setBubbleVisible] = useState(false)
  const [bubbleStyle, setBubbleStyle] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const [reviewVisible, setReviewVisible] = useState(false)
  const [reviewStyle, setReviewStyle] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const [highlightRange, setHighlightRange] = useState<{ start: number; end: number } | null>(null)

  const instructionRef = useRef<HTMLInputElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const reviewRef = useRef<HTMLDivElement>(null)

  onChangeRef.current = onChange

  const setEditorStatus = useCallback((message: string, kind: 'ok' | 'error' | '' = '') => {
    setStatus(message)
    setStatusKind(kind)
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
      setMeta(
        selected
          ? `${body.length} chars · selected ${selected} · Markdown`
          : `${body.length} chars · Markdown`
      )
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
      const sel = bubbleSelectionRef.current?.text?.trim()
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
    [applyRewrite, getSelection, hideBubble, locale, positionReview, setEditorStatus, title, value]
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

  const bubble = mounted
    ? createPortal(
        <div
          ref={bubbleRef}
          role="toolbar"
          aria-label="AI edit actions"
          aria-hidden={!bubbleVisible}
          tabIndex={-1}
          className={bubbleVisible ? 'admin-md-bubble' : 'admin-md-bubble hidden'}
          style={{ left: bubbleStyle.left, top: bubbleStyle.top }}
          onMouseDown={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') hideBubble()
          }}
        >
          <div className="admin-md-bubble-actions">
            {BUBBLE_ACTIONS.map(({ action, label }) => (
              <button
                key={action}
                type="button"
                className="admin-md-bubble-btn"
                disabled={busy}
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
          role="toolbar"
          aria-label="AI edit review"
          tabIndex={-1}
          className={reviewVisible ? 'admin-md-review' : 'admin-md-review hidden'}
          style={{ left: reviewStyle.left, top: reviewStyle.top }}
          aria-hidden={!reviewVisible}
          onMouseDown={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') dismissPending(false)
          }}
        >
          <span className="admin-md-review-label">
            AI edit ready
            {highlightRange ? ` · ${highlightRange.end - highlightRange.start} chars` : ''}
          </span>
          <button
            type="button"
            className="rounded-full bg-gradient-to-b from-[#3d9dff] to-[#0a76e6] px-3 py-1 text-xs font-semibold text-white"
            onClick={acceptPending}
          >
            Accept
          </button>
          <button
            type="button"
            className="glass glass-pill px-3 py-1 text-xs text-[var(--ink-soft)]"
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
      className={
        highlightRange ? 'admin-md-compose admin-md-has-suggestion' : 'admin-md-compose'
      }
      data-color-mode="light"
    >
      <MDEditor
        value={value}
        onChange={handleChange}
        height={680}
        visibleDragbar={false}
        preview="edit"
        textareaProps={{
          placeholder: 'Write MDX/Markdown… Select text to open the AI menu.',
          onSelect: () => {
            updateMeta()
            scheduleBubble()
          },
        }}
      />
      <p className="admin-md-meta">{meta}</p>
      <p className={`admin-md-status${statusKind ? ` ${statusKind}` : ''}`} role="status">
        {status}
      </p>
      {bubble}
      {review}
    </div>
  )
}
