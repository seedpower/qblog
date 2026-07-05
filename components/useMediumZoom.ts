'use client'

import { useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import mediumZoom from 'medium-zoom/dist/pure'
import type { Zoom } from 'medium-zoom/dist/pure'

export function useMediumZoom<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const zoomRef = useRef<Zoom | null>(null)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const element = ref.current
    if (!element) return

    zoomRef.current = mediumZoom(element, {
      margin: 24,
      background: resolvedTheme === 'dark' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.95)',
    })

    return () => {
      zoomRef.current?.detach()
      zoomRef.current = null
    }
  }, [resolvedTheme])

  return ref
}
