import { cache } from 'react'
import { revalidateTag, unstable_cache } from 'next/cache'
import { ObjectId, type WithId } from 'mongodb'
import { slug as slugify } from 'github-slugger'
import siteMetadata from '@/data/siteMetadata'
import { defaultLocale, normalizeAppLocale } from '@/i18n/locales'
import { resolveBlogImageSrc } from '@/utils/resolveBlogImageSrc'
import { getPostsCollection, type PostDocument } from './mongodb'
import { extractTocHeadingsLite } from './toc'
import type { PostDetail, PostInput, PostListItem, PostLocale } from './types'

const POSTS_CACHE_TAG = 'posts'
const LIST_PROJECTION = { body: 0 } as const

function bumpPostsCache() {
  try {
    revalidateTag(POSTS_CACHE_TAG)
  } catch {
    // Scripts / seed can call mutations outside a request.
  }
}

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

function normalizeLocale(value: unknown): PostLocale {
  return normalizeAppLocale(value, defaultLocale)
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
    locale: normalizeLocale(doc.locale),
    translationKey: doc.translationKey,
    sourceLocale: doc.sourceLocale
      ? normalizeLocale(doc.sourceLocale)
      : normalizeLocale(doc.locale),
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
  const toc = extractTocHeadingsLite(doc.body || '')
  return {
    ...list,
    body: doc.body || '',
    toc,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      inLanguage: list.locale,
      headline: list.title,
      datePublished: list.date,
      dateModified: list.lastmod || list.date,
      description: list.summary,
      image: `${siteMetadata.siteUrl.replace(/\/$/, '')}/api/og/?${new URLSearchParams({
        slug: list.slug,
        locale: list.locale,
      }).toString()}`,
      url: `${siteMetadata.siteUrl}/${list.path}`,
    },
  }
}

function buildFilter(options?: { includeDrafts?: boolean; locale?: PostLocale }) {
  const filter: Record<string, unknown> = {}
  if (!options?.includeDrafts) {
    filter.draft = { $ne: true }
  }
  if (options?.locale) {
    // Treat missing locale as zh-CN for backward compatibility with seeded docs
    if (options.locale === 'zh-CN') {
      filter.$or = [{ locale: 'zh-CN' }, { locale: { $exists: false } }, { locale: null }]
    } else {
      filter.locale = options.locale
    }
  }
  return filter
}

async function loadListPosts(options?: {
  includeDrafts?: boolean
  locale?: PostLocale
}): Promise<PostListItem[]> {
  const collection = await getPostsCollection()
  const docs = await collection
    .find(buildFilter(options), { projection: LIST_PROJECTION })
    .sort({ date: -1 })
    .toArray()
  return docs.map(docToListItem)
}

const loadPublishedList = unstable_cache(
  async (locale: string) =>
    loadListPosts({
      locale: locale ? (locale as PostLocale) : undefined,
    }),
  ['posts-published-list'],
  { revalidate: 60, tags: [POSTS_CACHE_TAG] }
)

const loadPublishedTagCounts = unstable_cache(
  async (locale: string) => {
    const collection = await getPostsCollection()
    const docs = await collection
      .find(buildFilter({ locale: locale ? (locale as PostLocale) : undefined }), {
        projection: { tags: 1 },
      })
      .toArray()
    const counts: Record<string, number> = {}
    for (const doc of docs) {
      for (const tag of doc.tags || []) {
        const key = slugify(tag)
        counts[key] = (counts[key] || 0) + 1
      }
    }
    return counts
  },
  ['posts-tag-counts'],
  { revalidate: 60, tags: [POSTS_CACHE_TAG] }
)

const loadPublishedDetail = unstable_cache(
  async (slug: string, locale: string) => {
    const collection = await getPostsCollection()
    const filter: Record<string, unknown> = {
      slug,
      ...buildFilter({ locale: locale as PostLocale }),
    }
    const doc = await collection.findOne(filter)
    return doc ? docToDetail(doc) : null
  },
  ['posts-published-detail'],
  { revalidate: 60, tags: [POSTS_CACHE_TAG] }
)

export async function getAllPosts(options?: {
  includeDrafts?: boolean
  locale?: PostLocale
  limit?: number
}): Promise<PostListItem[]> {
  return getAllPostsMemo(
    Boolean(options?.includeDrafts),
    options?.locale || '',
    options?.limit ?? 0
  )
}

