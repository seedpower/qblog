import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export const ADMIN_COOKIE = 'blog_admin_session'
const SESSION_TTL = '7d'

function getSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error('Missing AUTH_SECRET environment variable')
  }
  return new TextEncoder().encode(secret)
}

export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) {
    throw new Error('Missing ADMIN_PASSWORD environment variable')
  }
  return password === expected
}

export async function createAdminSession(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(getSecret())
}

export async function isAdminSessionValid(token?: string | null): Promise<boolean> {
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload.role === 'admin'
  } catch {
    return false
  }
}

export async function requireAdmin(): Promise<boolean> {
  const jar = await cookies()
  return isAdminSessionValid(jar.get(ADMIN_COOKIE)?.value)
}

export function setAdminCookie(response: NextResponse, token: string) {
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
}

export function clearAdminCookie(response: NextResponse) {
  response.cookies.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  return isAdminSessionValid(request.cookies.get(ADMIN_COOKIE)?.value)
}
