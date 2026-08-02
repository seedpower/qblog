import { authors } from '@/data/authorsData'
import type { Author } from './types'

export function getAllAuthors(): Author[] {
  return authors
}

export function getAuthorBySlug(slug: string): Author | undefined {
  return authors.find((author) => author.slug === slug)
}
