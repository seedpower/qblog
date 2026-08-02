import Link from 'next/link'

export const metadata = {
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen text-[var(--ink)]">
      <div className="sticky top-0 z-50 px-2 pt-3 sm:px-3">
        <div className="glass glass-pill mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[var(--ink)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/static/favicons/favicon.svg"
              alt=""
              width={22}
              height={22}
              className="h-5 w-5"
            />
            Seedpower Admin
          </Link>
          <Link
            href="/"
            className="rounded-full px-3 py-1 text-sm text-[var(--ink-soft)] transition hover:bg-white/55 hover:text-[var(--ink)] dark:hover:bg-white/12"
          >
            View site
          </Link>
        </div>
      </div>
      {children}
    </div>
  )
}
