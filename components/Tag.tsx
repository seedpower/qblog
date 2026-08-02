import Link from '@/components/Link'
import { slug } from 'github-slugger'

interface Props {
  text: string
}

const Tag = ({ text }: Props) => {
  return (
    <Link
      href={`/tags/${slug(text)}`}
      className="glass glass-pill text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 inline-flex px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase transition"
    >
      {text.split(' ').join('-')}
    </Link>
  )
}

export default Tag
