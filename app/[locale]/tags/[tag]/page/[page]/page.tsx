import ListLayout from '@/layouts/ListLayoutWithTags'
import { notFound } from 'next/navigation'
import { getPostsByTag, getTagCounts } from '@/lib/posts'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { defaultLocale, isAppLocale } from '@/i18n/routing'

const POSTS_PER_PAGE = 5

export const dynamic = 'force-dynamic'

export default async function TagPage(props: {
  params: Promise<{ locale: string; tag: string; page: string }>
}) {
  const params = await props.params
  const locale = isAppLocale(params.locale) ? params.locale : defaultLocale
  setRequestLocale(locale)
  const t = await getTranslations('blog')
  const tag = decodeURI(params.tag)
  const title = tag[0].toUpperCase() + tag.split(' ').join('-').slice(1)
  const pageNumber = parseInt(params.page)
  const filteredPosts = await getPostsByTag(tag, { locale })
  const tagCounts = await getTagCounts({ locale })
  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE)

  if (pageNumber <= 0 || pageNumber > totalPages || isNaN(pageNumber)) {
    return notFound()
  }

  const pagePosts = filteredPosts.slice(
    POSTS_PER_PAGE * (pageNumber - 1),
    POSTS_PER_PAGE * pageNumber
  )

  return (
    <ListLayout
      posts={pagePosts}
      initialDisplayPosts={pagePosts}
      pagination={{ currentPage: pageNumber, totalPages }}
      title={title || t('allPosts')}
      tagCounts={tagCounts}
    />
  )
}
