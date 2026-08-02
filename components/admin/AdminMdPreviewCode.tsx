'use client'

import { Children, isValidElement, type ReactNode } from 'react'
import { getCodeString } from 'rehype-rewrite'
import Mermaid from '@/components/Mermaid'

type CodeProps = {
  inline?: boolean
  className?: string
  children?: ReactNode
  node?: unknown
}

function extractText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractText(node.props.children)
  }
  return ''
}

function resolveCodeText(children: ReactNode, node: unknown): string {
  try {
    const fromAst = getCodeString(
      // rehype node children when present
      (node as { children?: Parameters<typeof getCodeString>[0] } | undefined)?.children
    )
    if (fromAst?.trim()) return fromAst
  } catch {
    // fall through
  }
  if (Array.isArray(children) && Children.count(children) === 1 && typeof children[0] === 'string') {
    return children[0]
  }
  return extractText(children)
}

/** Custom preview `code` renderer so ```mermaid fences become diagrams. */
export default function AdminMdPreviewCode({ inline, className, children, node, ...props }: CodeProps) {
  const code = resolveCodeText(children, node)
  const isMermaid =
    typeof className === 'string' && /^language-mermaid\b/i.test(className)

  if (!inline && isMermaid && code.trim()) {
    return (
      <div className="admin-md-mermaid not-prose my-4 overflow-x-auto">
        <Mermaid chart={code} />
      </div>
    )
  }

  return (
    <code className={className} {...props}>
      {children}
    </code>
  )
}
