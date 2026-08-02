import AuthorLayout from '@/layouts/AuthorLayout'
import MDXContent from '@/components/MDXContent'
import { genPageMetadata } from 'app/seo'
import { getAuthorBySlug } from '@/lib/authors'
import { notFound } from 'next/navigation'

export const metadata = genPageMetadata({ title: 'About' })

export default function Page() {
  const author = getAuthorBySlug('default')
  if (!author) notFound()

  return (
    <AuthorLayout content={author}>
      <MDXContent source={author.body} />
    </AuthorLayout>
  )
}
