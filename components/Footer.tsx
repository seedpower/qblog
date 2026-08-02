import Link from './Link'
import siteMetadata from '@/data/siteMetadata'
import SocialIcon from '@/components/social-icons'

export default function Footer() {
  const basePath = process.env.BASE_PATH || ''

  return (
    <footer className="mt-16 mb-8">
      <div className="glass glass-card flex flex-col items-center gap-3 px-5 py-6">
        <div className="flex space-x-4">
          <SocialIcon kind="x" href={siteMetadata.x || siteMetadata.twitter} size={6} />
          <SocialIcon kind="rss" href={`${basePath}/api/feed`} size={6} />
          <SocialIcon kind="sitemap" href={`${basePath}/sitemap.xml`} size={6} />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-2 text-sm text-[var(--ink-soft)]">
          <div>{siteMetadata.author}</div>
          <div aria-hidden>•</div>
          <div>{`© ${new Date().getFullYear()}`}</div>
          <div aria-hidden>•</div>
          <Link href="/" className="hover:text-[var(--ink)]">
            {siteMetadata.title}
          </Link>
        </div>
      </div>
    </footer>
  )
}
