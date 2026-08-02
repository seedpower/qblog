import Link from '@/components/Link'
import Tag from '@/components/Tag'
import { slug } from 'github-slugger'
import { genPageMetadata } from 'app/seo'
import { getTagCounts } from '@/lib/posts'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { defaultLocale, isAppLocale } from '@/i18n/routing'

export const dynamic = 'force-dynamic'

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params
  const t = await getTranslations({ locale, namespace: 'tags' })
  return genPageMetadata({ title: t('title') })
}

export default async function Page(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params
  const appLocale = isAppLocale(locale) ? locale : defaultLocale
  setRequestLocale(appLocale)
  const t = await getTranslations('tags')
  const tagCounts = await getTagCounts({ locale: appLocale })
  const tagKeys = Object.keys(tagCounts)
  const sortedTags = tagKeys.sort((a, b) => tagCounts[b] - tagCounts[a])
  return (
    <>
      <div className="flex flex-col items-start justify-start divide-y divide-gray-200 md:mt-24 md:flex-row md:items-center md:justify-center md:space-x-6 md:divide-y-0 dark:divide-gray-700">
        <div className="space-x-2 pt-6 pb-8 md:space-y-5">
          <h1 className="text-3xl leading-9 font-extrabold tracking-tight text-gray-900 sm:text-4xl sm:leading-10 md:border-r-2 md:px-6 md:text-6xl md:leading-14 dark:text-gray-100">
            {t('title')}
          </h1>
        </div>
        <div className="flex max-w-lg flex-wrap">
          {tagKeys.length === 0 && t('empty')}
          {sortedTags.map((tag) => {
            return (
              <div key={tag} className="mt-2 mr-5 mb-2">
                <Tag text={tag} />
                <Link
                  href={`/tags/${slug(tag)}`}
                  className="-ml-2 text-sm font-semibold text-gray-600 uppercase dark:text-gray-300"
                  aria-label={t('viewTagged', { tag })}
                >
                  {` (${tagCounts[tag]})`}
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
