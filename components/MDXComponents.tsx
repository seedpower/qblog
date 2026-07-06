import TOCInline from 'pliny/ui/TOCInline'
import PreWithMermaid from './PreWithMermaid'
import BlogNewsletterForm from 'pliny/ui/BlogNewsletterForm'
import type { MDXComponents } from 'mdx/types'
import MDXImage from './MDXImage'
import MDXZoomableImg from './MDXZoomableImg'
import CustomLink from './Link'
import TableWrapper from './TableWrapper'

const baseComponents: MDXComponents = {
  Image: MDXImage,
  TOCInline,
  a: CustomLink,
  pre: PreWithMermaid,
  table: TableWrapper,
  BlogNewsletterForm,
}

export const components: MDXComponents = {
  ...baseComponents,
  img: MDXZoomableImg,
}

export function createMDXComponents(blogPath?: string): MDXComponents {
  return {
    ...baseComponents,
    img: (props) => <MDXZoomableImg {...props} blogPath={blogPath} />,
  }
}
