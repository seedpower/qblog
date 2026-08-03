#!/usr/bin/env node
/**
 * Translate messages/en.json into every configured locale via OpenRouter.
 * Skips locales that already have a messages/<locale>.json unless --force.
 *
 * Usage: node --env-file=.env.local scripts/translate-ui-messages.mjs [--force]
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const messagesDir = path.join(root, 'messages')

const LOCALES = [
  'cs',
  'da',
  'de',
  'en',
  'es',
  'fi',
  'fr',
  'it',
  'ja',
  'ko',
  'nb',
  'nl',
  'pl',
  'pt-BR',
  'ru',
  'sv',
  'tr',
  'zh-CN',
  'zh-TW',
]

const LANGUAGE_NAMES = {
  cs: 'Czech',
  da: 'Danish',
  de: 'German',
  en: 'English',
  es: 'Spanish',
  fi: 'Finnish',
  fr: 'French',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  nb: 'Norwegian Bokmål',
  nl: 'Dutch',
  pl: 'Polish',
  'pt-BR': 'Brazilian Portuguese',
  ru: 'Russian',
  sv: 'Swedish',
  tr: 'Turkish',
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
}

const force = process.argv.includes('--force')
const en = JSON.parse(fs.readFileSync(path.join(messagesDir, 'en.json'), 'utf8'))

async function translateLocale(locale) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY')
  const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://blog.seedpower.app',
      'X-OpenRouter-Title': 'Seedpower Blog UI i18n',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You translate UI strings for a blog site into ${LANGUAGE_NAMES[locale]} (${locale}).
Return ONLY valid JSON with the exact same nested key structure as the input.
Keep placeholders like {title} and {tag} unchanged.
Do not translate brand names: Seedpower, SuperMark, Apps, Admin, X.`,
        },
        { role: 'user', content: JSON.stringify(en) },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenRouter ${response.status}: ${await response.text()}`)
  }
  const data = await response.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty translation response')
  const parsed = JSON.parse(text)
  // Preserve structure: require same top-level keys
  for (const key of Object.keys(en)) {
    if (!(key in parsed)) throw new Error(`Missing top-level key: ${key}`)
  }
  return parsed
}

async function main() {
  for (const locale of LOCALES) {
    if (locale === 'en') continue
    const out = path.join(messagesDir, `${locale}.json`)
    if (!force && fs.existsSync(out)) {
      console.log(`[skip] ${locale}`)
      continue
    }
    process.stdout.write(`[translate] ${locale} ... `)
    const translated = await translateLocale(locale)
    fs.writeFileSync(out, JSON.stringify(translated, null, 2) + '\n')
    console.log('ok')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
