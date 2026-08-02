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
      margin: 28,
      background:
        resolvedTheme === 'dark'
          ? 'linear-gradient(155deg, rgba(24, 28, 38, 0.72), rgba(10, 13, 19, 0.55))'
          : 'linear-gradient(155deg, rgba(255, 255, 255, 0.62), rgba(238, 242, 248, 0.48))',
    })

    return () => {
      zoomRef.current?.detach()
      zoomRef.current = null
    }
  }, [resolvedTheme])

  return ref
}
