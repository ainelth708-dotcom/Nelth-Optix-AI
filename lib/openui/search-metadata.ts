import type { SearchResultImage, SearchResultItem } from '@/lib/types'

export type OpenUISearchCall = {
  query: string
  results: SearchResultItem[]
  images: SearchResultImage[]
}

export type OpenUISearchMetadata = Record<string, OpenUISearchCall>

const MARKER = '\n<!--nelth-search:'

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

export function splitOpenUISearchMetadata(response: string): {
  content: string
  metadata: OpenUISearchMetadata
} {
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

  const parsed: unknown = JSON.parse(
    decodeURIComponent(response.slice(payloadStart, payloadEnd))
  )
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

  return {
    content: response.slice(0, markerIndex),
    metadata: parsed as OpenUISearchMetadata
  }
}
