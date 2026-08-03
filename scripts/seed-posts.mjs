#!/usr/bin/env node
/**
 * Seed MongoDB posts from data/blog MDX files.
 *
 * Loads .env.local / .env automatically.
 * Usage: yarn seed
 */
import { promises as fs, readFileSync, existsSync } from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { MongoClient } from 'mongodb'

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  const text = readFileSync(filePath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

loadEnvFile(path.join(process.cwd(), '.env'))
loadEnvFile(path.join(process.cwd(), '.env.local'))

const blogRoot = path.join(process.cwd(), 'data', 'blog')
const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB || 'blog'

if (!uri) {
  console.error('Missing MONGODB_URI (set it in .env.local or the environment)')
  process.exit(1)
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return walk(full)
      if (entry.isFile() && /\.mdx?$/.test(entry.name)) return [full]
      return []
    })
  )
  return files.flat()
}

function toSlug(filePath) {
  const rel = path.relative(blogRoot, filePath).replace(/\\/g, '/')
  return rel.replace(/\.mdx?$/, '')
}

async function main() {
  const files = await walk(blogRoot)
  const client = new MongoClient(uri)
  await client.connect()
  const collection = client.db(dbName).collection('posts')
  await collection.createIndex({ slug: 1, locale: 1 }, { unique: true })
  // Drop legacy slug-only unique index if present
  try {
    await collection.dropIndex('slug_1')
  } catch {
    // ignore if missing
  }

  let upserted = 0
  for (const file of files) {
    const raw = await fs.readFile(file, 'utf8')
    const { data, content } = matter(raw)
    if (!data.title) {
      console.warn(`Skip (no title): ${file}`)
      continue
    }
    const slug = toSlug(file)
    const now = new Date()
    const images = Array.isArray(data.images)
      ? data.images
      : typeof data.images === 'string'
        ? [data.images]
        : []

    const doc = {
      title: data.title,
      slug,
      path: `blog/${slug}`,
      date: data.date ? new Date(data.date).toISOString() : now.toISOString(),
      lastmod: data.lastmod ? new Date(data.lastmod).toISOString() : undefined,
      tags: Array.isArray(data.tags) ? data.tags : [],
      draft: Boolean(data.draft),
      summary: data.summary || '',
      images,
      authors: Array.isArray(data.authors) ? data.authors : ['default'],
      layout: data.layout || undefined,
      youtube: data.youtube || undefined,
      locale: data.locale || 'zh-CN',
      translationKey: data.translationKey || slug,
      sourceLocale: data.sourceLocale || data.locale || 'zh-CN',
      body: content.trim(),
      updatedAt: now,
    }

    await collection.updateOne(
      { slug },
      {
        $set: doc,
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    )
    upserted += 1
    console.log(`Upserted: ${slug}`)
  }

  console.log(`Done. ${upserted} posts upserted into ${dbName}.posts`)
  await client.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
