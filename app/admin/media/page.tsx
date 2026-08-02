import AdminMediaManager from '@/components/admin/AdminMediaManager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Admin · Media',
  robots: { index: false, follow: false },
}

export default function AdminMediaPage() {
  return <AdminMediaManager />
}
