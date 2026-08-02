import Image from '@/components/Image'
import type { Author } from '@/lib/types'
import { getTranslations } from 'next-intl/server'

interface Props {
  children: React.ReactNode
  content: Author
}

export default async function AuthorLayout({ children, content }: Props) {
  const t = await getTranslations('about')
  const { name, avatar } = content

  return (
    <div className="glass glass-card overflow-hidden px-5 py-8 sm:px-8">
      <div className="space-y-2 pb-6 md:space-y-3">
        <h1 className="text-3xl leading-tight font-bold tracking-tight text-[var(--ink)] sm:text-4xl md:text-5xl">
          {t('title')}
        </h1>
      </div>
      <div className="items-start space-y-6 xl:grid xl:grid-cols-3 xl:space-y-0 xl:gap-x-8">
        <div className="flex flex-col items-center pt-2">
          {avatar && (
            <Image
              src={avatar}
              alt="avatar"
              width={192}
              height={192}
              className="h-40 w-40 rounded-full shadow-[var(--shadow-soft)] sm:h-48 sm:w-48"
            />
          )}
          <h3 className="pt-4 pb-2 text-2xl leading-8 font-bold tracking-tight text-[var(--ink)]">
            {name}
          </h3>
        </div>
        <div className="prose dark:prose-invert max-w-none xl:col-span-2">{children}</div>
      </div>
    </div>
  )
}
