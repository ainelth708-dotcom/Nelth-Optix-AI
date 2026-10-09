-- Nelth-IA Tool Catalog on Supabase PostgreSQL.
-- Run in the Supabase SQL editor (or psql with the project connection string).
-- Access is server-side only via SUPABASE_SERVICE_ROLE_KEY: RLS is left
-- DISABLED on these tables on purpose (service_role bypasses RLS anyway and
-- no browser key must ever touch them). Never expose these tables publicly.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------- catalog --
create table if not exists tool_catalog (
  id text primary key,
  name text not null,
  description text not null default '',
  category text not null default 'Uncategorized',
  source text not null default 'atlas',
  type text not null default 'rest' check (type in ('rest', 'openapi', 'mcp')),
  endpoint text,
  documentation_url text,
  repository text,
  transport text,
  auth text not null default 'unknown'
    check (auth in ('none', 'api_key', 'oauth', 'bearer', 'basic', 'unknown')),
  free boolean not null default false,
  verified boolean not null default false,
  https boolean not null default false,
  cors boolean,
  vercel_compatible boolean,
  capabilities text[] not null default '{}',
  keywords text[] not null default '{}',
  rate_limit text,
  license text,
  reliability double precision not null default 0.5,
  last_checked timestamptz,
  -- execution honesty: only ever set from observed results, never fabricated
  executable_now boolean not null default false,
  requires_credential boolean not null default false,
  credential_configured boolean not null default false,
  verification_status text not null default 'unverified'
    check (verification_status in ('verified', 'unverified', 'dead',
      'requires_auth', 'invalid_spec', 'rate_limited',
      'temporarily_unavailable', 'requires_params')),
  last_verified_at timestamptz,
  failure_reason text,
  requires_external_host boolean not null default false,
  execution_plan jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tool_catalog_type_idx on tool_catalog (type);
create index if not exists tool_catalog_auth_idx on tool_catalog (auth);
create index if not exists tool_catalog_free_idx on tool_catalog (free) where free;
create index if not exists tool_catalog_verified_idx on tool_catalog (verified) where verified;
create index if not exists tool_catalog_executable_now_idx on tool_catalog (executable_now) where executable_now;
create index if not exists tool_catalog_verification_status_idx on tool_catalog (verification_status);
create index if not exists tool_catalog_category_idx on tool_catalog (category);
create index if not exists tool_catalog_source_idx on tool_catalog (source);
create index if not exists tool_catalog_capabilities_gin on tool_catalog using gin (capabilities);
create index if not exists tool_catalog_name_trgm on tool_catalog using gin (name gin_trgm_ops);
create index if not exists tool_catalog_description_trgm on tool_catalog using gin (description gin_trgm_ops);

-- ------------------------------------------------------- sync checkpoints --
-- Resumable migration/sync state (survives restarts, no duplicates by design:
-- upserts keyed on tool_catalog.id).
create table if not exists catalog_sync_state (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------- live index doc --
-- Quota-safe hot path: ONE row the agent reads instead of scanning 10k rows.
create table if not exists tool_catalog_live (
  id text primary key,
  entries jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ meta --
create table if not exists tool_catalog_meta (
  id text primary key,
  last_sync timestamptz
);
