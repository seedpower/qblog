import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import {
  getOpenRouterPublicSettings,
  updateOpenRouterSettings,
} from '@/lib/settings'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const settings = await getOpenRouterPublicSettings()
  return NextResponse.json({ settings })
}

export async function PUT(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    openRouterApiKey?: string | null
    openRouterModel?: string | null
    clearApiKey?: boolean
    clearModel?: boolean
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const patch: {
      openRouterApiKey?: string | null
      openRouterModel?: string | null
    } = {}

    if (body.clearApiKey) {
      patch.openRouterApiKey = ''
    } else if (typeof body.openRouterApiKey === 'string') {
      // Ignore masked placeholder submissions (unchanged key).
      const value = body.openRouterApiKey.trim()
      if (value && !value.includes('•')) {
        patch.openRouterApiKey = value
      }
    }

    if (body.clearModel) {
      patch.openRouterModel = ''
    } else if (typeof body.openRouterModel === 'string') {
      patch.openRouterModel = body.openRouterModel.trim()
    }

    const settings = await updateOpenRouterSettings(patch)
    return NextResponse.json({ settings })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Save failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
