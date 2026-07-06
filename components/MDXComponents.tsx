import TOCInline from 'pliny/ui/TOCInline'
import PreWithMermaid from './PreWithMermaid'
import BlogNewsletterForm from 'pliny/ui/BlogNewsletterForm'
import type { MDXComponents } from 'mdx/types'
import MDXImage from './MDXImage'
import MDXZoomableImg from './MDXZoomableImg'
import CustomLink from './Link'
import TableWrapper from './TableWrapper'

export const components: MDXComponents = {
  Image: MDXImage,
  img: MDXZoomableImg,
  TOCInline,
  a: CustomLink,
  pre: PreWithMermaid,
  table: TableWrapper,
  BlogNewsletterForm,
}
