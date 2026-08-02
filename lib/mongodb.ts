import { MongoClient, Db, Collection, type MongoClientOptions } from 'mongodb'
import type { PostInput } from './types'

export type PostDocument = PostInput & {
  path: string
  createdAt: Date
  updatedAt: Date
}

const uri = process.env.MONGODB_URI

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

const clientOptions: MongoClientOptions = {
  // Railway private networking can flap briefly; prefer retry over hard fail.
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 60_000,
  serverSelectionTimeoutMS: 10_000,
  connectTimeoutMS: 10_000,
  socketTimeoutMS: 45_000,
  retryWrites: true,
  retryReads: true,
}

function getClientPromise(): Promise<MongoClient> {
  if (!uri) {
    throw new Error('Missing MONGODB_URI environment variable')
  }

  // Always cache on globalThis — production Next.js can evaluate this module
  // more than once; creating a client per request exhausts Mongo and surfaces
  // MongoNetworkError / SystemOverloadedError on Railway.
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, clientOptions)
    global._mongoClientPromise = client.connect().catch((error) => {
      global._mongoClientPromise = undefined
      throw error
    })
  }

  return global._mongoClientPromise
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise()
  return client.db(process.env.MONGODB_DB || 'blog')
}

export async function getPostsCollection(): Promise<Collection<PostDocument>> {
  const db = await getDb()
  return db.collection<PostDocument>('posts')
}
