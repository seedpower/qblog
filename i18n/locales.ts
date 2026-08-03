/**
 * Blog locales — keep aligned with SuperMark docs (`docs/locales`).
 * URL routing: default `en` has no prefix; others use `/{locale}/...`.
 */
export const locales = [
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
] as const

export type AppLocale = (typeof locales)[number]
export const defaultLocale: AppLocale = 'en'

/** Short labels for the language switcher. */
export const localeLabels: Record<AppLocale, string> = {
  cs: 'Čeština',
  da: 'Dansk',
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fi: 'Suomi',
  fr: 'Français',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  nb: 'Norsk',
  nl: 'Nederlands',
  pl: 'Polski',
  'pt-BR': 'Português',
  ru: 'Русский',
  sv: 'Svenska',
  tr: 'Türkçe',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
}

/** Full language names for AI translation prompts. */
export const localeLanguageNames: Record<AppLocale, string> = {
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

/** Open Graph / HTML locale tags. */
export const ogLocaleTags: Record<AppLocale, string> = {
  cs: 'cs_CZ',
  da: 'da_DK',
  de: 'de_DE',
  en: 'en_US',
  es: 'es_ES',
  fi: 'fi_FI',
  fr: 'fr_FR',
  it: 'it_IT',
  ja: 'ja_JP',
  ko: 'ko_KR',
  nb: 'nb_NO',
  nl: 'nl_NL',
  pl: 'pl_PL',
  'pt-BR': 'pt_BR',
  ru: 'ru_RU',
  sv: 'sv_SE',
  tr: 'tr_TR',
  'zh-CN': 'zh_CN',
  'zh-TW': 'zh_TW',
}

export function isAppLocale(value: string): value is AppLocale {
  return (locales as readonly string[]).includes(value)
}

export function normalizeAppLocale(value: unknown, fallback: AppLocale = defaultLocale): AppLocale {
  if (typeof value === 'string' && isAppLocale(value)) return value
  return fallback
}

/** Prefer explicit sourceLocale, then zh-CN (legacy), then default. */
export function pickSourceLocale(
  candidates: Array<{ locale: AppLocale; sourceLocale?: AppLocale }>
): AppLocale {
  const explicit = candidates.find((c) => c.sourceLocale)?.sourceLocale
  if (explicit && isAppLocale(explicit)) return explicit
  if (candidates.some((c) => c.locale === 'zh-CN')) return 'zh-CN'
  if (candidates.some((c) => c.locale === defaultLocale)) return defaultLocale
  return candidates[0]?.locale || defaultLocale
}
