import type { SearchResultImage, SearchResultItem } from '@/lib/types'

/**
 * Reader for the `nelth.search.status` SSE event the OpenUI chat route emits
 * around its web search preload (`searching` → `done`). The event rides the
 * same stream as the OpenAI Responses events, which the react-ui adapter
 * ignores, so this watcher is its only consumer.
 *
 * The watcher is line-based and pure: feed it decoded chunks, it reports
 * status transitions once each. It is robust to chunk boundaries splitting an
 * event in the middle.
 */

export const WEB_SEARCH_STATUS_EVENT = 'nelth.search.status'
export const WEB_SEARCH_RESULTS_EVENT = 'nelth.search.results'

/**
 * Attribute toggled on <html> while the route is running a web search; the
 * OpenUI stylesheet swaps the loading shimmer's "Working" label with it.
 */
export const WEB_SEARCH_STATUS_ATTRIBUTE = 'data-nelth-web-searching'

export type WebSearchStatus = 'searching' | 'done'

function readStatus(line: string): WebSearchStatus | null {
  if (!line.startsWith('data: ')) return null
  const payload = line.slice(6).trim()
  if (!payload.includes(WEB_SEARCH_STATUS_EVENT)) return null
  try {
    const event = JSON.parse(payload) as { type?: unknown; status?: unknown }
    if (event.type !== WEB_SEARCH_STATUS_EVENT) return null
    return event.status === 'searching' || event.status === 'done'
      ? event.status
      : null
  } catch {
    return null
  }
}

/**
 * Feed decoded SSE chunks here; `report(true)` fires once when the route
 * starts searching and `report(false)` once it finishes. Repeated statuses
 * are coalesced, and every other event, comment or malformed payload is
 * ignored.
 */
export function createSearchStatusWatcher(
  report: (searching: boolean) => void
): (chunk: string) => void {
  let buffer = ''
  let last: boolean | null = null

  return chunk => {
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const status = readStatus(line)
      if (!status) continue
      const searching = status === 'searching'
      if (last === searching) continue
      last = searching
      report(searching)
    }
  }
}

/**
 * Callback registered by SearchResultsProvider so the SSE watcher can push
 * preloaded search results into React state as soon as they arrive (before
 * the model starts streaming).
 */
export let searchResultsCallback:
  | ((
      results: SearchResultItem[],
      query: string,
      images: SearchResultImage[]
    ) => void)
  | undefined

/**
 * Registers the React state setter so the SSE watcher can push preloaded
 * search results into context as soon as they arrive.
 */
export function registerSearchResultsCallback(
  cb: (
    results: SearchResultItem[],
    query: string,
    images: SearchResultImage[]
  ) => void
) {
  searchResultsCallback = cb
}

/**
 * Watcher for the `nelth.search.results` SSE event. Feeds decoded chunks,
 * extracts the search results payload, and calls `onResults` once with the
 * parsed results.
 */
function readSearchResults(line: string): {
  query: string
  results: SearchResultItem[]
  images: SearchResultImage[]
} | null {
  if (!line.startsWith('data: ')) return null
  const payload = line.slice(6).trim()
  if (!payload.includes(WEB_SEARCH_RESULTS_EVENT)) return null
  try {
    const event = JSON.parse(payload) as {
      type?: unknown
      query?: unknown
      results?: unknown
      images?: unknown
    }
    if (
      event.type !== WEB_SEARCH_RESULTS_EVENT ||
      !Array.isArray(event.results)
    ) {
      return null
    }
    return {
      query: typeof event.query === 'string' ? event.query : '',
      results: event.results as SearchResultItem[],
      images: Array.isArray(event.images)
        ? (event.images as SearchResultImage[])
        : []
    }
  } catch {
    return null
  }
}

export function createSearchResultsWatcher(
  onResults: (
    results: SearchResultItem[],
    query: string,
    images: SearchResultImage[]
  ) => void
): (chunk: string) => void {
  let buffer = ''
  let emitted = false

  return chunk => {
    if (emitted) return
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const parsed = readSearchResults(line)
      if (!parsed) continue
      emitted = true
      onResults(parsed.results, parsed.query, parsed.images)
      return
    }
  }
}
