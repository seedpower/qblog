/** Client-side cover background (no AI, no baked-in title — title overlays via DOM). */

export type CoverBackgroundOptions = {
  width?: number
  height?: number
  /** WebP / JPEG quality 0–1. Default 0.78. */
  quality?: number
}

export type CoverEncodeFormat = 'image/webp' | 'image/jpeg'

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j]!, next[i]!]
  }
  return next
}

function rgba(r: number, g: number, b: number, a: number) {
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/** Soft site-adjacent accents (no purple-on-white cliché). */
const ACCENT_RGB: Array<[number, number, number]> = [
  [10, 132, 255], // apple blue
  [48, 209, 189], // teal
  [90, 200, 250], // sky
  [52, 199, 89], // green
  [255, 149, 0], // orange
  [255, 107, 129], // coral
  [100, 210, 255], // ice
  [0, 122, 255], // vivid blue
  [50, 173, 230], // cyan
  [255, 179, 64], // amber
]

const PAPER_STOPS: Array<[string, string, string]> = [
  ['#e8eef8', '#f4f7fc', '#dfe8f6'],
  ['#eef6f4', '#f7fbf9', '#e3efe9'],
  ['#f3f0ea', '#faf8f4', '#ebe4d8'],
  ['#eaf2fb', '#f6f9fd', '#dde8f5'],
  ['#f0f4f8', '#f8fafc', '#e4ebf2'],
  ['#edf3f8', '#f5f9fc', '#e0eaf3'],
]

function paintBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const paper = pick(PAPER_STOPS)
  const angle = rand(0, Math.PI * 2)
  const gx = width / 2 + Math.cos(angle) * width * 0.55
  const gy = height / 2 + Math.sin(angle) * height * 0.55
  const base = ctx.createLinearGradient(width - gx, height - gy, gx, gy)
  base.addColorStop(0, paper[0])
  base.addColorStop(0.45, paper[1])
  base.addColorStop(1, paper[2])
  ctx.fillStyle = base
  ctx.fillRect(0, 0, width, height)

  const accents = shuffle(ACCENT_RGB).slice(0, 3 + Math.floor(Math.random() * 2))
  const slots = shuffle([
    { x: rand(0.08, 0.28), y: rand(0.1, 0.35) },
    { x: rand(0.68, 0.92), y: rand(0.08, 0.32) },
    { x: rand(0.55, 0.88), y: rand(0.62, 0.92) },
    { x: rand(0.1, 0.4), y: rand(0.65, 0.95) },
    { x: rand(0.35, 0.65), y: rand(0.35, 0.65) },
  ]).slice(0, accents.length)

  for (let i = 0; i < accents.length; i++) {
    const [r, g, b] = accents[i]!
    const slot = slots[i]!
    const x = width * slot.x
    const y = height * slot.y
    const radius = width * rand(0.28, 0.48)
    const alpha = rand(0.16, 0.4)
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
    grad.addColorStop(0, rgba(r, g, b, alpha))
    grad.addColorStop(1, rgba(r, g, b, 0))
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  // Glass panel — empty stage for DOM title overlay later
  const padX = width * 0.07
  const padY = height * 0.14
  const panelW = width - padX * 2
  const panelH = height - padY * 2
  const radius = Math.min(36, height * 0.08)
  const panelAlphaTop = rand(0.66, 0.78)
  const panelAlphaBottom = rand(0.34, 0.5)

  ctx.save()
  roundRect(ctx, padX, padY, panelW, panelH, radius)
  ctx.clip()

  const panel = ctx.createLinearGradient(padX, padY, padX + panelW, padY + panelH)
  panel.addColorStop(0, `rgba(255,255,255,${panelAlphaTop})`)
  panel.addColorStop(1, `rgba(255,255,255,${panelAlphaBottom})`)
  ctx.fillStyle = panel
  ctx.fillRect(padX, padY, panelW, panelH)

  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 2
  roundRect(ctx, padX + 1, padY + 1, panelW - 2, panelH - 2, radius - 1)
  ctx.stroke()

  ctx.restore()

  ctx.strokeStyle = 'rgba(255,255,255,0.65)'
  ctx.lineWidth = 1.5
  roundRect(ctx, padX, padY, panelW, panelH, radius)
  ctx.stroke()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((result) => resolve(result), type, quality)
  })
}

function extensionForType(type: CoverEncodeFormat) {
  return type === 'image/webp' ? 'webp' : 'jpg'
}

/** Generated cover filenames we overwrite / replace in the images field. */
export const GENERATED_COVER_NAMES = new Set([
  'cover.webp',
  'cover.jpg',
  'cover.jpeg',
  'cover.png',
])

export function isGeneratedCoverName(name: string) {
  return GENERATED_COVER_NAMES.has(name.trim().toLowerCase())
}

/**
 * Encode as WebP (preferred) or JPEG — soft gradient covers compress well;
 * PNG was ~0.5–1MB for 1200×630.
 */
export async function generateTitleCoverBlob(
  options: CoverBackgroundOptions = {}
): Promise<{ blob: Blob; type: CoverEncodeFormat; extension: string }> {
  const width = options.width ?? 1200
  const height = options.height ?? 630
  const quality = options.quality ?? 0.78

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')

  // JPEG/WebP need an opaque backdrop (no alpha).
  paintBackground(ctx, width, height)

  const tryEncode = async (type: CoverEncodeFormat) => {
    const blob = await canvasToBlob(canvas, type, quality)
    // Some browsers leave blob.type empty even when encoding succeeds.
    if (!blob || blob.size < 100) return null
    if (blob.type && blob.type !== type) return null
    return blob
  }

  const webp = await tryEncode('image/webp')
  if (webp) {
    return { blob: webp, type: 'image/webp', extension: extensionForType('image/webp') }
  }

  const jpeg = await tryEncode('image/jpeg')
  if (jpeg) {
    return { blob: jpeg, type: 'image/jpeg', extension: extensionForType('image/jpeg') }
  }

  throw new Error('Failed to encode cover image')
}

export async function generateTitleCoverFile(
  options: CoverBackgroundOptions = {},
  filename?: string
): Promise<File> {
  const { blob, type, extension } = await generateTitleCoverBlob(options)
  const name = filename || `cover.${extension}`
  return new File([blob], name, { type })
}
