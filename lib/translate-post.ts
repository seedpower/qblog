import { locales, localeLanguageNames, type AppLocale } from '@/i18n/locales'
import {
  getPostById,
  getTranslationSibling,
  updateLocaleSiblingMeta,
  upsertLocaleSibling,
} from './posts'
import { openRouterChat } from './openrouter'
import type { PostDetail, PostListItem, PostLocale } from './types'

export type TranslatedFields = {
  title: string
  summary: string
  body: string
  tags: string[]
}

function languageName(locale: PostLocale) {
  return localeLanguageNames[locale] || locale
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

export async function translateMeta(
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

/**
 * Incrementally update an existing translation when the source body changes.
 * Prefer keeping prior wording for unchanged sections.
 */
async function patchTranslateBody(options: {
  sourceLocale: PostLocale
  target: PostLocale
  previousSourceBody?: string
  newSourceBody: string
  existingTranslationBody: string
}): Promise<string> {
  const { sourceLocale, target, previousSourceBody, newSourceBody, existingTranslationBody } =
    options

  const content = await openRouterChat({
    messages: [
      {
        role: 'system',
        content: `You update an existing MDX blog translation from ${languageName(sourceLocale)} to ${languageName(target)}.

Goal: apply source edits to the EXISTING translation with minimal disruption.
Rules:
- Keep the existing translation wording wherever the source meaning is unchanged.
- Only rewrite or add sentences/sections that correspond to source changes.
- Do NOT restyle, reorder, or "improve" unrelated paragraphs.
- Preserve MDX/Markdown structure exactly (headings, lists, code fences, links, images, JSX, mermaid).
- Do NOT translate code, URLs, file paths, component names, or fenced language tags.
- Return ONLY the updated MDX body. No JSON. No markdown wrapper. No commentary.`,
      },
      {
        role: 'user',
        content: [
          previousSourceBody?.trim()
            ? `PREVIOUS SOURCE (${languageName(sourceLocale)}):\n"""\n${previousSourceBody}\n"""`
            : '',
          `NEW SOURCE (${languageName(sourceLocale)}):\n"""\n${newSourceBody}\n"""`,
          `EXISTING TRANSLATION (${languageName(target)}):\n"""\n${existingTranslationBody}\n"""`,
          'Update the existing translation to match the NEW SOURCE. Minimize changes.',
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
    ],
  })

  const trimmed = content.trim()
  const wrapped = trimmed.match(/^```(?:mdx|markdown|md)?\s*([\s\S]*?)\s*```$/i)
  return (wrapped?.[1] || trimmed).trim()
}

export async function translatePostFields(
  source: Pick<PostDetail, 'title' | 'summary' | 'body' | 'tags' | 'locale'>,
  target: PostLocale
): Promise<TranslatedFields> {
  if (target === source.locale) {
    throw new Error(`Cannot translate to the same locale (${target})`)
  }
  const [meta, body] = await Promise.all([
    translateMeta(source, target),
    translateBody(source.body, source.locale, target),
  ])
  if (!body) throw new Error('Translation returned empty body')
  return { ...meta, body }
}

export type EnsureTranslationsResult = {
  translations: PostListItem[]
  skipped?: boolean
  errors?: Array<{ locale: AppLocale; error: string }>
}

/** Parallel OpenRouter calls per post. Override with TRANSLATE_CONCURRENCY (1–12). */
function translateConcurrency(): number {
  const raw = Number(process.env.TRANSLATE_CONCURRENCY || 5)
  if (!Number.isFinite(raw)) return 5
  return Math.min(12, Math.max(1, Math.floor(raw)))
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []
  const results = new Array<R>(items.length)
  let next = 0

  async function run() {
    while (true) {
      const index = next++
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => run())
  await Promise.all(workers)
  return results
}

export function metaSignature(
  post: Pick<PostDetail | PostListItem, 'title' | 'summary' | 'tags'>
): string {
  const tags = [...(post.tags || [])].map(String).sort().join('\u0001')
  return `${post.title || ''}\u0000${post.summary || ''}\u0000${tags}`
}

/**
 * Auto-translate a human-authored post into every other configured locale.
 * Skips when the post itself is an auto-translated sibling (locale !== sourceLocale).
 *
 * - Missing siblings: full translate
 * - Existing + force: full re-translate from scratch
 * - Existing + refreshBody: incremental body patch (keep stable wording)
 * - Existing + refreshMeta: re-translate title/summary/tags only (keep body)
 *
 * Locale targets run concurrently (default 5) to speed up multi-language fan-out.
 */
export async function ensurePostTranslations(
  postId: string,
  options?: {
    force?: boolean
    refreshMeta?: boolean
    refreshBody?: boolean
    /** Prior source body — helps the model patch translations with minimal churn. */
    previousBody?: string
    targets?: PostLocale[]
    concurrency?: number
  }
): Promise<EnsureTranslationsResult | null> {
  const source = await getPostById(postId)
  if (!source?._id) return null

  const sourceLocale = source.sourceLocale || source.locale
  if (source.locale !== sourceLocale) {
    return { translations: [source], skipped: true }
  }

  source.translationKey = source.translationKey || source.slug
  source.sourceLocale = sourceLocale

  const targets = (options?.targets || locales.filter((l) => l !== source.locale)) as PostLocale[]
  const concurrency = options?.concurrency ?? translateConcurrency()
  const needsWork = Boolean(options?.force || options?.refreshMeta || options?.refreshBody)

  const settled = await mapPool(targets, concurrency, async (target) => {
    const existing = await getTranslationSibling(source, target, { includeDrafts: true })

    if (existing && !needsWork) {
      return { ok: true as const, translation: existing }
    }

    try {
      // Meta-only update: keep translated body untouched.
      if (existing && options?.refreshMeta && !options?.refreshBody && !options?.force) {
        const meta = await translateMeta(source, target)
        const sibling = await updateLocaleSiblingMeta(source, meta, target)
        if (sibling) return { ok: true as const, translation: sibling }
        return {
          ok: false as const,
          locale: target,
          error: 'Failed to update translated metadata',
        }
      }

      // Incremental body update for an existing translation (optionally refresh meta too).
      if (existing?._id && options?.refreshBody && !options?.force) {
        const existingDetail = await getPostById(existing._id)
        const existingBody = existingDetail?.body?.trim() || ''

        if (!existingBody) {
          const translated = await translatePostFields(source, target)
          const sibling = await upsertLocaleSibling(source, translated, target)
          return { ok: true as const, translation: sibling }
        }

        const [meta, body] = await Promise.all([
          options.refreshMeta
            ? translateMeta(source, target)
            : Promise.resolve({
                title: existing.title,
                summary: existing.summary || '',
                tags: existing.tags || [],
              }),
          patchTranslateBody({
            sourceLocale: source.locale,
            target,
            previousSourceBody: options.previousBody,
            newSourceBody: source.body,
            existingTranslationBody: existingBody,
          }),
        ])

        if (!body) throw new Error('Incremental translation returned empty body')
        const sibling = await upsertLocaleSibling(source, { ...meta, body }, target)
        return { ok: true as const, translation: sibling }
      }

      // Missing sibling, or force full re-translate.
      const translated = await translatePostFields(source, target)
      const sibling = await upsertLocaleSibling(source, translated, target)
      return { ok: true as const, translation: sibling }
    } catch (error) {
      return {
        ok: false as const,
        locale: target,
        error: error instanceof Error ? error.message : 'failed',
      }
    }
  })

  const translations: PostListItem[] = []
  const errors: Array<{ locale: AppLocale; error: string }> = []
  for (const item of settled) {
    if (item.ok) translations.push(item.translation)
    else errors.push({ locale: item.locale, error: item.error })
  }

  return { translations, errors: errors.length ? errors : undefined }
}

/** @deprecated Use ensurePostTranslations */
export async function ensurePostTranslation(postId: string): Promise<{
  translation: PostListItem
  skipped?: boolean
} | null> {
  const result = await ensurePostTranslations(postId)
  if (!result) return null
  return {
    translation: result.translations[0] || (await getPostById(postId))!,
    skipped: result.skipped,
  }
}
