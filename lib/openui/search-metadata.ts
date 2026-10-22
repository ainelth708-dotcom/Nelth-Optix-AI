import type { SearchResultImage, SearchResultItem } from '@/lib/types'

export type OpenUISearchCall = {
  query: string
  results: SearchResultItem[]
  images: SearchResultImage[]
}

export type OpenUISearchMetadata = Record<string, OpenUISearchCall>

const MARKER = '\n<!--nelth-search:'
// The route sends the metadata as the FIRST chunk of the stream, so the
// search results are known from the very first delta: inline [n] citations
// resolve into clickable citation components while the answer still streams.
// The leading form has no newline before the marker.
const PREFIX_MARKER = '<!--nelth-search:'

function isSearchCall(value: unknown): value is OpenUISearchCall {
  if (!value || typeof value !== 'object') return false
  const call = value as Partial<OpenUISearchCall>
  return (
    typeof call.query === 'string' &&
    Array.isArray(call.results) &&
    call.results.every(
      result =>
        result &&
        typeof result.title === 'string' &&
        typeof result.url === 'string' &&
        typeof result.content === 'string'
    ) &&
    Array.isArray(call.images) &&
    call.images.every(
      image =>
        typeof image === 'string' ||
        (image !== null &&
          typeof image === 'object' &&
          typeof image.url === 'string' &&
          typeof image.description === 'string')
    )
  )
}

export function appendOpenUISearchMetadata(
  response: string,
  metadata: OpenUISearchMetadata
): string {
  if (Object.keys(metadata).length === 0) return response
  return `${response}${MARKER}${encodeURIComponent(JSON.stringify(metadata))}-->`
}

/**
 * Metadata envelope placed BEFORE the answer text. The route sends it as the
 * first chunk of the stream, so the client knows the search results from the
 * very first delta and inline [n] citations resolve into clickable citation
 * components while the answer is still streaming.
 */
export function prependOpenUISearchMetadata(
  metadata: OpenUISearchMetadata
): string {
  if (Object.keys(metadata).length === 0) return ''
  return `${PREFIX_MARKER}${encodeURIComponent(JSON.stringify(metadata))}-->`
}

function parseOpenUISearchMetadata(payload: string): OpenUISearchMetadata {
  const parsed: unknown = JSON.parse(decodeURIComponent(payload))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('OpenUI search metadata must be an object.')
  }

  const entries = Object.entries(parsed)
  if (
    entries.length === 0 ||
    !entries.every(
      ([toolCallId, search]) => toolCallId.length > 0 && isSearchCall(search)
    )
  ) {
    throw new Error('OpenUI search metadata contains an invalid search result.')
  }

  return parsed as OpenUISearchMetadata
}

export function splitOpenUISearchMetadata(response: string): {
  content: string
  metadata: OpenUISearchMetadata
} {
  // Prefix form: the metadata leads the message (streamed first).
  if (response.startsWith(PREFIX_MARKER)) {
    const payloadStart = PREFIX_MARKER.length
    const payloadEnd = response.indexOf('-->', payloadStart)
    if (payloadEnd < 0) {
      return { content: '', metadata: {} }
    }
    const metadata = parseOpenUISearchMetadata(
      response.slice(payloadStart, payloadEnd)
    )
    return { content: response.slice(payloadEnd + 3), metadata }
  }

  const markerIndex = response.lastIndexOf(MARKER)
  if (markerIndex < 0) return { content: response, metadata: {} }

  const payloadStart = markerIndex + MARKER.length
  const payloadEnd = response.indexOf('-->', payloadStart)
  if (payloadEnd < 0) {
    return { content: response.slice(0, markerIndex), metadata: {} }
  }
  if (response.slice(payloadEnd + 3).trim()) {
    return { content: response, metadata: {} }
  }

  return {
    content: response.slice(0, markerIndex),
    metadata: parseOpenUISearchMetadata(
      response.slice(payloadStart, payloadEnd)
    )
  }
}
