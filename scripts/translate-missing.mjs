/**
 * Translate zh-CN source posts that are missing an English sibling via OpenRouter.
 * Usage: node --env-file=.env.local scripts/translate-missing.mjs
 */
import { MongoClient } from 'mongodb'
import { readFileSync, existsSync } from 'fs'

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const i = trimmed.indexOf('=')
    if (i <= 0) continue
    const key = trimmed.slice(0, i)
    const value = trimmed.slice(i + 1)
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB || 'blog'
const apiKey = process.env.OPENROUTER_API_KEY
const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'

if (!uri) throw new Error('Missing MONGODB_URI')
if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY')

async function openRouterChat(messages, { json = false } = {}) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.SITE_URL || 'https://blog.seedpower.app',
      'X-OpenRouter-Title': 'Seedpower Blog',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error?.message || `OpenRouter failed (${response.status})`)
  }
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('Empty OpenRouter response')
  return content
}

function extractJsonObject(text) {
  const trimmed = text.trim()
  const candidates = [trimmed]
  const wholeFence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (wholeFence?.[1]) candidates.push(wholeFence[1].trim())
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) candidates.push(trimmed.slice(start, end + 1))
  let lastError
  for (const raw of candidates) {
    try {
      return JSON.parse(raw)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('Failed to parse JSON')
}

async function translatePost(source) {
  const [metaRaw, bodyRaw] = await Promise.all([
    openRouterChat(
      [
        {
          role: 'system',
          content:
            'Translate blog metadata from Simplified Chinese to English. Return ONLY JSON with keys: title, summary, tags. tags is an array of English strings.',
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
      { json: true }
    ),
    openRouterChat([
      {
        role: 'system',
        content: `Translate MDX blog body from Simplified Chinese to English.
Preserve MDX/Markdown exactly (including mermaid/code fences). Do not translate code, URLs, paths, or component names.
Return ONLY the translated MDX body. No JSON, no wrapper, no commentary.`,
      },
      { role: 'user', content: source.body || '' },
    ]),
  ])

  const meta = extractJsonObject(metaRaw)
  if (!meta.title) throw new Error('Missing translated title')
  const wrapped = bodyRaw.trim().match(/^```(?:mdx|markdown|md)?\s*([\s\S]*?)\s*```$/i)
  const body = (wrapped?.[1] || bodyRaw).trim()
  if (!body) throw new Error('Missing translated body')

  return {
    title: String(meta.title),
    summary: String(meta.summary || ''),
    body,
    tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
  }
}

const client = new MongoClient(uri)
await client.connect()
const col = client.db(dbName).collection('posts')

await col.updateMany(
  { $or: [{ locale: { $exists: false } }, { locale: null }] },
  [
    {
      $set: {
        locale: 'zh-CN',
        sourceLocale: { $ifNull: ['$sourceLocale', 'zh-CN'] },
        translationKey: { $ifNull: ['$translationKey', '$slug'] },
      },
    },
  ]
)

const posts = await col.find({}).toArray()
const byKey = new Map()
for (const post of posts) {
  const key = post.translationKey || post.slug
  const list = byKey.get(key) || []
  list.push(post)
  byKey.set(key, list)
}

let translated = 0
let skipped = 0
let failed = 0

for (const [key, group] of byKey) {
  const zh = group.find((p) => p.locale === 'zh-CN')
  const en = group.find((p) => p.locale === 'en')
  if (!zh) {
    skipped += 1
    console.log(`[skip] ${key}: no zh-CN source`)
    continue
  }
  if (en && !process.env.FORCE) {
    skipped += 1
    console.log(`[skip] ${key}: en already exists`)
    continue
  }

  try {
    console.log(`[translate] ${key} …`)
    const fields = await translatePost(zh)
    const now = new Date()
    const payload = {
      title: fields.title,
      slug: zh.slug,
      path: zh.path || `blog/${zh.slug}`,
      date: zh.date,
      lastmod: now.toISOString(),
      tags: fields.tags.length ? fields.tags : zh.tags || [],
      draft: Boolean(zh.draft),
      summary: fields.summary || '',
      images: zh.images || [],
      authors: zh.authors?.length ? zh.authors : ['default'],
      layout: zh.layout,
      youtube: zh.youtube,
      body: fields.body,
      locale: 'en',
      translationKey: zh.translationKey || zh.slug,
      sourceLocale: 'zh-CN',
      updatedAt: now,
    }

    if (en) {
      await col.updateOne({ _id: en._id }, { $set: payload })
    } else {
      await col.insertOne({ ...payload, createdAt: now })
    }

    await col.updateOne(
      { _id: zh._id },
      {
        $set: {
          locale: 'zh-CN',
          sourceLocale: 'zh-CN',
          translationKey: zh.translationKey || zh.slug,
        },
      }
    )

    translated += 1
    console.log(`[ok] ${key} → ${fields.title}`)
  } catch (error) {
    failed += 1
    console.error(`[fail] ${key}:`, error.message || error)
  }
}

console.log(JSON.stringify({ translated, skipped, failed, total: byKey.size }))
await client.close()
