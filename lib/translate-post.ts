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

function extractJson(text: string): TranslatedFields {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = (fenced?.[1] || text).trim()
  const parsed = JSON.parse(raw) as Partial<TranslatedFields>
  if (!parsed.title || !parsed.body) {
    throw new Error('Translation JSON missing title/body')
  }
  return {
    title: String(parsed.title),
    summary: String(parsed.summary || ''),
    body: String(parsed.body),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
  }
}

export async function translatePostFields(
  source: Pick<PostDetail, 'title' | 'summary' | 'body' | 'tags' | 'locale'>
): Promise<TranslatedFields> {
  const target: PostLocale = source.locale === 'en' ? 'zh-CN' : 'en'
  const content = await openRouterChat({
    responseFormat: 'json_object',
    messages: [
      {
        role: 'system',
        content: `You are a professional blog translator. Translate the given MDX blog post from ${languageName(source.locale)} to ${languageName(target)}.

Rules:
- Preserve MDX/Markdown structure exactly (headings, lists, code fences, links, images, JSX components).
- Do NOT translate code, URLs, file paths, or component names.
- Keep technical terms accurate and natural in the target language.
- Return ONLY valid JSON with keys: title, summary, body, tags.
- tags must be an array of short tag strings in the target language.`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          title: source.title,
          summary: source.summary || '',
          tags: source.tags || [],
          body: source.body,
        }),
      },
    ],
  })

  return extractJson(content)
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
