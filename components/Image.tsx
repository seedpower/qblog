import { forwardRef } from 'react'
import NextImage, { ImageProps } from 'next/image'

const basePath = process.env.BASE_PATH

const Image = forwardRef<HTMLImageElement, ImageProps>(({ src, ...rest }, ref) => {
  const resolvedSrc =
    typeof src === 'string' &&
    (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:'))
      ? src
      : `${basePath || ''}${src}`

  return <NextImage ref={ref} src={resolvedSrc} {...rest} />
})

Image.displayName = 'Image'

export default Image
