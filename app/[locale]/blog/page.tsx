import { setRequestLocale, getTranslations } from 'next-intl/server'
import ListLayout from '@/layouts/ListLayoutWithTags'
import { getAllPosts, getTagCounts } from '@/lib/posts'
import { defaultLocale, isAppLocale } from '@/i18n/routing'
import { genPageMetadata } from 'app/seo'

const POSTS_PER_PAGE = 5

export const dynamic = 'force-dynamic'

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params
  const t = await getTranslations({ locale, namespace: 'blog' })
  return genPageMetadata({ title: t('title') })
}

export default async function BlogPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params
  const appLocale = isAppLocale(locale) ? locale : defaultLocale
  setRequestLocale(appLocale)
  const t = await getTranslations('blog')

  const posts = await getAllPosts({ locale: appLocale })
  const tagCounts = await getTagCounts({ locale: appLocale })
  const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE)
  const initialDisplayPosts = posts.slice(0, POSTS_PER_PAGE)

  return (
    <ListLayout
      posts={posts}
      initialDisplayPosts={initialDisplayPosts}
      pagination={{ currentPage: 1, totalPages }}
      title={t('allPosts')}
      tagCounts={tagCounts}
    />
  )
}
