import siteMetadata from '@/data/siteMetadata'

export function isBareImageFilename(url: string) {
  return (
    !url.startsWith('http://') &&
    !url.startsWith('https://') &&
    !url.startsWith('/') &&
    !url.startsWith('data:')
  )
}

/**
 * Resolves bare image filenames (e.g. `home.png`) to CDN URLs:
 * `{staticCdn}/{blogPath}/{filename}`
 */
export function resolveBlogImageSrc(src: string | undefined, blogPath?: string) {
  if (!src || !blogPath) return src

  if (!isBareImageFilename(src)) return src

  const cdnBase = (siteMetadata.staticCdn || '').replace(/\/$/, '')
  if (!cdnBase) return src

  return `${cdnBase}/${blogPath}/${src}`
}
