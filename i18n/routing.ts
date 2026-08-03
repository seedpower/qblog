import { defineRouting } from 'next-intl/routing'
import { defaultLocale, isAppLocale, locales, type AppLocale } from './locales'

export { defaultLocale, isAppLocale, locales, type AppLocale }
export {
  localeLabels,
  localeLanguageNames,
  ogLocaleTags,
  normalizeAppLocale,
  pickSourceLocale,
} from './locales'

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
  // URL is the source of truth so external links (e.g. SuperMark docs)
  // can target a specific locale without Accept-Language / cookie overrides.
  localeDetection: false,
})
