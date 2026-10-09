/**
 * Applies drizzle/tool-catalog/*.sql in journal order, statement by
 * statement, with per-statement errors. Tracks applied tags in
 * catalog_sync_state (key 'migrations_applied') — no drizzle-kit needed,
 * works through the transaction pooler.
 * Usage: bun scripts/apply-migrations.mts
 * Needs: DATABASE_URL (.env.local).
 */
import { config as loadEnv } from 'dotenv'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('Missing DATABASE_URL')
  const qmark = url.indexOf('?')
  const clean = qmark === -1 ? url : url.slice(0, qmark)
  const sql = postgres(clean, { prepare: false, ssl: 'require', max: 2 })
  try {
    const dir = join(process.cwd(), 'drizzle', 'tool-catalog')
    const journal = JSON.parse(
      readFileSync(join(dir, 'meta', '_journal.json'), 'utf8')
    ) as { entries: Array<{ tag: string }> }
    await sql`
      CREATE TABLE IF NOT EXISTS catalog_sync_state (
        key text primary key,
        value jsonb not null default '{}'::jsonb,
        updated_at timestamptz not null default now())`
    const appliedRows = await sql`
      SELECT value FROM catalog_sync_state WHERE key = 'migrations_applied'`
    const applied = new Set<string>(
      ((appliedRows[0]?.value as { tags?: string[] })?.tags ?? []) as string[]
    )
    for (const { tag } of journal.entries) {
      if (applied.has(tag)) {
        console.log(`SKIP ${tag} (already applied)`)
        continue
      }
      const file = join(dir, `${tag}.sql`)
      const content = readFileSync(file, 'utf8')
      const statements = content
        .split(/-->\s*statement-breakpoint/)
        .map(s => s.trim())
        .filter(s => s.length > 0)
      console.log(`APPLY ${tag} (${statements.length} statements)`)
      for (let i = 0; i < statements.length; i++) {
        try {
          await sql.unsafe(statements[i] as string)
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          // Idempotent reruns: objects created by an earlier partial run
          // (or by this script's own bootstrap) are skipped, not fatal.
          if (/already exists/i.test(message)) {
            console.log(`SKIP ${tag}#${i} (already exists)`)
            continue
          }
          console.log(`FAILED ${tag}#${i}: ${message.slice(0, 300)}`)
          throw e
        }
      }
      applied.add(tag)
      await sql`
        INSERT INTO catalog_sync_state (key, value, updated_at)
        VALUES ('migrations_applied', ${JSON.stringify({ tags: [...applied] })}::jsonb, now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`
      console.log(`OK ${tag}`)
    }
    console.log('MIGRATIONS DONE')
  } finally {
    await sql.end()
  }
}

main().catch(err => {
  console.error('MIGRATE FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
