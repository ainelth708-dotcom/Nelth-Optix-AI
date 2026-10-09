import { defineConfig } from 'drizzle-kit'

/**
 * Versioned migrations for the Tool Catalog (drizzle/ directory).
 * dbCredentials are only needed when generating/applying — never at runtime.
 */
export default defineConfig({
  schema: './agent/catalog/schema.ts',
  out: './drizzle/tool-catalog',
  dialect: 'postgresql',
  strict: true,
  verbose: true
})
