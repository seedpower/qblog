'use client'

import siteMetadata from '@/data/siteMetadata'
import headerNavLinks from '@/data/headerNavLinks'
import Link from './Link'
import NextLink from 'next/link'
import MobileNav from './MobileNav'
import ThemeSwitch from './ThemeSwitch'
import SearchButton from './SearchButton'
import LanguageSwitcher from './LanguageSwitcher'
import { useTranslations } from 'next-intl'

const navItemClass =
  'rounded-full px-3 py-1.5 text-sm font-medium text-[var(--ink-soft)] transition hover:bg-white/55 hover:text-[var(--ink)] dark:hover:bg-white/12'

export default function Header({ isAdmin = false }: { isAdmin?: boolean }) {
  const t = useTranslations('nav')

  return (
    <header className="sticky top-0 z-50 py-3">
      <div className="glass glass-pill flex items-center justify-between gap-3 px-3 py-2 sm:px-4 sm:py-2.5">
        <Link href="/" aria-label={siteMetadata.headerTitle} className="min-w-0 shrink-0">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/static/favicons/favicon.svg"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7"
            />
            {typeof siteMetadata.headerTitle === 'string' ? (
              <span className="hidden truncate text-lg font-bold tracking-tight text-[var(--ink)] sm:inline">
                {siteMetadata.headerTitle}
              </span>
            ) : (
              siteMetadata.headerTitle
            )}
          </div>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <nav className="no-scrollbar hidden items-center gap-0.5 overflow-x-auto sm:flex">
            {headerNavLinks
              .filter((link) => link.href !== '/')
              .map((link) => (
                <Link key={link.titleKey} href={link.href} className={navItemClass}>
                  {t(link.titleKey)}
                </Link>
              ))}
            {isAdmin && (
              <NextLink href="/admin" className={navItemClass}>
                {t('admin')}
              </NextLink>
            )}
          </nav>
          <LanguageSwitcher />
          <SearchButton />
          <ThemeSwitch />
          <MobileNav isAdmin={isAdmin} />
        </div>
      </div>
    </header>
  )
}
