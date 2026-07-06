import { forwardRef } from 'react'
import NextImage, { ImageProps } from 'next/image'

const basePath = process.env.BASE_PATH

function isRemoteSrc(src: ImageProps['src']): src is string {
  return (
    typeof src === 'string' &&
    (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:'))
  )
}

const Image = forwardRef<HTMLImageElement, ImageProps>(
  ({ src, fill, priority, sizes, className, alt, width, height, ...rest }, ref) => {
    if (isRemoteSrc(src)) {
      const imgClassName = [fill && 'absolute inset-0 h-full w-full', className]
        .filter(Boolean)
        .join(' ')

      return (
        <img
          ref={ref}
          src={src}
          alt={alt}
          sizes={sizes}
          width={fill ? undefined : width}
          height={fill ? undefined : height}
          loading={priority ? 'eager' : 'lazy'}
          className={imgClassName || undefined}
        />
      )
    }

    const resolvedSrc = typeof src === 'string' ? `${basePath || ''}${src}` : src

    return (
      <NextImage
        ref={ref}
        src={resolvedSrc}
        fill={fill}
        priority={priority}
        sizes={sizes}
        className={className}
        alt={alt}
        width={width}
        height={height}
        {...rest}
      />
    )
  }
)

Image.displayName = 'Image'

export default Image
