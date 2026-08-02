import { getPostById, upsertLocaleSibling } from './posts'
import { openRouterChat } from './openrouter'
import type { PostDetail, PostListItem, PostLocale } from './types'

export type TranslatedFields = {
  title: string
  summary: string
  body: string
  tags: string[]
}

function languageName(locale: PostLocale) {
  return locale === 'en' ? 'English' : 'Simplified Chinese'
}

function extractJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim()
  const candidates: string[] = [trimmed]

  // Only treat a fence as wrapper when the whole response is a single fenced block.
  const wholeFence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (wholeFence?.[1]) candidates.push(wholeFence[1].trim())

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) candidates.push(trimmed.slice(start, end + 1))

  let lastError: unknown
  for (const raw of candidates) {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to parse translation JSON')
}

async function translateMeta(
  source: Pick<PostDetail, 'title' | 'summary' | 'tags' | 'locale'>,
  target: PostLocale
): Promise<Pick<TranslatedFields, 'title' | 'summary' | 'tags'>> {
  const content = await openRouterChat({
    responseFormat: 'json_object',
    messages: [
      {
        role: 'system',
        content: `You are a professional blog translator. Translate metadata from ${languageName(source.locale)} to ${languageName(target)}.
Return ONLY valid JSON with keys: title, summary, tags.
tags must be an array of short tag strings in the target language.`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          title: source.title,
          summary: source.summary || '',
          tags: source.tags || [],
        }),
      },
    ],
  })

  const parsed = extractJsonObject(content)
  if (!parsed.title) throw new Error('Translation JSON missing title')
  return {
    title: String(parsed.title),
    summary: String(parsed.summary || ''),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
  }
}

async function translateBody(
  body: string,
  sourceLocale: PostLocale,
  target: PostLocale
): Promise<string> {
  const content = await openRouterChat({
    messages: [
      {
        role: 'system',
        content: `You are a professional blog translator. Translate MDX blog body from ${languageName(sourceLocale)} to ${languageName(target)}.

Rules:
- Preserve MDX/Markdown structure exactly (headings, lists, code fences, links, images, JSX components, mermaid blocks).
- Do NOT translate code, URLs, file paths, component names, or fenced code language tags.
- Keep technical terms accurate and natural in the target language.
- Return ONLY the translated MDX body. No JSON. No markdown wrapper. No commentary.`,
      },
      {
        role: 'user',
        content: body,
      },
    ],
  })

  const trimmed = content.trim()
  const wrapped = trimmed.match(/^```(?:mdx|markdown|md)?\s*([\s\S]*?)\s*```$/i)
  return (wrapped?.[1] || trimmed).trim()
}

export async function translatePostFields(
  source: Pick<PostDetail, 'title' | 'summary' | 'body' | 'tags' | 'locale'>
): Promise<TranslatedFields> {
  const target: PostLocale = source.locale === 'en' ? 'zh-CN' : 'en'
  const [meta, body] = await Promise.all([
    translateMeta(source, target),
    translateBody(source.body, source.locale, target),
  ])
  if (!body) throw new Error('Translation returned empty body')
  return { ...meta, body }
}

/**
 * Auto-translate a human-authored post into the other locale.
 * Skips when the post itself is an auto-translated sibling (locale !== sourceLocale).
 */
export async function ensurePostTranslation(postId: string): Promise<{
  translation: PostListItem
  skipped?: boolean
} | null> {
  const source = await getPostById(postId)
  if (!source?._id) return null

  const sourceLocale = source.sourceLocale || source.locale
  if (source.locale !== sourceLocale) {
    return { translation: source, skipped: true }
  }

  source.translationKey = source.translationKey || source.slug
  source.sourceLocale = sourceLocale

  const translated = await translatePostFields(source)
  const translation = await upsertLocaleSibling(source, translated)
  return { translation }
}
