import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL missing')
const qmark = url.indexOf('?')
const clean = qmark === -1 ? url : url.slice(0, qmark)
const sql = postgres(clean, { prepare: false, ssl: 'require' })
try {
  const tables = await sql`
    select table_name, table_type from information_schema.tables
    where table_schema = 'public' order by 1`
  console.log('TABLES:' + JSON.stringify(tables))
  try {
    const mig = await sql`select id, hash, created_at from __drizzle_migrations order by created_at`
    console.log('MIGRATIONS:' + JSON.stringify(mig))
  } catch {
    console.log('MIGRATIONS: none tracked')
  }
} catch (e) {
  console.log('DBERR:' + (e instanceof Error ? e.message : String(e)).slice(0, 300))
}
await sql.end()
