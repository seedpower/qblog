import { MongoClient, Db, Collection } from 'mongodb'
import type { PostInput } from './types'

export type PostDocument = PostInput & {
  path: string
  createdAt: Date
  updatedAt: Date
}

const uri = process.env.MONGODB_URI

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

function getClientPromise(): Promise<MongoClient> {
  if (!uri) {
    throw new Error('Missing MONGODB_URI environment variable')
  }

  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri)
      global._mongoClientPromise = client.connect()
    }
    return global._mongoClientPromise
  }

  const client = new MongoClient(uri)
  return client.connect()
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise()
  return client.db(process.env.MONGODB_DB || 'blog')
}

export async function getPostsCollection(): Promise<Collection<PostDocument>> {
  const db = await getDb()
  return db.collection<PostDocument>('posts')
}
