import Image from '@/components/Image'

type CoverVariant = 'card' | 'hero' | 'thumb'

const variantTitleClass: Record<CoverVariant, string> = {
  card: 'line-clamp-3 text-base leading-snug font-bold tracking-tight sm:text-lg md:text-xl',
  hero: 'line-clamp-4 text-3xl leading-tight font-bold tracking-tight sm:text-4xl md:text-5xl',
  thumb: 'line-clamp-3 text-[10px] leading-tight font-bold tracking-tight sm:text-xs',
}

/**
 * Cover art + DOM title overlay.
 * Title sits in the glass panel region of generated covers (~7% x / 14% y inset)
 * so the same PNG works for every locale.
 */
export default function CoverWithTitle({
  src,
  title,
  sizes,
  className = '',
  priority = false,
  variant = 'card',
  titleAs: TitleTag = 'span',
}: {
  src: string
  title: string
  sizes?: string
  className?: string
  priority?: boolean
  variant?: CoverVariant
  titleAs?: 'span' | 'h1' | 'h2' | 'p'
}) {
  return (
    <div className={`relative overflow-hidden ${className}`.trim()}>
      <Image
        src={src}
        alt=""
        fill
        priority={priority}
        className="object-cover"
        sizes={sizes}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-[7%] inset-y-[14%] flex items-center px-[8%]"
        aria-hidden={TitleTag === 'span'}
      >
        <TitleTag
          className={`${variantTitleClass[variant]} text-[#10151c] [text-shadow:0_1px_2px_rgba(255,255,255,0.55)]`}
        >
          {title}
        </TitleTag>
      </div>
      {/* Accessible name when visual title is decorative span inside a link */}
      {TitleTag === 'span' ? <span className="sr-only">{title}</span> : null}
    </div>
  )
}
