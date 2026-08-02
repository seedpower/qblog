import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Analytics, AnalyticsConfig } from 'pliny/analytics'
import { SearchProvider, SearchConfig } from 'pliny/search'
import Header from '@/components/Header'
import SectionContainer from '@/components/SectionContainer'
import Footer from '@/components/Footer'
import siteMetadata from '@/data/siteMetadata'
import { routing } from '@/i18n/routing'
import { requireAdmin } from '@/lib/auth'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  setRequestLocale(locale)
  const messages = await getMessages()
  const isAdmin = await requireAdmin()

  return (
    <NextIntlClientProvider messages={messages}>
      <Analytics analyticsConfig={siteMetadata.analytics as AnalyticsConfig} />
      <SectionContainer>
        <SearchProvider searchConfig={siteMetadata.search as SearchConfig}>
          <Header isAdmin={isAdmin} />
          <main className="mb-auto pt-8 sm:pt-10">{children}</main>
        </SearchProvider>
        <Footer />
      </SectionContainer>
    </NextIntlClientProvider>
  )
}
