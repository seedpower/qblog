import AdminSettingsForm from '@/components/admin/AdminSettingsForm'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Admin · Settings',
  robots: { index: false, follow: false },
}

export default function AdminSettingsPage() {
  return <AdminSettingsForm />
}
