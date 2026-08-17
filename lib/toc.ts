import GithubSlugger from 'github-slugger'
import type { TocItem } from './types'

function stripMarkdown(value: string): string {
  return value
    .replace(/#+\s*$/, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`]/g, '')
    .trim()
}

/**
 * Heading TOC without pulling remark/rehype into every Mongo query path.
 * Skips fenced code so ``` blocks that start with # are ignored.
 */
export function extractTocHeadingsLite(markdown: string): TocItem[] {
  if (!markdown) return []

  const slugger = new GithubSlugger()
  const toc: TocItem[] = []
  let inFence = false

  for (const line of markdown.split('\n')) {
    const trimmed = line.trimStart()
    if (trimmed.startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const match = /^(#{1,6})\s+(.+)$/.exec(trimmed)
    if (!match) continue

    const value = stripMarkdown(match[2])
    if (!value) continue

    toc.push({
      value,
      url: `#${slugger.slug(value)}`,
      depth: match[1].length,
    })
  }

  return toc
}
