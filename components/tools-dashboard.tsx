'use client'

import { useCallback, useEffect, useState } from 'react'

type Stats = {
  total: number
  apis: number
  mcp: number
  free: number
  noAuth: number
  verified: number
  executable: number
  executableNow?: number
  requiresAuth?: number
  dead?: number
  unverified?: number
  mcpExecutable?: number
  mcpRequiresExternalHost?: number
  testedOk?: number
  categories: number
  lastSync: string | null
  source: 'firestore' | 'seed'
}

type ToolRow = {
  id: string
  name: string
  description: string
  category: string
  source: string
  type: 'rest' | 'openapi' | 'mcp'
  documentationUrl?: string
  repository?: string
  auth: string
  free: boolean
  verified: boolean
  https: boolean
  vercelCompatible?: boolean
  capabilities: string[]
  reliability?: number
  score?: number
}

type Kind = 'all' | 'rest' | 'openapi' | 'mcp'

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input text-muted-foreground hover:bg-accent'
      }`}
    >
      {children}
    </button>
  )
}

export function ToolsDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [tools, setTools] = useState<ToolRow[]>([])
  const [query, setQuery] = useState('weather')
  const [kind, setKind] = useState<Kind>('all')
  const [noAuth, setNoAuth] = useState(false)
  const [freeOnly, setFreeOnly] = useState(false)
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [vercelOnly, setVercelOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [syncType, setSyncType] = useState<'all' | 'api' | 'mcp'>('api')
  const [cursors, setCursors] = useState<{ api: string | null; mcp: string | null } | null>(null)

  const loadStats = useCallback(async () => {
    const res = await fetch('/api/tools/stats')
    if (res.ok) setStats((await res.json()) as Stats)
  }, [])

  const search = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ q: query, limit: '30' })
      if (kind !== 'all') params.set('type', kind)
      if (noAuth) params.set('auth', 'none')
      if (freeOnly) params.set('free', 'true')
      if (verifiedOnly) params.set('verified', 'true')
      if (vercelOnly) params.set('vercelCompatible', 'true')
      const res = await fetch(`/api/tools/search?${params.toString()}`)
      if (res.ok) {
        const data = (await res.json()) as { tools: ToolRow[] }
        setTools(data.tools)
      }
    } finally {
      setLoading(false)
    }
  }, [query, kind, noAuth, freeOnly, verifiedOnly, vercelOnly])

  useEffect(() => {
    void loadStats()
    void search()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sync = async () => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/tools/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: syncType,
          pages: 10,
          limit: 200,
          cursors: cursors ?? undefined
        })
      })
      const data = (await res.json()) as {
        error?: string
        authRequired?: boolean
        fetched?: number
        upserted?: number
        duplicatesSkipped?: number
        done?: boolean
        nextCursors?: { api: string | null; mcp: string | null }
        stats?: Stats
      }
      if (!res.ok) {
        setSyncMsg(
          data.authRequired
            ? 'Connectez-vous pour synchroniser le catalogue.'
            : (data.error ?? `Échec (${res.status})`)
        )
        return
      }
      setCursors(data.nextCursors ?? null)
      if (data.stats) setStats(data.stats)
      setSyncMsg(
        `+${data.fetched ?? 0} récupérées, ${data.upserted ?? 0} enregistrées (${data.duplicatesSkipped ?? 0} doublons ignorés). ${data.done ? 'Terminé ✓' : 'Relancez pour continuer →'}`
      )
    } catch {
      setSyncMsg('Synchronisation impossible pour le moment.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Tool Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Registre unifié APIs + MCP · découverte par pertinence · chiffres
            réels, jamais en dur
            {stats ? (
              <span className="ml-2 rounded-full border border-input px-2 py-0.5 text-xs">
                source : {stats.source}
                {stats.lastSync ? ` · sync ${stats.lastSync.slice(0, 10)}` : ' · jamais synchronisé'}
              </span>
            ) : null}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Total APIs" value={stats?.apis ?? '…'} />
        <StatCard label="No-auth" value={stats?.noAuth ?? '…'} />
        <StatCard label="MCP servers" value={stats?.mcp ?? '…'} />
        <StatCard label="Exécutables" value={stats?.executable ?? '…'} />
        <StatCard label="Exécutables now" value={stats?.executableNow ?? '…'} />
        <StatCard label="Vérifiés" value={stats?.verified ?? '…'} />
        <StatCard label="Testés OK" value={stats?.testedOk ?? stats?.verified ?? '…'} />
        <StatCard label="Requièrent clé" value={stats?.requiresAuth ?? '…'} />
        <StatCard label="Morts" value={stats?.dead ?? '…'} />
        <StatCard label="MCP exécutables" value={stats?.mcpExecutable ?? '…'} />
        <StatCard label="MCP host externe" value={stats?.mcpRequiresExternalHost ?? stats?.mcp ?? '…'} />
        <StatCard label="Gratuits" value={stats?.free ?? '…'} />
        <StatCard label="Catégories" value={stats?.categories ?? '…'} />
        <StatCard label="Total entrées" value={stats?.total ?? '…'} />
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void search()
            }}
            placeholder="Search tools… ex. weather, scientific papers, github repository"
            className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none"
          />
          <button
            type="button"
            onClick={() => search()}
            disabled={loading}
            className="h-10 shrink-0 rounded-lg bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50"
          >
            {loading ? '…' : 'Chercher'}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['all', 'rest', 'openapi', 'mcp'] as Kind[]).map(k => (
            <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
              {k === 'all' ? 'Tous' : k.toUpperCase()}
            </Chip>
          ))}
          <Chip active={noAuth} onClick={() => setNoAuth(v => !v)}>
            No Auth
          </Chip>
          <Chip active={freeOnly} onClick={() => setFreeOnly(v => !v)}>
            Free
          </Chip>
          <Chip active={verifiedOnly} onClick={() => setVerifiedOnly(v => !v)}>
            Verified
          </Chip>
          <Chip active={vercelOnly} onClick={() => setVercelOnly(v => !v)}>
            Vercel Compatible
          </Chip>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {tools.map(t => (
          <div
            key={t.id}
            className="rounded-xl border border-border bg-card px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{t.name}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {t.type}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {t.category}
              </span>
              {t.free ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                  free
                </span>
              ) : null}
              {t.auth === 'none' ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                  no-auth
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {t.auth}
                </span>
              )}
              {t.verified ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                  ✓ vérifié
                </span>
              ) : null}
              {typeof t.score === 'number' ? (
                <span className="ml-auto text-[11px] text-muted-foreground">
                  score {t.score}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.description || '—'}
            </p>
            <div className="mt-1 flex flex-wrap gap-2 text-xs">
              {t.documentationUrl ? (
                <a
                  href={t.documentationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  Docs ↗
                </a>
              ) : null}
              {t.repository ? (
                <a
                  href={t.repository}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  Repo ↗
                </a>
              ) : null}
              <span className="text-muted-foreground">{t.source}</span>
            </div>
          </div>
        ))}
        {!loading && tools.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun résultat.</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium">Synchronisation (API Atlas)</p>
        <p className="text-xs text-muted-foreground">
          Bornée par appel (10 pages × 200 entrées) : relancez avec les
          curseurs jusqu’à « Terminé ✓ ». Sans doublons (upsert par id).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {(['api', 'mcp', 'all'] as const).map(t => (
            <Chip
              key={t}
              active={syncType === t}
              onClick={() => {
                setSyncType(t)
                setCursors(null)
              }}
            >
              {t}
            </Chip>
          ))}
          <button
            type="button"
            onClick={() => sync()}
            disabled={syncing}
            className="h-9 rounded-lg bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50"
          >
            {syncing ? 'Sync…' : cursors ? 'Continuer la sync →' : 'Synchroniser'}
          </button>
        </div>
        {syncMsg ? (
          <p className="text-xs text-muted-foreground">{syncMsg}</p>
        ) : null}
      </div>
    </div>
  )
}
