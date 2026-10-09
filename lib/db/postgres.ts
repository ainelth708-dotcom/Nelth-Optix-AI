import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

/**
 * Shared server-only PostgreSQL client (Supabase transaction pooler).
 * `prepare: false` is mandatory on port 6543. Singleton via globalThis for
 * the Vercel runtime. Reads DATABASE_URL, falls back to POSTGRES_URL
 * (Vercel ↔ Supabase native integration). Never any NEXT_PUBLIC_* variable.
 */

export type PostgresDb = PostgresJsDatabase<Record<string, never>>

const globals = globalThis as unknown as { __nelthPgDb?: PostgresDb }

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
  if (!url) {
    throw new Error(
      'No PostgreSQL URL configured (DATABASE_URL or POSTGRES_URL).'
    )
  }
  return url
}

function createDb(): PostgresDb {
  const client = postgres(resolveDatabaseUrl(), {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: 'require'
  })
  return drizzle(client)
}

export function getPostgresDb(): PostgresDb {
  if (!globals.__nelthPgDb) {
    globals.__nelthPgDb = createDb()
  }
  return globals.__nelthPgDb
}
