import AuthorLayout from '@/layouts/AuthorLayout'
import MDXContent from '@/components/MDXContent'
import { genPageMetadata } from 'app/seo'
import { getAuthorBySlug } from '@/lib/authors'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isAppLocale } from '@/i18n/routing'

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params
  const t = await getTranslations({ locale, namespace: 'about' })
  return genPageMetadata({ title: t('title') })
}

export default async function Page(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params
  const appLocale = isAppLocale(locale) ? locale : 'zh-CN'
  setRequestLocale(appLocale)
  const author = getAuthorBySlug('default')
  if (!author) notFound()

  return (
    <AuthorLayout content={author}>
      <MDXContent source={author.body} />
    </AuthorLayout>
  )
}
