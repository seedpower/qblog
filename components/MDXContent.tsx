import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { remarkAlert } from 'remark-github-blockquote-alert'
import { remarkCodeTitles, remarkImgToJsx } from 'pliny/mdx-plugins/index.js'
import rehypeSlug from 'rehype-slug'
import rehypeKatex from 'rehype-katex'
import rehypeKatexNoTranslate from 'rehype-katex-notranslate'
import rehypePrismPlus from 'rehype-prism-plus'
import { createMDXComponents } from '@/components/MDXComponents'

type Props = {
  source: string
  blogPath?: string
}

export default function MDXContent({ source, blogPath }: Props) {
  return (
    <MDXRemote
      source={source}
      components={createMDXComponents(blogPath)}
      options={{
        mdxOptions: {
          remarkPlugins: [remarkGfm, remarkCodeTitles, remarkMath, remarkImgToJsx, remarkAlert],
          rehypePlugins: [
            rehypeSlug,
            rehypeKatex,
            rehypeKatexNoTranslate,
            [rehypePrismPlus, { defaultLanguage: 'js', ignoreMissing: true }],
          ],
        },
      }}
    />
  )
}
