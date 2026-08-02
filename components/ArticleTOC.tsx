import { getTranslations } from 'next-intl/server'
import TOCInline from 'pliny/ui/TOCInline'

type TocItem = {
  value: string
  url: string
  depth: number
}

interface ArticleTOCProps {
  toc: TocItem[]
}

export default async function ArticleTOC({ toc }: ArticleTOCProps) {
  if (!toc || toc.length === 0) {
    return null
  }

  const t = await getTranslations('blog')

  return (
    <aside
      aria-label={t('toc')}
      className="glass glass-card fixed top-28 left-[calc(50%+34rem)] z-0 hidden max-h-[calc(100vh-7rem)] w-52 overflow-y-auto p-4 2xl:block"
    >
      <p className="mb-3 text-xs font-semibold tracking-wide text-[var(--ink-soft)] uppercase">
        {t('toc')}
      </p>
      <TOCInline
        toc={toc}
        ulClassName="space-y-1.5 [&_a]:text-sm [&_a]:leading-snug [&_a]:text-[var(--ink-soft)] [&_a]:no-underline [&_a:hover]:text-primary-600 dark:[&_a:hover]:text-primary-400 [&_ul]:mt-1.5 [&_ul]:ml-3 [&_ul]:list-none [&_ul]:space-y-1.5"
      />
    </aside>
  )
}
