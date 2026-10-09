/**
 * Re-exported shared PostgreSQL client (canonical implementation lives in
 * lib/db/postgres.ts so both the catalog and chat layers share one pool).
 */
export { getPostgresDb, type PostgresDb } from '@/lib/db/postgres'
