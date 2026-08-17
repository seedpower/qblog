import siteMetadata from '@/data/siteMetadata'
import ListLayout from '@/layouts/ListLayoutWithTags'
import { genPageMetadata } from 'app/seo'
import { Metadata } from 'next'
import { getPostsByTag, getTagCounts } from '@/lib/posts'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { defaultLocale, isAppLocale } from '@/i18n/routing'

const POSTS_PER_PAGE = 5

export const dynamic = 'force-dynamic'

export async function generateMetadata(props: {
  params: Promise<{ locale: string; tag: string }>
}): Promise<Metadata> {
  const params = await props.params
  const tag = decodeURI(params.tag)
  return genPageMetadata({
    title: tag,
    description: `${siteMetadata.title} ${tag} tagged content`,
    alternates: {
      canonical: './',
      types: {
        'application/rss+xml': `${siteMetadata.siteUrl}/api/feed?tag=${tag}&locale=${params.locale}`,
      },
    },
  })
}

export default async function TagPage(props: { params: Promise<{ locale: string; tag: string }> }) {
  const params = await props.params
  const locale = isAppLocale(params.locale) ? params.locale : defaultLocale
  setRequestLocale(locale)
  const t = await getTranslations('blog')
  const tag = decodeURI(params.tag)
  const title = tag[0].toUpperCase() + tag.split(' ').join('-').slice(1)
  const filteredPosts = await getPostsByTag(tag, { locale })
  const tagCounts = await getTagCounts({ locale })
  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE)
  const initialDisplayPosts = filteredPosts.slice(0, POSTS_PER_PAGE)

  return (
    <ListLayout
      posts={initialDisplayPosts}
      initialDisplayPosts={initialDisplayPosts}
      pagination={{ currentPage: 1, totalPages }}
      title={title || t('allPosts')}
      tagCounts={tagCounts}
    />
  )
}
