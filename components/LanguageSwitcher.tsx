'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { locales, type AppLocale } from '@/i18n/routing'

const labels: Record<AppLocale, string> = {
  'zh-CN': '中文',
  en: 'EN',
}

export default function LanguageSwitcher() {
  const t = useTranslations('common')
  const locale = useLocale() as AppLocale
  const pathname = usePathname()
  const router = useRouter()

  return (
    <label className="inline-flex items-center gap-1 text-sm text-gray-700 dark:text-gray-200">
      <span className="sr-only">{t('language')}</span>
      <select
        aria-label={t('language')}
        className="rounded border border-gray-300 bg-transparent px-1.5 py-1 dark:border-gray-600"
        value={locale}
        onChange={(event) => {
          const next = event.target.value as AppLocale
          router.replace(pathname, { locale: next })
        }}
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {labels[code]}
          </option>
        ))}
      </select>
    </label>
  )
}
