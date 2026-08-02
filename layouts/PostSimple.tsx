import { ReactNode } from 'react'
import { formatDate } from 'pliny/utils/formatDate'
import ArticleTOC from '@/components/ArticleTOC'
import Comments from '@/components/Comments'
import Link from '@/components/Link'
import PageTitle from '@/components/PageTitle'
import SectionContainer from '@/components/SectionContainer'
import siteMetadata from '@/data/siteMetadata'
import ScrollTopAndComment from '@/components/ScrollTopAndComment'
import YouTubeEmbed from '@/components/YouTubeEmbed'
import type { Author, PostDetail } from '@/lib/types'

interface LayoutProps {
  content: PostDetail
  authorDetails: Author[]
  children: ReactNode
  next?: { path: string; title: string }
  prev?: { path: string; title: string }
}

export default function PostLayout({ content, authorDetails, next, prev, children }: LayoutProps) {
  const { path, slug, date, title, toc, youtube } = content

  return (
    <SectionContainer>
      <ScrollTopAndComment />
      {toc && toc.length > 0 && <ArticleTOC toc={toc} />}
      <article className="glass glass-card overflow-hidden px-5 py-8 sm:px-8">
        <div>
          <header>
            <div className="space-y-2 border-b border-white/40 pb-8 text-center dark:border-white/10">
              <div>
                <PageTitle>{title}</PageTitle>
              </div>
              <dl>
                <div className="text-base leading-6 font-medium text-[var(--ink-soft)]">
                  <dt className="sr-only">Authors</dt>
                  <dd className="inline">
                    {authorDetails.map((author) => author.name).join(', ')}
                  </dd>
                  <dt className="sr-only">Published on</dt>
                  <dd className="inline">
                    <span aria-hidden="true"> · </span>
                    <time dateTime={date}>{formatDate(date, siteMetadata.locale)}</time>
                  </dd>
                </div>
              </dl>
            </div>
          </header>
          <div className="grid-rows-[auto_1fr] divide-y divide-gray-200 pb-8 xl:divide-y-0 dark:divide-gray-700">
            <div className="divide-y divide-gray-200 xl:col-span-3 xl:row-span-2 xl:pb-0 dark:divide-gray-700">
              {youtube && (
                <div className="pt-10 pb-8">
                  <YouTubeEmbed url={youtube} title={title} />
                </div>
              )}
              <div className={`prose dark:prose-invert max-w-none pb-8 ${youtube ? '' : 'pt-10'}`}>
                {children}
              </div>
            </div>
            {siteMetadata.comments && (
              <div className="pt-6 pb-6 text-center text-gray-700 dark:text-gray-300" id="comment">
                <Comments slug={slug} />
              </div>
            )}
            <footer>
              <div className="flex flex-col text-sm font-medium sm:flex-row sm:justify-between sm:text-base">
                {prev && prev.path && (
                  <div className="pt-4 xl:pt-8">
                    <Link
                      href={`/${prev.path}`}
                      className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
                      aria-label={`Previous post: ${prev.title}`}
                    >
                      &larr; {prev.title}
                    </Link>
                  </div>
                )}
                {next && next.path && (
                  <div className="pt-4 xl:pt-8">
                    <Link
                      href={`/${next.path}`}
                      className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
                      aria-label={`Next post: ${next.title}`}
                    >
                      {next.title} &rarr;
                    </Link>
                  </div>
                )}
              </div>
            </footer>
          </div>
        </div>
      </article>
    </SectionContainer>
  )
}
