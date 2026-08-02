import { setRequestLocale } from 'next-intl/server'
import { getAllPosts } from '@/lib/posts'
import { isAppLocale } from '@/i18n/routing'
import Main from './Main'

export const dynamic = 'force-dynamic'

export default async function Page(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params
  const appLocale = isAppLocale(locale) ? locale : 'zh-CN'
  setRequestLocale(appLocale)
  const posts = await getAllPosts({ locale: appLocale })
  return <Main posts={posts} />
}
