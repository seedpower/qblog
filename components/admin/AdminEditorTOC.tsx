'use client'

import { useMemo, useState } from 'react'

export type EditorTocItem = {
  depth: number
  value: string
  /** Character offset in the markdown source */
  index: number
  line: number
}

/** Parse ATX headings from markdown, skipping fenced code blocks. */
export function extractEditorToc(markdown: string): EditorTocItem[] {
  const lines = markdown.split('\n')
  const items: EditorTocItem[] = []
  let inFence = false
  let offset = 0

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex] ?? ''
    const trimmed = line.trim()
    if (trimmed.startsWith('```')) {
      inFence = !inFence
    } else if (!inFence) {
      const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line)
      if (match) {
        const value = match[2]!.replace(/\s+#+\s*$/, '').trim()
        if (value) {
          items.push({
            depth: match[1]!.length,
            value,
            index: offset,
            line: lineIndex,
          })
        }
      }
    }
    offset += line.length + (lineIndex < lines.length - 1 ? 1 : 0)
  }

  return items
}

export default function AdminEditorTOC({
  markdown,
  activeIndex,
  onJump,
  fullscreen = false,
}: {
  markdown: string
  activeIndex?: number
  onJump: (item: EditorTocItem) => void
  fullscreen?: boolean
}) {
  const items = useMemo(() => extractEditorToc(markdown), [markdown])
  const [open, setOpen] = useState(true)

  if (items.length === 0) return null

  const minDepth = Math.min(...items.map((item) => item.depth))

  return (
    <aside
      className={`admin-md-toc${open ? '' : ' collapsed'}${fullscreen ? ' admin-md-toc-fs' : ''}`}
      aria-label="Table of contents"
    >      <div className="admin-md-toc-head">
        <p className="admin-md-toc-title">Contents</p>
        <button
          type="button"
          className="admin-md-toc-toggle"
          aria-expanded={open}
          aria-label={open ? 'Collapse table of contents' : 'Expand table of contents'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '−' : '+'}
        </button>
      </div>
      {open ? (
        <nav className="admin-md-toc-nav">
          <ul>
            {items.map((item) => {
              const indent = Math.max(0, item.depth - minDepth)
              const active = activeIndex === item.index
              return (
                <li key={`${item.line}-${item.index}`} style={{ paddingLeft: `${indent * 0.7}rem` }}>
                  <button
                    type="button"
                    className={`admin-md-toc-link${active ? ' active' : ''}`}
                    title={item.value}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onJump(item)}
                  >
                    {item.value}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      ) : null}
    </aside>
  )
}
