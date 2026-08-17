export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  try {
    const sharp = (await import('sharp')).default
    sharp.cache({ memory: 16, files: 0, items: 20 })
    sharp.concurrency(1)
  } catch {
    // sharp is optional until an OG/image route loads it
  }
}
