import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'

export default async function AdminEditPostLink({ postId }: { postId?: string }) {
  if (!postId) return null
  if (!(await requireAdmin())) return null

  return (
    <div className="pointer-events-none fixed top-24 right-4 z-40 sm:right-6">
      <Link
        href={`/admin/posts/${postId}`}
        className="pointer-events-auto glass glass-pill inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-[var(--ink)] shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow)]"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
        Edit
      </Link>
    </div>
  )
}
