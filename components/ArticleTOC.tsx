import TOCInline from 'pliny/ui/TOCInline'

type TocItem = {
  value: string
  url: string
  depth: number
}

interface ArticleTOCProps {
  toc: TocItem[]
}

export default function ArticleTOC({ toc }: ArticleTOCProps) {
  if (!toc || toc.length === 0) {
    return null
  }

  return (
    <aside
      aria-label="Table of contents"
      className="fixed top-28 z-0 hidden max-h-[calc(100vh-7rem)] w-52 overflow-y-auto 2xl:block 2xl:left-[calc(50%+34rem)]"
    >
      <p className="mb-3 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
        目录
      </p>
      <TOCInline
        toc={toc}
        ulClassName="space-y-1.5 [&_a]:text-sm [&_a]:leading-snug [&_a]:text-gray-600 [&_a]:no-underline dark:[&_a]:text-gray-400 [&_ul]:mt-1.5 [&_ul]:ml-3 [&_ul]:list-none [&_ul]:space-y-1.5"
      />
    </aside>
  )
}
