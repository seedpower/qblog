'use client'

import { useMediumZoom } from './useMediumZoom'
import { resolveBlogImageSrc } from '../utils/resolveBlogImageSrc'

type MDXZoomableImgProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  blogPath?: string
}

const MDXZoomableImg = ({ className, src, blogPath, ...rest }: MDXZoomableImgProps) => {
  const ref = useMediumZoom<HTMLImageElement>()
  const resolvedSrc = typeof src === 'string' ? resolveBlogImageSrc(src, blogPath) : src

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={resolvedSrc}
      className={['cursor-zoom-in', className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
}

export default MDXZoomableImg
