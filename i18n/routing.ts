import { defineRouting } from 'next-intl/routing'

export const locales = ['en', 'zh-CN'] as const
export type AppLocale = (typeof locales)[number]
export const defaultLocale: AppLocale = 'en'

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
  localeDetection: true,
})

export function isAppLocale(value: string): value is AppLocale {
  return (locales as readonly string[]).includes(value)
}
