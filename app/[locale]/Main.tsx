'use client'

import CoverWithTitle from '@/components/CoverWithTitle'
import Link from '@/components/Link'
import Tag from '@/components/Tag'
import siteMetadata from '@/data/siteMetadata'
import { formatDate } from 'pliny/utils/formatDate'
import NewsletterForm from 'pliny/ui/NewsletterForm'
import { useLocale, useTranslations } from 'next-intl'
import type { PostListItem } from '@/lib/types'

const MAX_DISPLAY = 10

export default function Home({ posts }: { posts: PostListItem[] }) {
  const t = useTranslations('home')
  const tBlog = useTranslations('blog')
  const locale = useLocale()

  return (
    <>
      <div>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {!posts.length && (
            <li className="text-[var(--ink-soft)] sm:col-span-2 lg:col-span-3">{t('noPosts')}</li>
          )}
          {posts.slice(0, MAX_DISPLAY).map((post) => {
            const { slug, date, title, summary, tags, coverImage } = post
            return (
              <li key={slug}>
                <article className="glass glass-card flex h-full flex-col overflow-hidden">
                  <Link href={`/blog/${slug}`} aria-label={tBlog('viewPost', { title })}>
                    <CoverWithTitle
                      src={coverImage}
                      title={title}
                      variant="card"
                      className="aspect-video w-full"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-4">
                    <p className="text-sm text-[var(--ink-soft)]">
                      <time dateTime={date}>{formatDate(date, locale)}</time>
                    </p>
                    <p className="line-clamp-2 text-sm text-[var(--ink-soft)]">{summary}</p>
                    {tags.length > 0 && (
                      <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                        {tags.map((tag) => (
                          <Tag key={tag} text={tag} />
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      </div>
      {posts.length > MAX_DISPLAY && (
        <div className="mt-6 flex justify-end text-base leading-6 font-medium">
          <Link
            href="/blog"
            className="glass glass-pill text-primary-600 hover:text-primary-700 dark:text-primary-400 px-4 py-2"
            aria-label={t('allPosts')}
          >
            {t('allPosts')} &rarr;
          </Link>
        </div>
      )}
      {siteMetadata.newsletter?.provider && (
        <div className="flex items-center justify-center pt-4">
          <NewsletterForm />
        </div>
      )}
    </>
  )
}
