import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import Pre from 'pliny/ui/Pre'
import Mermaid from './Mermaid'

function extractText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join('')
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractText(node.props.children)
  }

  return ''
}

function getMermaidChart(children: ReactNode): string | null {
  if (typeof children === 'string' && children.trim()) {
    return children
  }

  const child = Children.only(children) as ReactElement<{
    className?: string
    children?: ReactNode
  }>
  if (!isValidElement(child)) return null

  const className = child.props.className
  if (typeof className === 'string' && className.includes('language-mermaid')) {
    const chart = extractText(child.props.children)
    return chart.trim() || null
  }

  return null
}

interface PreWithMermaidProps {
  children?: ReactNode
  className?: string
}

const PreWithMermaid = ({ children, className }: PreWithMermaidProps) => {
  if (className?.includes('mermaid')) {
    const chart = extractText(children)
    if (chart.trim()) {
      return <Mermaid chart={chart} />
    }
  }

  const chart = getMermaidChart(children)
  if (chart) {
    return <Mermaid chart={chart} />
  }

  return <Pre>{children}</Pre>
}

export default PreWithMermaid
