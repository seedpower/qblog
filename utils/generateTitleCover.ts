/** Client-side title → cover PNG (no AI). */

export type TitleCoverOptions = {
  title: string
  width?: number
  height?: number
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return ['Untitled']

  const chars = Array.from(normalized)
  const lines: string[] = []
  let current = ''

  const push = (line: string) => {
    const trimmed = line.trim()
    if (trimmed) lines.push(trimmed)
  }

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    const next = current + ch
    if (ctx.measureText(next).width <= maxWidth) {
      current = next
      continue
    }

    // Prefer breaking at space when possible
    if (/\s/.test(ch) && current) {
      push(current)
      current = ''
      continue
    }

    if (current) push(current)
    current = /\s/.test(ch) ? '' : ch

    if (lines.length >= maxLines - 1) {
      // Remaining text into last line with ellipsis if needed
      let rest = current + chars.slice(i + 1).join('')
      while (rest.length > 1 && ctx.measureText(`${rest}…`).width > maxWidth) {
        rest = rest.slice(0, -1)
      }
      push(ctx.measureText(rest).width > maxWidth ? `${rest.slice(0, -1)}…` : `${rest}…`)
      return lines.slice(0, maxLines)
    }
  }

  if (current) push(current)
  return lines.slice(0, maxLines)
}

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

  // Glass panel
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

  return { padX, padY, panelW, panelH }
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

export async function generateTitleCoverBlob(options: TitleCoverOptions): Promise<Blob> {
  const width = options.width ?? 1200
  const height = options.height ?? 630
  const title = options.title.trim() || 'Untitled'

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')

  const { padX, padY, panelW, panelH } = paintBackground(ctx, width, height)

  // Title
  const titleSize = Math.round(height * 0.095)
  const lineHeight = titleSize * 1.22
  ctx.fillStyle = '#10151c'
  ctx.font = `700 ${titleSize}px -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Noto Sans SC", "Segoe UI", sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  const maxTextWidth = panelW * 0.84
  const lines = wrapLines(ctx, title, maxTextWidth, 4)
  const textBlockHeight = lines.length * lineHeight
  let textY = padY + panelH * 0.22
  const remaining = padY + panelH * 0.88 - textY
  if (textBlockHeight < remaining) {
    textY += (remaining - textBlockHeight) * 0.35
  }

  ctx.shadowColor = 'rgba(18, 42, 84, 0.12)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 4
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], padX + panelW * 0.08, textY + i * lineHeight)
  }
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result)
      else reject(new Error('Failed to encode cover PNG'))
    }, 'image/png')
  })
  return blob
}

export async function generateTitleCoverFile(
  options: TitleCoverOptions,
  filename = 'cover.png'
): Promise<File> {
  const blob = await generateTitleCoverBlob(options)
  return new File([blob], filename, { type: 'image/png' })
}
