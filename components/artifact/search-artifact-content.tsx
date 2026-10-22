'use client'

import type { SearchResults as TypeSearchResults } from '@/lib/types'
import type { ToolPart } from '@/lib/types/ai'

import { SearchResults } from '@/components/search-results'
import { SearchResultsImageSection } from '@/components/search-results-image'
import { Section } from '@/components/section'
import {
  createVideoSearchResults,
  VideoSearchResults
} from '@/components/video-search-results'

export function SearchArtifactContent({ tool }: { tool: ToolPart<'search'> }) {
  // Handle streaming output states
  const output = tool.state === 'output-available' ? tool.output : undefined
  const searchResults: TypeSearchResults | undefined =
    output?.state === 'complete' ? output : undefined
  const query = tool.input?.query

  const hasResults =
    searchResults &&
    ((searchResults.results && searchResults.results.length > 0) ||
      (searchResults.videos && searchResults.videos.length > 0) ||
      (searchResults.images && searchResults.images.length > 0))

  if (!hasResults) {
    return <div className="p-4">No search results</div>
  }

  return (
    <div className="space-y-4">
      {query ? (
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {query}
        </p>
      ) : null}

      {/* Skip the grid for large image sets (image search): answer shows them directly. */}
      {searchResults.images &&
        searchResults.images.length > 0 &&
        searchResults.images.length <= 3 && (
          <SearchResultsImageSection
            images={searchResults.images}
            query={query}
            displayMode="full"
          />
        )}

      {searchResults.videos && searchResults.videos.length > 0 && (
        <Section title="Videos">
          <VideoSearchResults
            results={createVideoSearchResults(searchResults, query)}
            displayMode="artifact"
          />
        </Section>
      )}

      {searchResults.results && searchResults.results.length > 0 && (
        <section>
          <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sources
          </h4>
          <SearchResults results={searchResults.results} displayMode="list" />
        </section>
      )}
    </div>
  )
}