const getAllPostsMemo = cache(async (includeDrafts: boolean, locale: string, limit: number) => {
  const posts = includeDrafts
    ? await loadListPosts({
        includeDrafts: true,
        locale: locale ? (locale as PostLocale) : undefined,
      })
    : await loadPublishedList(locale)
  return limit > 0 ? posts.slice(0, limit) : posts
})

export async function getPostBySlug(
  slug: string,
  options?: { includeDrafts?: boolean; locale?: PostLocale }
): Promise<PostDetail | null> {
  return getPostBySlugMemo(slug, Boolean(options?.includeDrafts), options?.locale || defaultLocale)
}

const getPostBySlugMemo = cache(async (slug: string, includeDrafts: boolean, locale: string) => {
  if (!includeDrafts) {
    return loadPublishedDetail(slug, locale)
  }
  const collection = await getPostsCollection()
  const filter: Record<string, unknown> = {
    slug,
    ...buildFilter({ includeDrafts: true, locale: locale as PostLocale }),
  }
  const doc = await collection.findOne(filter)
  if (!doc) return null
  return docToDetail(doc)
})

/** List fields only — used by OG so we never load MDX body for social cards. */
export async function getPostCardBySlug(
  slug: string,
  options?: { includeDrafts?: boolean; locale?: PostLocale }
): Promise<PostListItem | null> {
  const collection = await getPostsCollection()
  const filter: Record<string, unknown> = { slug, ...buildFilter(options) }
  const doc = await collection.findOne(filter, { projection: LIST_PROJECTION })
  return doc ? docToListItem(doc) : null
}

export async function getPostById(id: string): Promise<PostDetail | null> {
  if (!ObjectId.isValid(id)) return null
  const collection = await getPostsCollection()
  const doc = await collection.findOne({ _id: new ObjectId(id) })
  if (!doc) return null
  return docToDetail(doc, { resolveImages: false })
}

export async function getTranslationSibling(
  post: Pick<PostListItem, 'translationKey' | 'locale' | 'slug'>,
  targetLocale: PostLocale,
  options?: { includeDrafts?: boolean }
): Promise<PostListItem | null> {
  const translationKey = post.translationKey || post.slug
  if (!translationKey || post.locale === targetLocale) return null
  const collection = await getPostsCollection()
  const filter: Record<string, unknown> = {
    translationKey,
    locale: targetLocale,
  }
  if (!options?.includeDrafts) {
    filter.draft = { $ne: true }
  }
  const doc = await collection.findOne(filter)
  return doc ? docToListItem(doc) : null
}

/**
 * Prefer the human-authored source document id for admin editing.
 * Falls back to zh-CN (legacy), then the current post id.
 */
export async function getSourcePostId(
  post: Pick<PostListItem, '_id' | 'translationKey' | 'locale' | 'slug' | 'sourceLocale'>
): Promise<string | undefined> {
  if (!post._id) return undefined

  const preferred = post.sourceLocale || (post.locale === 'zh-CN' ? 'zh-CN' : null)
  if (preferred && post.locale === preferred) return post._id

  const collection = await getPostsCollection()
  const translationKey = post.translationKey || post.slug

  if (preferred) {
    const localeFilter: Record<string, unknown> =
      preferred === 'zh-CN'
        ? { $or: [{ locale: 'zh-CN' }, { locale: { $exists: false } }, { locale: null }] }
        : { locale: preferred }
    const bySource = await collection.findOne({
      $and: [{ $or: [{ translationKey }, { slug: post.slug }] }, localeFilter],
    } as Record<string, unknown>)
    if (bySource) return bySource._id.toString()
  }

  if (post.locale === 'zh-CN') return post._id

  const zh = await collection.findOne({
    $and: [
      { $or: [{ translationKey }, { slug: post.slug }] },
      { $or: [{ locale: 'zh-CN' }, { locale: { $exists: false } }, { locale: null }] },
    ],
  } as Record<string, unknown>)
  return zh ? zh._id.toString() : post._id
}

/** @deprecated Use getSourcePostId */
export async function getChineseSourcePostId(
  post: Pick<PostListItem, '_id' | 'translationKey' | 'locale' | 'slug' | 'sourceLocale'>
): Promise<string | undefined> {
  return getSourcePostId(post)
}

export async function getPostsByTag(
  tag: string,
  options?: { locale?: PostLocale }
): Promise<PostListItem[]> {
  const posts = await getAllPosts(options)
  return posts.filter((post) => post.tags.some((t) => slugify(t) === tag))
}

