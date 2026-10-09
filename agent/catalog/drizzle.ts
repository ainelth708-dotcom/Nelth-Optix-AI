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

function resolveDatabaseUrl(): string {
  // DATABASE_URL wins when set; otherwise reuse the pooler URL injected by
  // the Vercel ↔ Supabase native integration (transaction mode, port 6543).
  // Server-only in both cases — never any NEXT_PUBLIC_* variable.
  const url =
    process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
  if (!url) {
    throw new Error(
      'No PostgreSQL URL configured (DATABASE_URL or POSTGRES_URL from the Vercel Supabase integration).'
    )
  }
  return url
}

function createDb(): Db {
  const url = resolveDatabaseUrl()
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
