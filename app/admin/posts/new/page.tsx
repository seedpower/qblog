import AdminPostEditor from '@/components/admin/AdminPostEditor'

export const metadata = {
  title: 'New Post',
  robots: { index: false, follow: false },
}

export default function NewPostPage() {
  return <AdminPostEditor />
}
