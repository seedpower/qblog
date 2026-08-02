import {
  Mail,
  Github,
  Facebook,
  Youtube,
  Linkedin,
  Twitter,
  X,
  Mastodon,
  Threads,
  Instagram,
  Medium,
  Bluesky,
  Rss,
  Sitemap,
} from './icons'

const components = {
  mail: Mail,
  github: Github,
  facebook: Facebook,
  youtube: Youtube,
  linkedin: Linkedin,
  twitter: Twitter,
  x: X,
  mastodon: Mastodon,
  threads: Threads,
  instagram: Instagram,
  medium: Medium,
  bluesky: Bluesky,
  rss: Rss,
  sitemap: Sitemap,
}

type SocialIconProps = {
  kind: keyof typeof components
  href: string | undefined
  size?: number
}

const SocialIcon = ({ kind, href, size = 8 }: SocialIconProps) => {
  if (
    !href ||
    (kind === 'mail' && !/^mailto:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(href))
  )
    return null

  const SocialSvg = components[kind]
  const isExternal = /^https?:\/\//i.test(href)
  const isOutline = kind === 'x' || kind === 'rss' || kind === 'sitemap'
  const labels: Partial<Record<keyof typeof components, string>> = {
    x: 'X',
    rss: 'RSS',
    sitemap: 'Sitemap',
  }

  return (
    <a
      className="text-sm text-gray-500 transition hover:text-gray-600"
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      href={href}
    >
      <span className="sr-only">{labels[kind] || kind}</span>
      <SocialSvg
        className={`hover:text-primary-500 dark:hover:text-primary-400 h-${size} w-${size} text-[var(--ink-soft)] transition hover:text-[var(--ink)] ${
          isOutline ? 'fill-none stroke-current' : 'fill-current'
        }`}
      />
    </a>
  )
}

export default SocialIcon
