import { ObjectId, type WithId } from 'mongodb'
import readingTime from 'reading-time'
import { slug as slugify } from 'github-slugger'
import { extractTocHeadings } from 'pliny/mdx-plugins/index.js'
import siteMetadata from '@/data/siteMetadata'
import { resolveBlogImageSrc } from '@/utils/resolveBlogImageSrc'
import { getPostsCollection, type PostDocument } from './mongodb'
import type { PostDetail, PostInput, PostListItem, TocItem } from './types'

function toIso(value: string | Date | undefined): string | undefined {
  if (!value) return undefined
  return new Date(value).toISOString()
}

function resolveImages(images: unknown, blogPath: string): string[] {
  if (!images) return []
  const list = typeof images === 'string' ? [images] : Array.isArray(images) ? images : []
  return list
    .filter((img): img is string => typeof img === 'string' && img.length > 0)
    .map((img) => resolveBlogImageSrc(img, blogPath) ?? img)
}

function coverFrom(images: string[], blogPath: string): string {
  const resolved = resolveImages(images, blogPath)
  return resolved[0] ?? siteMetadata.postDefaultCover
}

function docToListItem(doc: WithId<PostDocument>): PostListItem {
  const path = doc.path || `blog/${doc.slug}`
  const date = toIso(doc.date) || new Date().toISOString()
  return {
    _id: doc._id.toString(),
    title: doc.title,
    date,
    lastmod: toIso(doc.lastmod),
    tags: doc.tags || [],
    draft: Boolean(doc.draft),
    summary: doc.summary,
    images: resolveImages(doc.images, path),
    authors: doc.authors?.length ? doc.authors : ['default'],
    layout: doc.layout,
    youtube: doc.youtube,
    slug: doc.slug,
    path,
    coverImage: coverFrom(doc.images || [], path),
    readingTime: readingTime(doc.body || ''),
  }
}

async function docToDetail(
  doc: WithId<PostDocument>,
  options?: { resolveImages?: boolean }
): Promise<PostDetail> {
  const list = docToListItem(doc)
  if (options?.resolveImages === false) {
    list.images = Array.isArray(doc.images) ? doc.images : []
  }
  const toc = (await extractTocHeadings(doc.body || '')) as TocItem[]
  return {
    ...list,
    body: doc.body || '',
    toc,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: list.title,
      datePublished: list.date,
      dateModified: list.lastmod || list.date,
      description: list.summary,
      image: list.coverImage,
      url: `${siteMetadata.siteUrl}/${list.path}`,
    },
  }
}

function publishedFilter(includeDrafts: boolean) {
  if (includeDrafts) return {}
  return { draft: { $ne: true } }
}

export async function getAllPosts(options?: { includeDrafts?: boolean }): Promise<PostListItem[]> {
  const collection = await getPostsCollection()
  const docs = await collection
    .find(publishedFilter(Boolean(options?.includeDrafts)))
    .sort({ date: -1 })
    .toArray()
  return docs.map(docToListItem)
}

export async function getPostBySlug(
  slug: string,
  options?: { includeDrafts?: boolean }
): Promise<PostDetail | null> {
  const collection = await getPostsCollection()
  const doc = await collection.findOne({ slug })
  if (!doc) return null
  if (!options?.includeDrafts && doc.draft) return null
  return docToDetail(doc)
}

export async function getPostById(id: string): Promise<PostDetail | null> {
  if (!ObjectId.isValid(id)) return null
  const collection = await getPostsCollection()
  const doc = await collection.findOne({ _id: new ObjectId(id) })
  if (!doc) return null
  return docToDetail(doc, { resolveImages: false })
}

export async function getPostsByTag(tag: string): Promise<PostListItem[]> {
  const posts = await getAllPosts()
  return posts.filter((post) => post.tags.some((t) => slugify(t) === tag))
}

export async function getTagCounts(): Promise<Record<string, number>> {
  const posts = await getAllPosts()
  const counts: Record<string, number> = {}
  for (const post of posts) {
    for (const tag of post.tags) {
      const key = slugify(tag)
      counts[key] = (counts[key] || 0) + 1
    }
  }
  return counts
}

export function normalizeSlug(input: string): string {
  return input
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\s+/g, '-')
}

export async function createPost(input: PostInput): Promise<PostListItem> {
  const collection = await getPostsCollection()
  const slug = normalizeSlug(input.slug)
  const now = new Date()
  const doc: PostDocument = {
    ...input,
    slug,
    path: `blog/${slug}`,
    tags: input.tags || [],
    images: input.images || [],
    authors: input.authors?.length ? input.authors : ['default'],
    draft: Boolean(input.draft),
    createdAt: now,
    updatedAt: now,
  }
  const result = await collection.insertOne(doc)
  return docToListItem({ ...doc, _id: result.insertedId })
}

export async function updatePost(id: string, input: PostInput): Promise<PostListItem | null> {
  if (!ObjectId.isValid(id)) return null
  const collection = await getPostsCollection()
  const slug = normalizeSlug(input.slug)
  const update = {
    ...input,
    slug,
    path: `blog/${slug}`,
    tags: input.tags || [],
    images: input.images || [],
    authors: input.authors?.length ? input.authors : ['default'],
    draft: Boolean(input.draft),
    updatedAt: new Date(),
  }
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: 'after' }
  )
  if (!result) return null
  return docToListItem(result)
}

export async function deletePost(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false
  const collection = await getPostsCollection()
  const result = await collection.deleteOne({ _id: new ObjectId(id) })
  return result.deletedCount === 1
}
