import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

/**
 * Server-only PostgreSQL client for Supabase's transaction-mode pooler
 * (port 6543). `prepare: false` is MANDATORY: the pooler forbids prepared
 * statements. Small pool + short idle timeout for the Vercel runtime.
 * Reads DATABASE_URL only — never any NEXT_PUBLIC_* variable.
 */

type Db = PostgresJsDatabase<typeof schema>

const globals = globalThis as unknown as { __nelthPgDb?: Db }

function createDb(): Db {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not configured (server-only Supabase pooler URL).'
    )
  }
  const client = postgres(url, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: 'require'
  })
  return drizzle(client, { schema })
}

export function getPostgresDb(): Db {
  if (!globals.__nelthPgDb) {
    globals.__nelthPgDb = createDb()
  }
  return globals.__nelthPgDb
}