export async function getTagCounts(options?: {
  locale?: PostLocale
}): Promise<Record<string, number>> {
  return loadPublishedTagCounts(options?.locale || '')
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
    locale: normalizeLocale(input.locale),
    translationKey: input.translationKey || slug,
    sourceLocale: normalizeLocale(input.sourceLocale || input.locale),
    tags: input.tags || [],
    images: input.images || [],
    authors: input.authors?.length ? input.authors : ['default'],
    draft: Boolean(input.draft),
    createdAt: now,
    updatedAt: now,
  }
  const result = await collection.insertOne(doc)
  bumpPostsCache()
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
    locale: normalizeLocale(input.locale),
    translationKey: input.translationKey || slug,
    sourceLocale: normalizeLocale(input.sourceLocale || input.locale),
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
  bumpPostsCache()
  return docToListItem(result)
}

export async function deletePost(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false
  const collection = await getPostsCollection()
  const result = await collection.deleteOne({ _id: new ObjectId(id) })
  if (result.deletedCount === 1) bumpPostsCache()
  return result.deletedCount === 1
}

/** Delete a post and all locale siblings that share its translationKey/slug. */
export async function deletePostFamily(id: string): Promise<number> {
  if (!ObjectId.isValid(id)) return 0
  const collection = await getPostsCollection()
  const post = await collection.findOne({ _id: new ObjectId(id) })
  if (!post) return 0

  const translationKey = post.translationKey || post.slug
  const result = await collection.deleteMany({
    $or: [{ translationKey }, { slug: post.slug }],
  })
  if (result.deletedCount) bumpPostsCache()
  return result.deletedCount
}

export async function upsertLocaleSibling(
  source: PostDetail,
  translated: {
    title: string
    summary?: string
    body: string
    tags: string[]
  },
  targetLocale: PostLocale
): Promise<PostListItem> {
  const collection = await getPostsCollection()
  const translationKey = source.translationKey || source.slug
  const slug = normalizeSlug(source.slug)
  const now = new Date()

  const existing = await collection.findOne({ translationKey, locale: targetLocale })
  const payload = {
    title: translated.title,
    slug,
    path: `blog/${slug}`,
    date: source.date,
    lastmod: now.toISOString(),
    tags: translated.tags?.length ? translated.tags : source.tags,
    draft: source.draft,
    summary: translated.summary || '',
    images: source.images || [],
    authors: source.authors?.length ? source.authors : ['default'],
    layout: source.layout,
    youtube: source.youtube,
    body: translated.body,
    locale: targetLocale,
    translationKey,
    sourceLocale: source.sourceLocale || source.locale,
    updatedAt: now,
  }

  if (existing) {
    const result = await collection.findOneAndUpdate(
      { _id: existing._id },
      { $set: payload },
      { returnDocument: 'after' }
    )
    if (!result) throw new Error('Failed to update translated post')
    bumpPostsCache()
    return docToListItem(result)
  }

  const doc = { ...payload, createdAt: now }
  const inserted = await collection.insertOne(doc)
  bumpPostsCache()
  return docToListItem({ ...doc, _id: inserted.insertedId })
}

/** Update translated metadata on an existing sibling; keeps body unchanged. */
export async function updateLocaleSiblingMeta(
  source: PostDetail,
  translated: {
    title: string
    summary?: string
    tags: string[]
  },
  targetLocale: PostLocale
): Promise<PostListItem | null> {
  const collection = await getPostsCollection()
  const translationKey = source.translationKey || source.slug
  const slug = normalizeSlug(source.slug)
  const now = new Date()

  const existing = await collection.findOne({ translationKey, locale: targetLocale })
  if (!existing) return null

  const result = await collection.findOneAndUpdate(
    { _id: existing._id },
    {
      $set: {
        title: translated.title,
        slug,
        path: `blog/${slug}`,
        date: source.date,
        lastmod: now.toISOString(),
        tags: translated.tags?.length ? translated.tags : source.tags,
        draft: source.draft,
        summary: translated.summary || '',
        images: source.images || [],
        authors: source.authors?.length ? source.authors : ['default'],
        layout: source.layout,
        youtube: source.youtube,
        locale: targetLocale,
        translationKey,
        sourceLocale: source.sourceLocale || source.locale,
        updatedAt: now,
      },
    },
    { returnDocument: 'after' }
  )
  if (!result) throw new Error('Failed to update translated metadata')
  bumpPostsCache()
  return docToListItem(result)
}
