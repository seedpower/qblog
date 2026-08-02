'use client'

import { usePathname } from '@/i18n/navigation'
import { slug } from 'github-slugger'
import { formatDate } from 'pliny/utils/formatDate'
import CoverWithTitle from '@/components/CoverWithTitle'
import Link from '@/components/Link'
import Tag from '@/components/Tag'
import type { PostListItem } from '@/lib/types'
import { useLocale, useTranslations } from 'next-intl'

interface PaginationProps {
  totalPages: number
  currentPage: number
}
interface ListLayoutProps {
  posts: PostListItem[]
  title: string
  initialDisplayPosts?: PostListItem[]
  pagination?: PaginationProps
  tagCounts?: Record<string, number>
}

function Pagination({ totalPages, currentPage }: PaginationProps) {
  const pathname = usePathname()
  const basePath = pathname
    .replace(/^\//, '')
    .replace(/\/page\/\d+\/?$/, '')
    .replace(/\/$/, '')
  const prevPage = currentPage - 1 > 0
  const nextPage = currentPage + 1 <= totalPages

  return (
    <div className="space-y-2 pt-6 pb-8 md:space-y-5">
      <nav className="flex justify-between">
        {!prevPage && (
          <button className="cursor-auto disabled:opacity-50" disabled={!prevPage}>
            &larr;
          </button>
        )}
        {prevPage && (
          <Link
            href={currentPage - 1 === 1 ? `/${basePath}/` : `/${basePath}/page/${currentPage - 1}`}
            rel="prev"
          >
            &larr;
          </Link>
        )}
        <span>
          {currentPage} / {totalPages}
        </span>
        {!nextPage && (
          <button className="cursor-auto disabled:opacity-50" disabled={!nextPage}>
            &rarr;
          </button>
        )}
        {nextPage && (
          <Link href={`/${basePath}/page/${currentPage + 1}`} rel="next">
            &rarr;
          </Link>
        )}
      </nav>
    </div>
  )
}

export default function ListLayoutWithTags({
  posts,
  title,
  initialDisplayPosts = [],
  pagination,
  tagCounts = {},
}: ListLayoutProps) {
  const pathname = usePathname()
  const t = useTranslations('blog')
  const tTags = useTranslations('tags')
  const locale = useLocale()
  const tagKeys = Object.keys(tagCounts)
  const sortedTags = tagKeys.sort((a, b) => tagCounts[b] - tagCounts[a])
  const displayPosts = initialDisplayPosts.length > 0 ? initialDisplayPosts : posts

  return (
    <>
      <div>
        <div className="pt-6 pb-6">
          <h1 className="text-3xl leading-9 font-extrabold tracking-tight text-gray-900 sm:hidden sm:text-4xl sm:leading-10 md:text-6xl md:leading-14 dark:text-gray-100">
            {title}
          </h1>
        </div>
        <div className="flex sm:space-x-24">
          <div className="glass glass-card hidden h-full max-h-screen max-w-[280px] min-w-[280px] flex-wrap overflow-auto pt-5 sm:flex">
            <div className="px-6 py-4">
              {pathname.startsWith('/blog') ? (
                <h3 className="text-primary-600 dark:text-primary-400 font-bold uppercase">
                  {t('allPosts')}
                </h3>
              ) : (
                <Link
                  href={`/blog`}
                  className="hover:text-primary-600 dark:hover:text-primary-400 font-bold text-[var(--ink-soft)] uppercase transition"
                >
                  {t('allPosts')}
                </Link>
              )}
              <ul>
                {sortedTags.map((tag) => {
                  return (
                    <li key={tag} className="my-3">
                      {decodeURI(pathname.split('/tags/')[1]?.split('/')[0] ?? '') === slug(tag) ? (
                        <h3 className="text-primary-600 dark:text-primary-400 inline px-3 py-2 text-sm font-bold uppercase">
                          {`${tag} (${tagCounts[tag]})`}
                        </h3>
                      ) : (
                        <Link
                          href={`/tags/${slug(tag)}`}
                          className="hover:text-primary-600 dark:hover:text-primary-400 px-3 py-2 text-sm font-medium text-[var(--ink-soft)] uppercase transition"
                          aria-label={tTags('viewTagged', { tag })}
                        >
                          {`${tag} (${tagCounts[tag]})`}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <ul className="space-y-4">
              {displayPosts.map((post) => {
                const { path, date, title: postTitle, summary, tags, coverImage } = post
                return (
                  <li key={path}>
                    <article className="glass glass-card flex gap-4 p-4 sm:gap-6">
                      <Link
                        href={`/${path}`}
                        className="shrink-0"
                        aria-label={t('viewPost', { title: postTitle })}
                      >
                        <div className="relative aspect-video w-32 overflow-hidden rounded-xl sm:w-40">
                          <CoverWithTitle
                            src={coverImage}
                            title={postTitle}
                            variant="thumb"
                            className="h-full w-full"
                            sizes="(max-width: 640px) 128px, 160px"
                          />
                        </div>
                      </Link>
                      <div className="min-w-0 flex-1 space-y-2">
                        <dl>
                          <dt className="sr-only">{t('publishedOn')}</dt>
                          <dd className="text-sm font-medium text-[var(--ink-soft)]">
                            <time dateTime={date} suppressHydrationWarning>
                              {formatDate(date, locale)}
                            </time>
                          </dd>
                        </dl>
                        <div className="space-y-2">
                          <div>
                            <h2 className="text-xl leading-7 font-bold tracking-tight sm:text-2xl">
                              <Link
                                href={`/${path}`}
                                className="hover:text-primary-600 dark:hover:text-primary-400 text-[var(--ink)] transition"
                              >
                                {postTitle}
                              </Link>
                            </h2>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {tags?.map((tag) => (
                                <Tag key={tag} text={tag} />
                              ))}
                            </div>
                          </div>
                          <div className="text-[var(--ink-soft)]">{summary}</div>
                        </div>
                      </div>
                    </article>
                  </li>
                )
              })}
            </ul>
            {pagination && pagination.totalPages > 1 && (
              <Pagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
