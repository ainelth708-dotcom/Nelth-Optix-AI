'use client'

/** Live view of the agent's browser — same design as browser-agent-template. */
export function BrowserPanel({
  liveUrl,
  onNavigate
}: {
  readonly liveUrl: string
  readonly onNavigate?: (url: string) => void
}) {
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
      </div>
      <iframe
        allow="clipboard-read; clipboard-write"
        className="flex-1 border-0 bg-background"
        // Watch-only view: allow the live preview to run, but block
        // top-window navigation, forms, and popups.
        sandbox="allow-scripts allow-same-origin"
        src={liveUrl}
        title="Agent's browser"
      />
    </aside>
  )
}
