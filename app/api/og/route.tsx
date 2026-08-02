import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import siteMetadata from '@/data/siteMetadata'
import { getPostBySlug } from '@/lib/posts'
import { defaultLocale, isAppLocale } from '@/i18n/routing'
import { resolveBlogImageSrc } from '@/utils/resolveBlogImageSrc'
import type { PostLocale } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WIDTH = 1200
const HEIGHT = 630

async function loadFontForText(text: string): Promise<ArrayBuffer | null> {
  try {
    // IE/old Firefox UA → Google Fonts returns TTF/OTF (Satori cannot use WOFF2).
    // `text=` subsets glyphs to this title so the download stays small.
    const cssRes = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@700&text=${encodeURIComponent(text)}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0',
        },
        next: { revalidate: 86400 },
      }
    )
    if (!cssRes.ok) return null
    const css = await cssRes.text()
    const fontUrl = css.match(/src:\s*url\(([^)]+)\)/)?.[1]
    if (!fontUrl) return null
    const fontRes = await fetch(fontUrl, { next: { revalidate: 86400 } })
    if (!fontRes.ok) return null
    return fontRes.arrayBuffer()
  } catch {
    return null
  }
}

function absoluteUrl(url: string) {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${siteMetadata.siteUrl.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`
}

function fallbackBackground() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, #e8eef8 0%, #f4f7fc 45%, #dfe8f6 100%)',
      }}
    />
  )
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const slug = (searchParams.get('slug') || '').trim()
  const localeParam = searchParams.get('locale') || defaultLocale
  const locale: PostLocale = isAppLocale(localeParam) ? localeParam : defaultLocale
  const titleOverride = (searchParams.get('title') || '').trim()

  let title = titleOverride || siteMetadata.title
  let coverUrl = ''

  if (slug) {
    const post = await getPostBySlug(slug, { locale, includeDrafts: true })
    if (post) {
      title = titleOverride || post.title
      const resolved = resolveBlogImageSrc(post.coverImage, post.path) || post.coverImage
      coverUrl = absoluteUrl(resolved || '')
    }
  }

  if (!coverUrl) {
    coverUrl = absoluteUrl(siteMetadata.socialBanner || siteMetadata.postDefaultCover || '')
  }

  const fontData = await loadFontForText(title)
  const fonts = fontData
    ? [
        {
          name: 'Noto Sans SC',
          data: fontData,
          weight: 700 as const,
          style: 'normal' as const,
        },
      ]
    : undefined

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background: '#eef2f8',
        }}
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img
            src={coverUrl}
            width={WIDTH}
            height={HEIGHT}
            style={{
              position: 'absolute',
              inset: 0,
              width: WIDTH,
              height: HEIGHT,
              objectFit: 'cover',
            }}
          />
        ) : (
          fallbackBackground()
        )}

        {/* Match CoverWithTitle / generated cover glass panel inset (~7% / 14%) */}
        <div
          style={{
            position: 'absolute',
            left: Math.round(WIDTH * 0.07),
            top: Math.round(HEIGHT * 0.14),
            width: Math.round(WIDTH * 0.86),
            height: Math.round(HEIGHT * 0.72),
            display: 'flex',
            alignItems: 'center',
            paddingLeft: Math.round(WIDTH * 0.86 * 0.08),
            paddingRight: Math.round(WIDTH * 0.86 * 0.08),
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: title.length > 40 ? 48 : title.length > 24 ? 56 : 64,
              fontWeight: 700,
              lineHeight: 1.22,
              color: '#10151c',
              fontFamily: fonts ? 'Noto Sans SC' : 'sans-serif',
              textShadow: '0 1px 2px rgba(255,255,255,0.55)',
              maxWidth: '100%',
              wordBreak: 'break-word',
            }}
          >
            {title}
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    }
  )
}
