import { MetadataRoute } from 'next'
import siteMetadata from '@/data/siteMetadata'
import { getAllPosts } from '@/lib/posts'
import { defaultLocale, locales } from '@/i18n/routing'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = siteMetadata.siteUrl
  const routes: MetadataRoute.Sitemap = []

  for (const locale of locales) {
    const prefix = locale === defaultLocale ? '' : `/${locale}`
    const posts = await getAllPosts({ locale })

    for (const route of ['', 'blog', 'tags', 'about']) {
      routes.push({
        url: `${siteUrl}${prefix}/${route}`.replace(/\/$/, '') || siteUrl,
        lastModified: new Date().toISOString().split('T')[0],
      })
    }

    for (const post of posts) {
      routes.push({
        url: `${siteUrl}${prefix}/${post.path}`,
        lastModified: post.lastmod || post.date,
      })
    }
  }

  return routes
}
