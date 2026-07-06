'use client'

import { useEffect, useId, useRef } from 'react'
import { useTheme } from 'next-themes'
import mermaid from 'mermaid'

interface MermaidProps {
  chart: string
}

export default function Mermaid({ chart }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const id = useId().replace(/:/g, '')
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false

    mermaid.initialize({
      startOnLoad: false,
      theme: resolvedTheme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
    })

    const renderChart = async () => {
      try {
        const { svg } = await mermaid.render(`mermaid-${id}`, chart.trim())
        if (!cancelled) {
          container.innerHTML = svg
        }
      } catch (error) {
        console.error('Mermaid render error:', error)
      }
    }

    renderChart()

    return () => {
      cancelled = true
    }
  }, [chart, id, resolvedTheme])

  return (
    <div
      ref={containerRef}
      className="mermaid my-8 flex justify-center overflow-x-auto"
      aria-label="Mermaid diagram"
    />
  )
}
