import { NextRequest, NextResponse } from 'next/server'
import {
  createAdminSession,
  setAdminCookie,
  clearAdminCookie,
  verifyAdminPassword,
} from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const password = String(body.password || '')
    if (!verifyAdminPassword(password)) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }
    const token = await createAdminSession()
    const response = NextResponse.json({ ok: true })
    setAdminCookie(response, token)
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  clearAdminCookie(response)
  return response
}
