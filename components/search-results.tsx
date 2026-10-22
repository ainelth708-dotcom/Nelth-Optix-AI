'use client'

import { useState } from 'react'
import Link from 'next/link'

import { SearchResultItem } from '@/lib/types'
import { displayUrlName } from '@/lib/utils/domain'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export interface SearchResultsProps {
  results: SearchResultItem[]
  displayMode?: 'grid' | 'list'
}

/** A search result URL can be malformed, so it is never parsed blindly. */
function parseUrl(url: string): { hostname: string; pathname: string } | null {
  try {
    const parsed = new URL(url)
    return { hostname: parsed.hostname, pathname: parsed.pathname }
  } catch {
    return null
  }
}

export function SearchResults({
  results,
  displayMode = 'grid'
}: SearchResultsProps) {
  // State to manage whether to display the results
  const [showAllResults, setShowAllResults] = useState(false)

  const handleViewMore = () => {
    setShowAllResults(true)
  }

  // Logic for grid mode
  const displayedGridResults = showAllResults ? results : results.slice(0, 3)
  const additionalResultsCount = results.length > 3 ? results.length - 3 : 0

  // --- List Mode Rendering ---
  // Side panel (citations): a flat list of sources, the way ChatGPT shows
  // them — favicon, title, domain and a short snippet, no heavy card.
  if (displayMode === 'list') {
    return (
      <div className="flex flex-col">
        {results.map((result, index) => {
          const url = parseUrl(result.url)
          const hostname = url?.hostname ?? ''
          const title = result.title || url?.pathname || hostname

          return (
            <Link
              href={result.url}
              key={index}
              passHref
              target="_blank"
              rel="noopener noreferrer"
              className="-mx-2 flex gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
            >
              <Avatar className="mt-0.5 size-5 shrink-0 rounded-[5px]">
                <AvatarImage
                  src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=64`}
                  alt={hostname}
                />
                <AvatarFallback className="rounded-[5px] text-[10px]">
                  {hostname.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                  {title}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {hostname}
                </p>
                {result.content ? (
                  <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">
                    {result.content}
                  </p>
                ) : null}
              </div>
            </Link>
          )
        })}
      </div>
    )
  }

  // --- Grid Mode Rendering (Existing Logic) ---
  return (
    <div className="flex flex-col gap-1 md:-m-1 md:flex-row md:flex-wrap md:gap-0">
      {displayedGridResults.map((result, index) => (
        <div className="min-w-0 md:w-1/4 md:p-1" key={index}>
          <Link href={result.url} passHref target="_blank">
            <Card className="h-full flex-1 rounded-md hover:bg-muted/50 transition-colors">
              <CardContent className="flex h-full min-w-0 items-center justify-between gap-2 p-2 md:flex-col md:items-stretch">
                <p className="min-w-0 flex-1 line-clamp-1 text-xs md:min-h-8 md:line-clamp-2">
                  {result.title || result.content}
                </p>
                <div className="flex max-w-[42%] shrink-0 items-center space-x-1 min-w-0 md:mt-2 md:max-w-full md:shrink">
                  <Avatar className="h-4 w-4 shrink-0">
                    <AvatarImage
                      src={`https://www.google.com/s2/favicons?domain=${
                        parseUrl(result.url)?.hostname ?? ''
                      }`}
                      alt={parseUrl(result.url)?.hostname ?? ''}
                    />
                    <AvatarFallback>
                      {parseUrl(result.url)?.hostname.charAt(0) ?? '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-xs opacity-60 truncate min-w-0">
                    {displayUrlName(result.url)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      ))}
      {!showAllResults && additionalResultsCount > 0 && (
        <>
          <div className="flex justify-center py-1 md:hidden">
            <Button
              variant="link"
              className="h-auto px-2 py-1 text-muted-foreground"
              onClick={handleViewMore}
            >
              View {additionalResultsCount} more
            </Button>
          </div>
          <div className="hidden md:block md:w-1/4 md:p-1">
            <Card className="flex h-full flex-1 items-center justify-center">
              <CardContent className="p-2">
                <Button
                  variant="link"
                  className="text-muted-foreground"
                  onClick={handleViewMore}
                >
                  View {additionalResultsCount} more
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
