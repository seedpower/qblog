import { notFound, redirect } from 'next/navigation'
import AdminPostEditor from '@/components/admin/AdminPostEditor'
import { getChineseSourcePostId, getPostById } from '@/lib/posts'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Edit Post',
  robots: { index: false, follow: false },
}

export default async function EditPostPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const post = await getPostById(id)
  if (!post) notFound()

  const sourceId = await getChineseSourcePostId(post)
  if (sourceId && sourceId !== id) {
    redirect(`/admin/posts/${sourceId}`)
  }

  return <AdminPostEditor postId={id} initialPost={post} />
}
