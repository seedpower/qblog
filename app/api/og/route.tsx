import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import siteMetadata from '@/data/siteMetadata'
import { getPostCardBySlug } from '@/lib/posts'
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

/**
 * next/og (Satori) is unreliable with remote WebP. Fetch/read + sharp → JPEG data URL.
 */
async function loadCoverBytes(coverUrl: string): Promise<Buffer | null> {
  if (!coverUrl) return null

  // Prefer local public/ for site static assets (avoids self-fetch during build/dev).
  try {
    const siteOrigin = siteMetadata.siteUrl.replace(/\/$/, '')
    let pathname = ''
    if (coverUrl.startsWith('/')) {
      pathname = coverUrl.split('?')[0] || ''
    } else if (coverUrl.startsWith(siteOrigin)) {
      pathname = new URL(coverUrl).pathname
    }
    if (pathname.startsWith('/static/')) {
      const filePath = path.join(process.cwd(), 'public', pathname)
      const input = await readFile(filePath)
      return input.byteLength >= 32 && input.byteLength <= 8 * 1024 * 1024 ? input : null
    }
  } catch {
    // fall through to network fetch
  }

  try {
    const res = await fetch(coverUrl, {
      headers: { Accept: 'image/*,*/*' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const input = Buffer.from(await res.arrayBuffer())
    return input.byteLength >= 32 && input.byteLength <= 8 * 1024 * 1024 ? input : null
  } catch (error) {
    console.error('[og] cover fetch failed', coverUrl, error)
    return null
  }
}

async function toCoverDataUrl(coverUrl: string): Promise<string | null> {
  const input = await loadCoverBytes(coverUrl)
  if (!input) return null
  try {
    const jpeg = await sharp(input, { limitInputPixels: 268402689 })
      .rotate()
      .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  } catch (error) {
    console.error('[og] cover convert failed', coverUrl, error)
    return null
  }
}

/** Always-on decorative stage so OG never looks like “title on blank”. */
function paintedBackground() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        background: 'linear-gradient(135deg, #e8eef8 0%, #f4f7fc 45%, #dfe8f6 100%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 720,
          height: 720,
          borderRadius: 9999,
          left: -160,
          top: -220,
          background: 'rgba(10, 132, 255, 0.28)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 640,
          height: 640,
          borderRadius: 9999,
          right: -180,
          top: -80,
          background: 'rgba(48, 209, 189, 0.24)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 560,
          height: 560,
          borderRadius: 9999,
          right: 40,
          bottom: -220,
          background: 'rgba(255, 149, 0, 0.2)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: Math.round(WIDTH * 0.07),
          top: Math.round(HEIGHT * 0.14),
          width: Math.round(WIDTH * 0.86),
          height: Math.round(HEIGHT * 0.72),
          borderRadius: 36,
          background: 'rgba(255,255,255,0.62)',
          border: '1.5px solid rgba(255,255,255,0.85)',
        }}
      />
    </div>
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
    const post = await getPostCardBySlug(slug, { locale, includeDrafts: true })
    if (post) {
      title = titleOverride || post.title
      const resolved = resolveBlogImageSrc(post.coverImage, post.path) || post.coverImage
      coverUrl = absoluteUrl(resolved || '')
    }
  }

  if (!coverUrl) {
    coverUrl = absoluteUrl(siteMetadata.socialBanner || siteMetadata.postDefaultCover || '')
  }

  const [fontData, coverDataUrl] = await Promise.all([
    loadFontForText(title),
    toCoverDataUrl(coverUrl),
  ])

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
        {coverDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img
            src={coverDataUrl}
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
          paintedBackground()
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
