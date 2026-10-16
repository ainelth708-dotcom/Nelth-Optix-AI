'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState} from 'react'

import { ExternalLink, FileText, Image as ImageIcon, X } from 'lucide-react'

import type {
  OpenUISearchCall,
  OpenUISearchMetadata
} from '@/lib/openui/search-metadata'
import type { SearchResultImage, SearchResultItem } from '@/lib/types'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'

export type OpenUISource = {
  id: string
  kind: 'web' | 'image'
  title: string
  url: string
  description: string
  query: string
  imageUrl?: string
}

const LocalSourcesContext = createContext<OpenUISearchMetadata>({})

type CitationPanelContextValue = {
  openCitationPanel: (sources: OpenUISource[], activeId?: string) => void
}

const CitationPanelContext = createContext<CitationPanelContextValue | null>(
  null
)

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : null
  } catch {
    return null
  }
}

function imageDetails(image: SearchResultImage): {
  title: string
  url: string
  description: string
  imageUrl: string
} | null {
  if (typeof image === 'string') {
    const url = safeHttpUrl(image)
    return url
      ? { title: 'Image search result', url, description: '', imageUrl: url }
      : null
  }

  const imageUrl = safeHttpUrl(image.url)
  if (!imageUrl) return null
  const sourceUrl = safeHttpUrl(image.sourceUrl ?? '') ?? imageUrl
  return {
    title: image.title || image.description || 'Image search result',
    url: sourceUrl,
    description: image.description,
    imageUrl
  }
}

export function getOpenUISources(
  metadata: OpenUISearchMetadata
): OpenUISource[] {
  return Object.entries(metadata).flatMap(([toolCallId, search]) => {
    const webSources = search.results.flatMap((result, index) => {
      const url = safeHttpUrl(result.url)
      return url
        ? [
            {
              id: `${toolCallId}:web:${index + 1}`,
              kind: 'web' as const,
              title: result.title,
              url,
              description: result.content,
              query: search.query
            }
          ]
        : []
    })
    const imageSources = search.images.flatMap((image, index) => {
      const details = imageDetails(image)
      return details
        ? [
            {
              id: `${toolCallId}:image:${index + 1}`,
              kind: 'image' as const,
              ...details,
              query: search.query
            }
          ]
        : []
    })
    return [...webSources, ...imageSources]
  })
}

export function OpenUISourcesProvider({
  metadata,
  children
}: {
  metadata: OpenUISearchMetadata
  children: ReactNode
}) {
  return (
    <LocalSourcesContext.Provider value={metadata}>
      {children}
    </LocalSourcesContext.Provider>
  )
}

export function OpenUICitationPanelProvider({
  children
}: {
  children: ReactNode
}) {
  const [sources, setSources] = useState<OpenUISource[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const openCitationPanel = useCallback(
    (nextSources: OpenUISource[], nextActiveId?: string) => {
      setSources(nextSources)
      setActiveId(nextActiveId ?? nextSources[0]?.id ?? null)
    },
    []
  )
  const contextValue = useMemo(
    () => ({ openCitationPanel }),
    [openCitationPanel]
  )
  const activeSource = sources.find(source => source.id === activeId)

  return (
    <CitationPanelContext.Provider value={contextValue}>
      {children}
      <Sheet
        open={Boolean(activeSource)}
        onOpenChange={open => {
          if (!open) setActiveId(null)
        }}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-hidden border-l border-border/70 p-0 shadow-2xl sm:max-w-xl"
        >
          <SheetHeader className="border-b border-border/70 px-6 py-5 text-left">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <FileText className="size-4 text-primary" />
                  Sources
                </SheetTitle>
                <SheetDescription className="mt-1">
                  Sources used to prepare this answer.
                </SheetDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close sources panel"
                onClick={() => setActiveId(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </SheetHeader>
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="min-h-0 overflow-y-auto border-b border-border/70 p-3 md:border-b-0 md:border-r">
              {sources.map((source, index) => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => setActiveId(source.id)}
                  className={`mb-2 w-full rounded-xl border p-3 text-left transition-colors ${
                    activeId === source.id
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-transparent hover:border-border hover:bg-muted/60'
                  }`}
                >
                  <span className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {source.kind === 'image' ? (
                      <ImageIcon className="size-3.5" />
                    ) : (
                      <FileText className="size-3.5" />
                    )}
                    {source.kind === 'image' ? 'Image' : `Source ${index + 1}`}
                  </span>
                  <span className="line-clamp-2 block text-sm font-medium text-foreground">
                    {source.title}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {new URL(source.url).hostname}
                  </span>
                </button>
              ))}
            </div>
            {activeSource && (
              <article className="min-h-0 overflow-y-auto p-5">
                {activeSource.imageUrl && (
                  <img
                    src={activeSource.imageUrl}
                    alt={activeSource.title}
                    className="mb-5 aspect-video w-full rounded-xl bg-muted object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {activeSource.kind === 'image'
                    ? 'Image result'
                    : 'Web source'}
                </p>
                <h3 className="text-lg font-semibold leading-snug text-foreground">
                  {activeSource.title}
                </h3>
                <p className="mt-2 text-xs text-muted-foreground">
                  Search: {activeSource.query}
                </p>
                {activeSource.description && (
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {activeSource.description}
                  </p>
                )}
                <a
                  href={activeSource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Open source
                  <ExternalLink className="size-4" />
                </a>
              </article>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </CitationPanelContext.Provider>
  )
}

export function useOpenUICitationPanel() {
  const context = useContext(CitationPanelContext)
  if (!context) {
    throw new Error(
      'OpenUI citations must be rendered inside OpenUICitationPanelProvider.'
    )
  }
  return context
}

export function useOpenUISources() {
  return useContext(LocalSourcesContext)
}
