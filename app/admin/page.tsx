import AdminPostList from '@/components/admin/AdminPostList'
import { getAllPosts } from '@/lib/posts'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
}

export default async function AdminPage() {
  const posts = await getAllPosts({ includeDrafts: true })
  return <AdminPostList posts={posts} />
}
