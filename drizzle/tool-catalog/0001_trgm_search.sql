-- Full-text/trigram support for catalog search (kept separate so the base
-- schema migration stays a pure drizzle-kit artifact).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS tool_catalog_name_trgm
  ON tool_catalog USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS tool_catalog_description_trgm
  ON tool_catalog USING gin (description gin_trgm_ops);
