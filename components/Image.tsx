import { forwardRef } from 'react'
import NextImage, { ImageProps } from 'next/image'

const basePath = process.env.BASE_PATH

const Image = forwardRef<HTMLImageElement, ImageProps>(({ src, ...rest }, ref) => (
  <NextImage ref={ref} src={`${basePath || ''}${src}`} {...rest} />
))

Image.displayName = 'Image'

export default Image
