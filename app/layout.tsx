import 'css/tailwind.css'
import 'pliny/search/algolia.css'
import 'remark-github-blockquote-alert/alert.css'

import { Caveat, Space_Grotesk } from 'next/font/google'
import siteMetadata from '@/data/siteMetadata'
import { ThemeProviders } from './theme-providers'
import { Metadata } from 'next'

const space_grotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
})

const caveat = Caveat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-caveat',
})

const basePath = process.env.BASE_PATH || ''

export const metadata: Metadata = {
  metadataBase: new URL(siteMetadata.siteUrl),
  title: {
    default: siteMetadata.title,
    template: `%s | ${siteMetadata.title}`,
  },
  description: siteMetadata.description,
  openGraph: {
    title: siteMetadata.title,
    description: siteMetadata.description,
    url: './',
    siteName: siteMetadata.title,
    images: [siteMetadata.socialBanner],
    type: 'website',
  },
  alternates: {
    canonical: './',
    types: {
      'application/rss+xml': `${siteMetadata.siteUrl}/api/feed`,
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  twitter: {
    title: siteMetadata.title,
    card: 'summary_large_image',
    images: [siteMetadata.socialBanner],
  },
  icons: {
    icon: [
      { url: `${basePath}/static/favicons/favicon.svg`, type: 'image/svg+xml' },
      { url: `${basePath}/static/favicons/favicon-32x32.png`, sizes: '32x32', type: 'image/png' },
      { url: `${basePath}/static/favicons/favicon-16x16.png`, sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: `${basePath}/static/favicons/apple-touch-icon.png`, sizes: '180x180' }],
  },
  manifest: `${basePath}/static/favicons/site.webmanifest`,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang={siteMetadata.language}
      className={`${space_grotesk.variable} ${caveat.variable} scroll-smooth`}
      suppressHydrationWarning
    >
      <body className="bg-transparent pl-[calc(100vw-100%)] antialiased">
        <ThemeProviders>{children}</ThemeProviders>
      </body>
    </html>
  )
}
