import { Suspense } from 'react'
import AdminLoginForm from '@/components/admin/AdminLoginForm'

export const metadata = {
  title: 'Admin Login',
  robots: { index: false, follow: false },
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading…</div>}>
      <AdminLoginForm />
    </Suspense>
  )
}
