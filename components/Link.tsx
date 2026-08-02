/* eslint-disable jsx-a11y/anchor-has-content */
import { Link } from '@/i18n/navigation'
import type { ComponentProps } from 'react'

type Props = ComponentProps<typeof Link> & {
  href: string
}

const CustomLink = ({ href, ...rest }: Props) => {
  const isInternalLink = href && href.startsWith('/')
  const isAnchorLink = href && href.startsWith('#')

  if (isInternalLink) {
    return <Link className="break-words" href={href} {...rest} />
  }

  if (isAnchorLink) {
    return <a className="break-words" href={href} {...rest} />
  }

  return (
    <a className="break-words" target="_blank" rel="noopener noreferrer" href={href} {...rest} />
  )
}

export default CustomLink
