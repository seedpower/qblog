'use client'

import 'medium-zoom/dist/style.css'
import Image from './Image'
import { useMediumZoom } from './useMediumZoom'
import type { ImageProps } from 'next/image'

const MDXImage = ({ className, ...rest }: ImageProps) => {
  const ref = useMediumZoom<HTMLImageElement>()

  return (
    <Image
      ref={ref}
      className={['cursor-zoom-in', className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
}

export default MDXImage
