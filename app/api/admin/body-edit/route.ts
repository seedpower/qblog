import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { editPostBody, type BodyEditAction } from '@/lib/edit-body'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const ALLOWED: BodyEditAction[] = [
  'polish',
  'shorten',
  'expand',
  'casual',
  'professional',
  'continue',
  'custom',
]

export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    content?: string
    title?: string
    action?: string
    instruction?: string
    selection?: string
    locale?: 'zh-CN' | 'en'
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = (body.action || 'polish') as BodyEditAction
  if (!ALLOWED.includes(action)) {
    return NextResponse.json({ error: 'invalid action' }, { status: 400 })
  }

  const content = (body.content || '').trim()
  const instruction = (body.instruction || '').trim()
  if (!content && action !== 'custom') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }
  if (action === 'custom' && !instruction) {
    return NextResponse.json({ error: 'instruction is required' }, { status: 400 })
  }
  if (action === 'custom' && !content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  try {
    const result = await editPostBody({
      content,
      title: body.title,
      action,
      instruction,
      selection: body.selection,
      locale: body.locale,
    })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI edit failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
