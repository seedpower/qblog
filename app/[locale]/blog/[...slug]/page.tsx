import 'css/prism.css'
import 'katex/dist/katex.css'

import MDXContent from '@/components/MDXContent'
import PostSimple from '@/layouts/PostSimple'
import PostLayout from '@/layouts/PostLayout'
import PostBanner from '@/layouts/PostBanner'
import { Metadata } from 'next'
import siteMetadata from '@/data/siteMetadata'
import { resolveBlogImageSrc } from '@/utils/resolveBlogImageSrc'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { getAllPosts, getPostBySlug } from '@/lib/posts'
import { getAuthorBySlug } from '@/lib/authors'
import { defaultLocale, isAppLocale } from '@/i18n/routing'
import AdminEditPostLink from '@/components/AdminEditPostLink'

const defaultLayout = 'PostSimple'
const layouts = {
  PostSimple,
  PostLayout,
  PostBanner,
}

export const dynamic = 'force-dynamic'

export async function generateMetadata(props: {
  params: Promise<{ locale: string; slug: string[] }>
}): Promise<Metadata | undefined> {
  const params = await props.params
  const locale = isAppLocale(params.locale) ? params.locale : defaultLocale
  const slug = decodeURI(params.slug.join('/'))
  const post = await getPostBySlug(slug, { locale })
  if (!post) return

  const authorList = post.authors || ['default']
  const authorDetails = authorList.map((author) => getAuthorBySlug(author)).filter(Boolean)
  const publishedAt = new Date(post.date).toISOString()
  const modifiedAt = new Date(post.lastmod || post.date).toISOString()
  const authors = authorDetails.map((author) => author!.name)
  const rawImageList = post.images && post.images.length > 0 ? post.images : [post.coverImage]
  const imageList = rawImageList.map((img) => resolveBlogImageSrc(img, post.path) ?? img)
  const ogImages = imageList.map((img) => ({
    url: img && img.includes('http') ? img : siteMetadata.siteUrl + img,
  }))

  return {
    title: post.title,
    description: post.summary,
    openGraph: {
      title: post.title,
      description: post.summary,
      siteName: siteMetadata.title,
      locale: locale === 'en' ? 'en_US' : 'zh_CN',
      type: 'article',
      publishedTime: publishedAt,
      modifiedTime: modifiedAt,
      url: './',
      images: ogImages,
      authors: authors.length > 0 ? authors : [siteMetadata.author],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.summary,
      images: imageList,
    },
  }
}

export default async function Page(props: { params: Promise<{ locale: string; slug: string[] }> }) {
  const params = await props.params
  const locale = isAppLocale(params.locale) ? params.locale : defaultLocale
  setRequestLocale(locale)
  const slug = decodeURI(params.slug.join('/'))
  const sorted = await getAllPosts({ locale })
  const postIndex = sorted.findIndex((p) => p.slug === slug)
  if (postIndex === -1) {
    return notFound()
  }

  const prev = sorted[postIndex + 1]
  const next = sorted[postIndex - 1]
  const post = await getPostBySlug(slug, { locale })
  if (!post) return notFound()

  const authorList = post.authors || ['default']
  const authorDetails = authorList
    .map((author) => getAuthorBySlug(author))
    .filter((author): author is NonNullable<typeof author> => Boolean(author))

  const jsonLd = {
    ...post.structuredData,
    author: authorDetails.map((author) => ({
      '@type': 'Person',
      name: author.name,
    })),
  }

  const Layout = layouts[(post.layout as keyof typeof layouts) || defaultLayout] || PostSimple

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AdminEditPostLink postId={post._id} />
      <Layout content={post} authorDetails={authorDetails} next={next} prev={prev}>
        <MDXContent source={post.body} blogPath={post.path} />
      </Layout>
    </>
  )
}
