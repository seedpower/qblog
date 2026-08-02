import { notFound } from 'next/navigation'
import AdminPostEditor from '@/components/admin/AdminPostEditor'
import { getPostById } from '@/lib/posts'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Edit Post',
  robots: { index: false, follow: false },
}

export default async function EditPostPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const post = await getPostById(id)
  if (!post) notFound()
  return <AdminPostEditor postId={id} initialPost={post} />
}
