const createNextIntlPlugin = require('next-intl/plugin')
const withNextIntl = createNextIntlPlugin('./i18n/request.ts')
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})
const siteMetadata = require('./data/siteMetadata')

// You might need to insert additional domains in script-src if you are using external services
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' giscus.app analytics.umami.is www.googletagmanager.com;
  style-src 'self' 'unsafe-inline';
  img-src * blob: data:;
  media-src *.s3.amazonaws.com;
  connect-src *;
  font-src 'self';
  frame-src giscus.app www.youtube.com youtube.com
`

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy.replace(/\n/g, ''),
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
]

const output = process.env.EXPORT ? 'export' : 'standalone'
const basePath = process.env.BASE_PATH || undefined
const unoptimized = process.env.UNOPTIMIZED ? true : undefined

const staticCdnHostname = (() => {
  try {
    return new URL(siteMetadata.staticCdn).hostname
  } catch {
    return undefined
  }
})()

/**
 * @type {import('next/dist/next-server/server/config').NextConfig}
 **/
module.exports = () => {
  const plugins = [withNextIntl, withBundleAnalyzer]
  return plugins.reduce((acc, next) => next(acc), {
    output,
    basePath,
    reactStrictMode: true,
    trailingSlash: true,
    turbopack: {
      root: process.cwd(),
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
    pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
    images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'picsum.photos',
        },
        ...(staticCdnHostname
          ? [
              {
                protocol: 'https',
                hostname: staticCdnHostname,
              },
            ]
          : []),
      ],
      unoptimized,
    },
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: securityHeaders,
        },
      ]
    },
    webpack: (config) => {
      config.module.rules.push({
        test: /\.svg$/,
        use: ['@svgr/webpack'],
      })
      return config
    },
  })
}
