import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { requireAdmin } from '@/lib/auth'
import {
  deleteMediaObject,
  getMediaObjectBytes,
  isR2Configured,
  listAllMediaObjects,
  listMedia,
  renameMediaObject,
  sanitizeObjectKey,
  sanitizePrefix,
  uploadMediaObject,
} from '@/lib/r2'

export const runtime = 'nodejs'

const MAX_UPLOAD_BYTES = 80 * 1024 * 1024
const MAX_ZIP_FILES = 300
const MAX_ZIP_BYTES = 200 * 1024 * 1024

type UploadBlob = {
  name?: string
  type?: string
  size: number
  arrayBuffer: () => Promise<ArrayBuffer>
}

function notConfigured() {
  return NextResponse.json(
    {
      error:
        'R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.',
    },
    { status: 503 }
  )
}

/** Avoid `instanceof File` — some Node runtimes (e.g. Railway) have no global File. */
function asUploadBlob(value: FormDataEntryValue | null): UploadBlob | null {
  if (!value || typeof value === 'string') return null
  const candidate = value as UploadBlob
  if (typeof candidate.arrayBuffer !== 'function' || typeof candidate.size !== 'number') {
    return null
  }
  return candidate
}

function zipDownloadName(prefix: string) {
  const parts = prefix.replace(/\/+$/, '').split('/').filter(Boolean)
  const base = parts[parts.length - 1] || 'media'
  return `${base.replace(/[^\w.\u4e00-\u9fff-]+/g, '-') || 'media'}.zip`
}

async function zipFolderResponse(prefixInput: string) {
  const prefix = sanitizePrefix(prefixInput)
  if (!prefix) {
    return NextResponse.json({ error: 'prefix is required for zip download' }, { status: 400 })
  }

  const { objects } = await listAllMediaObjects(prefix)
  if (!objects.length) {
    return NextResponse.json({ error: 'Folder is empty' }, { status: 404 })
  }
  if (objects.length > MAX_ZIP_FILES) {
    return NextResponse.json(
      { error: `Too many files (${objects.length}). Max ${MAX_ZIP_FILES} per zip.` },
      { status: 413 }
    )
  }

  const totalSize = objects.reduce((sum, item) => sum + (item.size || 0), 0)
  if (totalSize > MAX_ZIP_BYTES) {
    return NextResponse.json(
      {
        error: `Folder too large (${Math.round(totalSize / (1024 * 1024))}MB). Max ${Math.round(MAX_ZIP_BYTES / (1024 * 1024))}MB.`,
      },
      { status: 413 }
    )
  }

  const zip = new JSZip()
  for (const item of objects) {
    // Keep relative paths inside the zip (supports nested keys under the prefix).
    const entryName = item.name || item.key.split('/').pop() || item.key
    if (!entryName || entryName.includes('..')) continue
    const file = await getMediaObjectBytes(item.key)
    zip.file(entryName, file.body)
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  const filename = zipDownloadName(prefix)
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isR2Configured()) return notConfigured()

  try {
    const prefix = request.nextUrl.searchParams.get('prefix') || ''
    const download = request.nextUrl.searchParams.get('download') || ''
    if (download === 'zip') {
      return await zipFolderResponse(prefix)
    }
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
    const file = asUploadBlob(form.get('file'))
    const prefix = sanitizePrefix(String(form.get('prefix') || ''))
    const customName = String(form.get('filename') || '').trim()

    if (!file) {
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

    const rawName = customName || file.name || 'upload.bin'
    const safeName = sanitizeObjectKey(rawName.split('/').pop() || rawName)
    if (!safeName) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    const key = sanitizeObjectKey(`${prefix}${safeName}`)
    const buffer = Buffer.from(await file.arrayBuffer())
    // Regenerated covers overwrite the same key — avoid long CDN TTL
    const isMutableCover = /^cover\.(png|jpe?g|webp)$/i.test(safeName)
    const uploaded = await uploadMediaObject({
      key,
      body: buffer,
      contentType: file.type || undefined,
      cacheControl: isMutableCover
        ? 'public, max-age=0, must-revalidate'
        : 'public, max-age=31536000, immutable',
    })

    return NextResponse.json({
      ok: true,
      ...uploaded,
      // Help clients bust edge/browser caches after overwrite
      url: isMutableCover ? `${uploaded.url}?v=${Date.now()}` : uploaded.url,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isR2Configured()) return notConfigured()

  try {
    const body = await request.json().catch(() => ({}))
    const key = String(body.key || '').trim()
    const newName = String(body.newName || body.name || '').trim()
    if (!key) {
      return NextResponse.json({ error: 'key is required' }, { status: 400 })
    }
    if (!newName) {
      return NextResponse.json({ error: 'newName is required' }, { status: 400 })
    }
    const renamed = await renameMediaObject(key, newName)
    return NextResponse.json({ ok: true, ...renamed })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Rename failed' },
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
