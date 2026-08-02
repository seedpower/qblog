import { getAllPosts } from '@/lib/posts'
import Main from './Main'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const posts = await getAllPosts()
  return <Main posts={posts} />
}
