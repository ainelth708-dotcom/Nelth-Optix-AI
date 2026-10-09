import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL missing')
const sql = postgres(url, { prepare: false, ssl: 'require' })
try {
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' order by 1`
  console.log('TABLES:' + JSON.stringify(tables.map(t => t.table_name)))
  const counts = await sql`
    select (select count(*) from chats) as chats,
           (select count(*) from chat_messages) as messages,
           (select count(*) from tool_catalog) as catalog`
  console.log('COUNTS:' + JSON.stringify(counts[0]))
} catch (e) {
  console.log('DBERR:' + (e instanceof Error ? e.message : String(e)).slice(0, 200))
}
await sql.end()
