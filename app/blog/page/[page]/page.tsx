import ListLayout from '@/layouts/ListLayoutWithTags'
import { notFound } from 'next/navigation'
import { getAllPosts, getTagCounts } from '@/lib/posts'

const POSTS_PER_PAGE = 5

export const dynamic = 'force-dynamic'

export default async function Page(props: { params: Promise<{ page: string }> }) {
  const params = await props.params
  const posts = await getAllPosts()
  const tagCounts = await getTagCounts()
  const pageNumber = parseInt(params.page as string)
  const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE)

  if (pageNumber <= 0 || pageNumber > totalPages || isNaN(pageNumber)) {
    return notFound()
  }
  const initialDisplayPosts = posts.slice(
    POSTS_PER_PAGE * (pageNumber - 1),
    POSTS_PER_PAGE * pageNumber
  )
  const pagination = {
    currentPage: pageNumber,
    totalPages: totalPages,
  }

  return (
    <ListLayout
      posts={posts}
      initialDisplayPosts={initialDisplayPosts}
      pagination={pagination}
      title="All Posts"
      tagCounts={tagCounts}
    />
  )
}
