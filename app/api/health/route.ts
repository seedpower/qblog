export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Liveness probe — no Mongo, MDX, or page render. */
export function GET() {
  return new Response('ok', {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
