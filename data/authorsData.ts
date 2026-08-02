import type { Author, PostLocale } from '@/lib/types'

type AuthorSource = Omit<Author, 'body'> & {
  /** Fallback / English body */
  body: string
  bodies?: Partial<Record<PostLocale, string>>
}

export const authors: AuthorSource[] = [
  {
    slug: 'default',
    name: 'Seedpower',
    avatar: '/static/favicons/android-chrome-192x192.png',
    body: `Seedpower builds products that help creators and teams grow faster.

We write about AI tools, product workflows, and practical lessons from shipping software.`,
    bodies: {
      en: `Seedpower builds products that help creators and teams grow faster.

We write about AI tools, product workflows, and practical lessons from shipping software.`,
      'zh-CN': `Seedpower 专注于帮助创作者与团队更高效地成长。

我们分享 AI 工具、产品工作流，以及把产品做出来的实践经验。`,
    },
  },
]
