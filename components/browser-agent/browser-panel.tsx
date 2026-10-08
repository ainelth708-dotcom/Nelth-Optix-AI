'use client'

import { useState } from 'react'

import { ExternalLink, RefreshCw } from 'lucide-react'

/**
 * Sites connus pour refuser l'affichage en iframe
 * (X-Frame-Options: DENY / frame-ancestors). Le navigateur affiche alors
 * "<site> n'autorise pas la connexion" — ce n'est pas un bug du panneau,
 * c'est le site qui l'interdit. On l'explique et on propose l'ouverture
 * externe (ou la version intégrée pour YouTube).
 */
const BLOCKED_HOSTS = [
  'youtube.com',
  'youtu.be',
  'google.com',
  'facebook.com',
  'instagram.com',
  'x.com',
  'twitter.com',
  'github.com',
  'linkedin.com',
  'netflix.com'
]

function isKnownBlocked(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    return BLOCKED_HOSTS.some(
      blocked => host === blocked || host.endsWith(`.${blocked}`)
    )
  } catch {
    return false
  }
}

/** youtube.com/watch?v=ID (ou youtu.be/ID) → lecteur intégré autorisé. */
function youtubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = parsed.searchParams.get('v')
      if (id) return `https://www.youtube-nocookie.com/embed/${id}`
      return null
    }
    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0]
      if (id) return `https://www.youtube-nocookie.com/embed/${id}`
      return null
    }
    return null
  } catch {
    return null
  }
}

/** Live view of the agent's browser — same design as browser-agent-template. */
export function BrowserPanel({
  liveUrl,
  onNavigate
}: {
  readonly liveUrl: string
  readonly onNavigate?: (url: string) => void
}) {
  const [reloadKey, setReloadKey] = useState(0)
  const [useEmbed, setUseEmbed] = useState(false)
  const blocked = isKnownBlocked(liveUrl)
  const embedUrl = youtubeEmbedUrl(liveUrl)
  const shownUrl = useEmbed && embedUrl ? embedUrl : liveUrl

  return (
    <aside className="flex h-dvh w-1/2 shrink-0 flex-col border-l border-border bg-muted/20">
      <div className="flex h-14 shrink-0 items-center gap-2 px-4 text-sm text-muted-foreground">
        <span className="shrink-0">Agent&apos;s browser</span>
        <form
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={e => {
            e.preventDefault()
            const data = new FormData(e.currentTarget)
            const raw = String(data.get('url') ?? '').trim()
            if (!raw || !onNavigate) return
            const normalized = /^https?:\/\//i.test(raw)
              ? raw
              : `https://${raw}`
            setUseEmbed(false)
            onNavigate(normalized)
          }}
        >
          <input
            name="url"
            key={liveUrl}
            defaultValue={liveUrl}
            spellCheck={false}
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs text-foreground"
          />
        </form>
        <button
          type="button"
          onClick={() => setReloadKey(k => k + 1)}
          aria-label="Recharger"
          title="Recharger"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <RefreshCw size={15} />
        </button>
        <a
          href={liveUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Ouvrir dans un nouvel onglet"
          title="Ouvrir dans un nouvel onglet"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ExternalLink size={15} />
        </a>
      </div>
      {blocked ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span className="min-w-0 flex-1">
            Ce site refuse l’affichage intégré (« n’autorise pas la
            connexion ») — c’est le site qui l’interdit, pas le panneau.
          </span>
          {embedUrl ? (
            <button
              type="button"
              onClick={() => setUseEmbed(v => !v)}
              className="shrink-0 rounded-full border border-amber-500/40 px-2 py-0.5 font-medium transition-colors hover:bg-amber-500/20"
            >
              {useEmbed ? 'Version site' : '▶ Version intégrée'}
            </button>
          ) : (
            <a
              href={liveUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-full border border-amber-500/40 px-2 py-0.5 font-medium transition-colors hover:bg-amber-500/20"
            >
              Ouvrir ↗
            </a>
          )}
        </div>
      ) : null}
      <iframe
        key={`${shownUrl}-${reloadKey}`}
        allow="clipboard-read; clipboard-write"
        className="flex-1 border-0 bg-background"
        // Watch-only view: allow the live preview to run, but block
        // top-window navigation, forms, and popups.
        sandbox="allow-scripts allow-same-origin"
        src={shownUrl}
        title="Agent's browser"
      />
    </aside>
  )
}
