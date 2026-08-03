'use client'

import { Fragment } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react'
import { usePathname, useRouter } from '@/i18n/navigation'
import { localeLabels, locales, type AppLocale } from '@/i18n/routing'

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
        {localeLabels[locale] || locale}
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
        <MenuItems className="absolute right-0 z-50 mt-2 max-h-80 w-44 origin-top-right overflow-y-auto rounded-2xl border border-black/8 bg-white p-1 shadow-[var(--shadow)] focus:outline-none dark:border-white/12 dark:bg-[#161b24]">
          {locales.map((code) => (
            <MenuItem key={code}>
              {({ focus }) => (
                <button
                  type="button"
                  className={`${focus ? 'bg-black/[0.06] dark:bg-white/10' : ''} ${
                    code === locale ? 'text-primary-600 dark:text-primary-400 font-semibold' : ''
                  } flex w-full items-center rounded-xl px-2.5 py-1.5 text-sm text-[var(--ink)]`}
                  onClick={() => {
                    if (code !== locale) {
                      router.replace(pathname, { locale: code })
                    }
                  }}
                >
                  {localeLabels[code]}
                </button>
              )}
            </MenuItem>
          ))}
        </MenuItems>
      </Transition>
    </Menu>
  )
}
