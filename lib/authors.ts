import { authors } from '@/data/authorsData'
import type { Author, PostLocale } from './types'

export function getAllAuthors(): Author[] {
  return authors.map(({ bodies: _bodies, ...author }) => author)
}

export function getAuthorBySlug(slug: string, locale?: PostLocale): Author | undefined {
  const author = authors.find((item) => item.slug === slug)
  if (!author) return undefined

  const { bodies, ...rest } = author
  const body = (locale && bodies?.[locale]) || bodies?.en || rest.body
  return { ...rest, body }
}
