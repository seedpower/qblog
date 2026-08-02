import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import siteMetadata from '@/data/siteMetadata'

export type MediaKind = 'image' | 'audio' | 'video' | 'other'

export type MediaObject = {
  key: string
  name: string
  size: number
  lastModified?: string
  url: string
  kind: MediaKind
}

export type MediaFolder = {
  prefix: string
  name: string
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing ${name} environment variable`)
  return value
}

export function getR2PublicBaseUrl() {
  return (
    process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '') ||
    siteMetadata.staticCdn?.replace(/\/$/, '') ||
    'https://static.seedpower.app'
  )
}

export function getR2BucketName() {
  return requiredEnv('R2_BUCKET_NAME')
}

export function isR2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME
  )
}

let cachedClient: S3Client | null = null

export function getR2Client() {
  if (cachedClient) return cachedClient
  const accountId = requiredEnv('R2_ACCOUNT_ID')
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requiredEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requiredEnv('R2_SECRET_ACCESS_KEY'),
    },
  })
  return cachedClient
}

/** Prevent path traversal and normalize object keys. */
export function sanitizeObjectKey(key: string) {
  return key
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part && part !== '.' && part !== '..')
    .join('/')
}

export function sanitizePrefix(prefix: string) {
  const clean = sanitizeObjectKey(prefix)
  return clean ? `${clean}/` : ''
}

export function publicUrlForKey(key: string) {
  const clean = sanitizeObjectKey(key)
  return `${getR2PublicBaseUrl()}/${clean}`
}

export function mediaKindFromKey(key: string): MediaKind {
  const ext = key.split('.').pop()?.toLowerCase() || ''
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico', 'bmp'].includes(ext)) return 'image'
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) return 'audio'
  if (['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv'].includes(ext)) return 'video'
  return 'other'
}

export async function listMedia(prefixInput = '') {
  const prefix = sanitizePrefix(prefixInput)
  const client = getR2Client()
  const bucket = getR2BucketName()

  const folders: MediaFolder[] = []
  const objects: MediaObject[] = []
  let continuationToken: string | undefined

  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        Delimiter: '/',
        ContinuationToken: continuationToken,
        MaxKeys: 200,
      })
    )

    for (const common of res.CommonPrefixes || []) {
      if (!common.Prefix) continue
      const folderPrefix = sanitizePrefix(common.Prefix)
      const name = folderPrefix.slice(prefix.length).replace(/\/$/, '')
      if (!name) continue
      folders.push({ prefix: folderPrefix, name })
    }

    for (const item of res.Contents || []) {
      if (!item.Key || item.Key === prefix || item.Key.endsWith('/')) continue
      const key = sanitizeObjectKey(item.Key)
      objects.push({
        key,
        name: key.slice(prefix.length),
        size: item.Size || 0,
        lastModified: item.LastModified?.toISOString(),
        url: publicUrlForKey(key),
        kind: mediaKindFromKey(key),
      })
    }

    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)

  folders.sort((a, b) => a.name.localeCompare(b.name))
  objects.sort((a, b) => a.name.localeCompare(b.name))

  return { prefix, folders, objects, publicBaseUrl: getR2PublicBaseUrl() }
}

export async function uploadMediaObject(opts: {
  key: string
  body: Buffer
  contentType?: string
  /** Mutable assets (e.g. regenerated cover.png) should use a short / no-cache policy. */
  cacheControl?: string
}) {
  const key = sanitizeObjectKey(opts.key)
  if (!key) throw new Error('Object key is required')

  const client = getR2Client()
  await client.send(
    new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
      Body: opts.body,
      ContentType: opts.contentType || 'application/octet-stream',
      CacheControl: opts.cacheControl || 'public, max-age=31536000, immutable',
    })
  )

  return {
    key,
    url: publicUrlForKey(key),
    kind: mediaKindFromKey(key),
  }
}

export async function deleteMediaObject(keyInput: string) {
  const key = sanitizeObjectKey(keyInput)
  if (!key) throw new Error('Object key is required')
  const client = getR2Client()
  await client.send(
    new DeleteObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
    })
  )
  return { key }
}
