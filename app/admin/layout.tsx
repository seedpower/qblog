import Link from 'next/link'

export const metadata = {
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="text-sm font-semibold tracking-tight">
            Seedpower Admin
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
          >
            View site
          </Link>
        </div>
      </div>
      {children}
    </div>
  )
}
