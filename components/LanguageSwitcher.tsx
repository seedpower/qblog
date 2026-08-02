'use client'

import { Fragment } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react'
import { usePathname, useRouter } from '@/i18n/navigation'
import { locales, type AppLocale } from '@/i18n/routing'

const labels: Record<AppLocale, string> = {
  en: 'EN',
  'zh-CN': '中文',
}

export default function LanguageSwitcher() {
  const t = useTranslations('common')
  const locale = useLocale() as AppLocale
  const pathname = usePathname()
  const router = useRouter()

  return (
    <Menu as="div" className="relative inline-block text-left">
      <MenuButton
        aria-label={t('language')}
        className="glass glass-pill inline-flex h-8 min-w-8 items-center justify-center px-2.5 text-sm font-semibold text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
      >
        {labels[locale] || locale}
      </MenuButton>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <MenuItems className="glass absolute right-0 z-50 mt-2 w-28 origin-top-right rounded-2xl p-1 focus:outline-none">
          {locales.map((code) => (
            <MenuItem key={code}>
              {({ focus }) => (
                <button
                  type="button"
                  className={`${focus ? 'bg-white/55 dark:bg-white/12' : ''} ${
                    code === locale ? 'text-primary-600 dark:text-primary-400 font-semibold' : ''
                  } flex w-full items-center rounded-xl px-2.5 py-1.5 text-sm text-[var(--ink)]`}
                  onClick={() => {
                    if (code !== locale) {
                      router.replace(pathname, { locale: code })
                    }
                  }}
                >
                  {labels[code]}
                </button>
              )}
            </MenuItem>
          ))}
        </MenuItems>
      </Transition>
    </Menu>
  )
}
