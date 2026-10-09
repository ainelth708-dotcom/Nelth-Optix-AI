/**
 * Refresh the quota-safe live index from PostgreSQL (top ranked entries).
 * Usage: bun scripts/refresh-live-pg.mts [--top=400]
 * Needs: DATABASE_URL (.env.local).
 */
import { config as loadEnv } from 'dotenv'

import { postgresBackend } from '../agent/catalog/postgres'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

const top = Math.max(
  50,
  Math.min(
    1000,
    Number(
      Object.fromEntries(
        process.argv.slice(2).map(a => {
          const [k, v] = a.replace(/^--/, '').split('=')
          return [k, v ?? 'true']
        })
      ).top ?? 400
    ) || 400
  )
)

async function main(): Promise<void> {
  const res = await postgresBackend.refreshLiveIndex(top)
  console.log(`live index refreshed: kept=${res.kept}`)
}

main().catch(err => {
  console.error('REFRESH FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
