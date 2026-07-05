'use client'

import { useMediumZoom } from './useMediumZoom'

const MDXZoomableImg = ({ className, ...rest }: React.ImgHTMLAttributes<HTMLImageElement>) => {
  const ref = useMediumZoom<HTMLImageElement>()

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} className={['cursor-zoom-in', className].filter(Boolean).join(' ')} {...rest} />
  )
}

export default MDXZoomableImg
