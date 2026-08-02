import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import {
  deleteMediaObject,
  isR2Configured,
  listMedia,
  sanitizeObjectKey,
  sanitizePrefix,
  uploadMediaObject,
} from '@/lib/r2'

export const runtime = 'nodejs'

const MAX_UPLOAD_BYTES = 80 * 1024 * 1024

function notConfigured() {
  return NextResponse.json(
    {
      error:
        'R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.',
    },
    { status: 503 }
  )
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isR2Configured()) return notConfigured()

  try {
    const prefix = request.nextUrl.searchParams.get('prefix') || ''
    const data = await listMedia(prefix)
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list media' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isR2Configured()) return notConfigured()

  try {
    const form = await request.formData()
    const file = form.get('file')
    const prefix = sanitizePrefix(String(form.get('prefix') || ''))
    const customName = String(form.get('filename') || '').trim()

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File too large. Max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.` },
        { status: 400 }
      )
    }

    const rawName = customName || file.name
    const safeName = sanitizeObjectKey(rawName.split('/').pop() || rawName)
    if (!safeName) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    const key = sanitizeObjectKey(`${prefix}${safeName}`)
    const buffer = Buffer.from(await file.arrayBuffer())
    const uploaded = await uploadMediaObject({
      key,
      body: buffer,
      contentType: file.type || undefined,
    })

    return NextResponse.json({ ok: true, ...uploaded })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isR2Configured()) return notConfigured()

  try {
    const key =
      request.nextUrl.searchParams.get('key') ||
      String((await request.json().catch(() => ({}))).key || '')
    if (!key) {
      return NextResponse.json({ error: 'key is required' }, { status: 400 })
    }
    const deleted = await deleteMediaObject(key)
    return NextResponse.json({ ok: true, ...deleted })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 500 }
    )
  }
}
