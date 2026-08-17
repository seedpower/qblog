import { setRequestLocale, getTranslations } from 'next-intl/server'
import ListLayout from '@/layouts/ListLayoutWithTags'
import { notFound } from 'next/navigation'
import { getAllPosts, getTagCounts } from '@/lib/posts'
import { defaultLocale, isAppLocale } from '@/i18n/routing'

const POSTS_PER_PAGE = 5

export const dynamic = 'force-dynamic'

export default async function Page(props: { params: Promise<{ locale: string; page: string }> }) {
  const { locale, page } = await props.params
  const appLocale = isAppLocale(locale) ? locale : defaultLocale
  setRequestLocale(appLocale)
  const t = await getTranslations('blog')

  const posts = await getAllPosts({ locale: appLocale })
  const tagCounts = await getTagCounts({ locale: appLocale })
  const pageNumber = parseInt(page)
  const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE)

  if (pageNumber <= 0 || pageNumber > totalPages || isNaN(pageNumber)) {
    return notFound()
  }

  const initialDisplayPosts = posts.slice(
    POSTS_PER_PAGE * (pageNumber - 1),
    POSTS_PER_PAGE * pageNumber
  )

  return (
    <ListLayout
      posts={initialDisplayPosts}
      initialDisplayPosts={initialDisplayPosts}
      pagination={{ currentPage: pageNumber, totalPages }}
      title={t('allPosts')}
      tagCounts={tagCounts}
    />
  )
}
