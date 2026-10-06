import { SearchResultImage, SearchResultItem, SearchResults } from '@/lib/types'

import { SearchProvider } from './base'

// Instance chain benchmarked 2026-10-01 across all 22 public 4get
// instances (official list: https://4get.ca/instances — web yep/ddg +
// images brave, real parsed result divs, latency):
// 1. https://4.nboeck.de — web 100 divs ~2.4s (yep), images 200 divs ~1.5s.
// 2. https://4get.sudovanilla.org — web 100 divs ~2.8s (yep; back from 502).
// 3. https://search.yonderly.org — web 10 divs ~3-4s, images 200 divs
//    (IP-blocks some backends intermittently — chain skips it fast then).
// Dropped: https://s.307200.xyz (CSSWAF JS challenge, unusable
// server-side), https://4get.eloy.ar (connection timeout), all others
// (empty result pages from here).
// NOTE: results depend on egress IP — Vercel may rank differently; the
// chain + block-skip design absorbs that (first instance with real
// results wins). Override everything with FOURGET_BASE_URL.
const FOURGET_BASE_URLS = process.env.FOURGET_BASE_URL
  ? [process.env.FOURGET_BASE_URL]
  : [
      'https://4.nboeck.de',
      'https://4get.sudovanilla.org',
      'https://search.yonderly.org'
    ]
const DEFAULT_TIMEOUT_MS = 10000

/**
 * Detects instance-level blocks (IP ban, anti-bot challenge) so the
 * chain skips to the next instance instead of burning all scrapers.
 * Exported for tests.
 */
