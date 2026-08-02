import { NextResponse } from 'next/server'
import { getAllPosts } from '@/lib/posts'

export const dynamic = 'force-dynamic'

export async function GET() {
  const posts = await getAllPosts()
  const documents = posts.map((post) => ({
    title: post.title,
    date: post.date,
    summary: post.summary,
    tags: post.tags,
    slug: post.slug,
    path: post.path,
  }))
  return NextResponse.json(documents)
}
