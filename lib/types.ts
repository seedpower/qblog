export type TocItem = {
  value: string
  url: string
  depth: number
}

export type ReadingTime = {
  text: string
  minutes: number
  time: number
  words: number
}

import type { AppLocale } from '@/i18n/locales'

/** Content locale — same set as app/UI locales. */
export type PostLocale = AppLocale

/** List/card view of a blog post (no body). */
export type PostListItem = {
  _id?: string
  title: string
  date: string
  lastmod?: string
  tags: string[]
  draft: boolean
  summary?: string
  images: string[]
  authors: string[]
  layout?: string
  youtube?: string
  slug: string
  path: string
  coverImage: string
  locale: PostLocale
  translationKey?: string
  /** Locale of the human-authored original; auto-translate only when saving this locale. */
  sourceLocale?: PostLocale
  readingTime?: ReadingTime
}

/** Full post including MDX body. */
export type PostDetail = PostListItem & {
  body: string
  toc: TocItem[]
  structuredData: Record<string, unknown>
}

export type PostInput = {
  title: string
  slug: string
  date: string
  lastmod?: string
  tags: string[]
  draft: boolean
  summary?: string
  images: string[]
  authors: string[]
  layout?: string
  youtube?: string
  body: string
  locale: PostLocale
  translationKey?: string
  sourceLocale?: PostLocale
}

export type Author = {
  name: string
  avatar?: string
  occupation?: string
  company?: string
  email?: string
  twitter?: string
  bluesky?: string
  linkedin?: string
  github?: string
  slug: string
  body: string
}