export function isInstanceBlocked(html: string): boolean {
  return (
    html.includes('blocked from this 4get instance') ||
    html.includes('Tshh, blocked') ||
    html.includes('csswaf') ||
    html.includes('Challenge: please wait') ||
    html.includes('challenge-platform')
  )
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isValidUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function cleanResultUrl(raw: string): string {
  const archiveMatch = raw.match(
    /^https?:\/\/web\.archive\.org\/web\/(?:[0-9*]+\/)?(https?[:%].*)$/i
  )
  if (archiveMatch) {
    try {
      const decoded = decodeURIComponent(archiveMatch[1])
      if (isValidUrl(decoded)) return decoded
    } catch {
      // fallback
    }
  }
  return raw
}

/**
 * 4get Search Provider (instance chain: yonderly → s.307200 → eloy.ar).
 * Open-source, high-privacy, fast metasearch engine supporting both
 * web text search and high-resolution image search with multi-scraper
 * + multi-instance fallback.
 */
export class FourGetSearchProvider implements SearchProvider {
  private bases = FOURGET_BASE_URLS

  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs = DEFAULT_TIMEOUT_MS
  ): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          ...(options.headers || {})
        }
      })
      return response
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Performs a web search on one 4get instance with multi-scraper
   * fallback (yep, yandex, brave, ddg).
   */
  private async searchWeb(
    query: string,
    maxResults: number,
    baseUrl: string
  ): Promise<SearchResultItem[]> {
    const scrapers = ['yep', 'yandex', 'brave', 'ddg']

    for (const scraper of scrapers) {
      try {
        const url = `${baseUrl}/web?s=${encodeURIComponent(query)}&scraper=${scraper}`
        const res = await this.fetchWithTimeout(url)

        if (!res.ok) continue

        const html = await res.text()
        if (html.includes('This scraper returned an error')) {
          continue
        }
        if (isInstanceBlocked(html)) {
          // IP ban / anti-bot challenge: no scraper on this instance
          // will work — bail to the next instance immediately.
          return []
        }

        const results: SearchResultItem[] = []

        // 1. Instant Answer / Wikipedia summary
        const answerMatch = html.match(
          /<div class="answer">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/
        )
        if (answerMatch) {
          const answerBlock = answerMatch[1]
          const titleMatch = answerBlock.match(
            /<div class="answer-title"><a[^>]*href="([^"]*)"[^>]*><h1>([\s\S]*?)<\/h1>/
          )
          const descMatch = answerBlock.match(
            /<div class="description">([\s\S]*?)(?:<a|<div|<\/div>|$)/
          )

          if (titleMatch && descMatch) {
            const title = stripHtml(titleMatch[2])
            const rawUrl = cleanResultUrl(titleMatch[1])
            const content = stripHtml(descMatch[1])
            if (title && content && isValidUrl(rawUrl)) {
              results.push({
                title,
                url: rawUrl,
                content
              })
            }
          }
        }

        // 2. Parse organic <div class="text-result">
        const resultBlocks = html.split('<div class="text-result">').slice(1)
        for (const block of resultBlocks) {
          if (results.length >= maxResults) break

          const hrefMatch = block.match(/<a\b[^>]*\bhref="([^"]+)"[^>]*>/i)
          const titleMatch =
            block.match(
              /<div\b[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/div>/i
            ) || block.match(/<h\d\b[^>]*>([\s\S]*?)<\/h\d>/i)
          const descMatch =
            block.match(
              /<div\b[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i
            ) || block.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)

          if (hrefMatch && titleMatch && descMatch) {
            const rawUrl = cleanResultUrl(hrefMatch[1])
            const title = stripHtml(titleMatch[1])
            const content = stripHtml(descMatch[1])

            if (
              isValidUrl(rawUrl) &&
              title &&
              content &&
              !results.some(r => r.url === rawUrl)
            ) {
              results.push({
                title,
                url: rawUrl,
                content
              })
            }
          }
        }

        if (results.length > 0) {
          return results
        }
      } catch (err) {
        console.warn(`[4get] Web scraper ${scraper} failed:`, err)
      }
    }

    return []
  }

  /**
   * Performs an image search on one 4get instance with multi-scraper
   * fallback.
   */
  private async searchImages(
    query: string,
    maxResults: number,
    baseUrl: string
  ): Promise<SearchResultImage[]> {
    const scrapers = ['brave', 'yep', 'ddg', 'unsplash', 'yandex']

    for (const scraper of scrapers) {
      try {
        const url = `${baseUrl}/images?s=${encodeURIComponent(query)}&scraper=${scraper}`
        const res = await this.fetchWithTimeout(url)

        if (!res.ok) continue

        const html = await res.text()
        if (html.includes('This scraper returned an error')) {
          continue
        }
        if (isInstanceBlocked(html)) {
          return []
        }

        const images: SearchResultImage[] = []
        const imageBlocks = html.split('<div class="image-wrapper"').slice(1)

        for (const block of imageBlocks) {
          if (images.length >= maxResults) break

          const dataJsonMatch = block.match(/data-json="([^"]+)"/)
          const titleMatch =
            block.match(/title="([^"]*)"/) ||
            block.match(/<div class="description">([\s\S]*?)<\/div>/)
          const title = titleMatch ? stripHtml(titleMatch[1]) : 'Image'

          let fullUrl = ''

          if (dataJsonMatch) {
            try {
              const unescaped = dataJsonMatch[1]
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&#039;/g, "'")
              const parsed = JSON.parse(unescaped)
              if (
                Array.isArray(parsed) &&
                parsed.length > 0 &&
                parsed[0]?.url
              ) {
                fullUrl = parsed[0].url
              }
            } catch {
              // ignore
            }
          }

          if (!fullUrl) {
            const thumbLinkMatch = block.match(
              /<a\s+href="([^"]+)"[^>]*class="thumb"/i
            )
            if (thumbLinkMatch && isValidUrl(thumbLinkMatch[1])) {
              fullUrl = thumbLinkMatch[1]
            }
          }

          if (fullUrl && isValidUrl(fullUrl)) {
            // Use the ORIGINAL direct image URL. The DuckDuckGo
            // external-content proxy was tried before but its hotlinked URLs
            // fail to load in browsers (403/broken renders), so direct URLs
            // are primary (client falls back to the proxy on error).
            if (
              !images.some(
                img => (typeof img === 'string' ? img : img.url) === fullUrl
              )
            ) {
              images.push({
                url: fullUrl,
                description: title,
                title
              })
            }
          }
        }

        if (images.length > 0) {
          return images
        }
      } catch (err) {
        console.warn(`[4get] Image scraper ${scraper} failed:`, err)
      }
    }

    return []
  }

  async search(
    query: string,
    maxResults = 10,
    _searchDepth: 'basic' | 'advanced' = 'basic',
    includeDomains: string[] = [],
    excludeDomains: string[] = [],
    options?: {
      type?: 'general' | 'optimized'
      content_types?: Array<'web' | 'video' | 'image' | 'news'>
    }
  ): Promise<SearchResults> {
    const contentTypes = options?.content_types || ['web']
    const wantsImages = contentTypes.includes('image')
    const wantsWeb = contentTypes.includes('web')

    let effectiveQuery = query.trim()
    if (includeDomains.length > 0) {
      effectiveQuery += ` ${includeDomains.map(d => `site:${d}`).join(' ')}`
    }
    if (excludeDomains.length > 0) {
      effectiveQuery += ` ${excludeDomains.map(d => `-site:${d}`).join(' ')}`
    }

    let results: SearchResultItem[] = []
    let images: SearchResultImage[] = []

    // Instance chain: first base with real results wins.
    for (const baseUrl of this.bases) {
      const tasks: Promise<void>[] = []

      if (wantsWeb || !wantsImages) {
        tasks.push(
          (async () => {
            try {
              results = await this.searchWeb(
                effectiveQuery,
                maxResults,
                baseUrl
              )
            } catch (err) {
              console.warn('[4get] Web search error:', err)
            }
          })()
        )
      }

      if (wantsImages) {
        tasks.push(
          (async () => {
            try {
              images = await this.searchImages(effectiveQuery, 20, baseUrl)
            } catch (err) {
              console.warn('[4get] Image search error:', err)
            }
          })()
        )
      }

      await Promise.all(tasks)

      if (results.length > 0 || images.length > 0) break
    }

    return {
      query,
      results,
      images,
      number_of_results: results.length
    }
  }
}
