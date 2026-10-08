import type { ToolCatalogEntry } from './types'

/**
 * Local full-text index over the catalog. Indexed fields: name, description,
 * category, capabilities, keywords, source, type, auth, free (spec §5).
 * Scoring = relevance + free/no-auth priority + https + reliability (§6, §13).
 */

const STOP = new Set(
  'le la les de des du un une et est en sur dans que qui pour pas plus avec nous vous ils elles son sa ses au aux ce cette ces mon ma mes ton ta tes je tu il elle on nous y a est sont était fais fait faire donne donne-moi donne moi quel quelle quels quelles combien comment pourquoi quoi qui où ou est-ce que the a an and or of to in on for with is are was were what which who how do does donne-moi stp plaît merci salut bonjour hello hi'.split(' ')
)

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, ' ')
    .split(/[^a-zà-ÿ0-9+.#]+/i)
    .map(t => t.trim())
    .filter(t => t.length > 1 && !STOP.has(t))
}

export type IndexedEntry = {
  entry: ToolCatalogEntry
  tokens: Map<string, number>
}

function entryText(entry: ToolCatalogEntry): { text: string; boost: number }[] {
  return [
    { text: entry.name, boost: 5 },
    { text: entry.category, boost: 3 },
    { text: entry.capabilities.join(' '), boost: 3 },
    { text: entry.keywords.join(' '), boost: 3 },
    { text: entry.description, boost: 1 }
  ]
}

export function buildIndex(entries: ToolCatalogEntry[]): IndexedEntry[] {
  return entries.map(entry => {
    const tokens = new Map<string, number>()
    for (const { text, boost } of entryText(entry)) {
      for (const token of tokenize(text)) {
        tokens.set(token, (tokens.get(token) ?? 0) + boost)
      }
    }
    return { entry, tokens }
  })
}

export type SearchFilters = {
  type?: 'rest' | 'openapi' | 'mcp' | 'all'
  auth?: 'none' | 'any'
  free?: boolean
  verified?: boolean
  vercelCompatible?: boolean
  category?: string
  limit?: number
}

function matchesFilters(entry: ToolCatalogEntry, f: SearchFilters): boolean {
  if (f.type && f.type !== 'all' && entry.type !== f.type) return false
  if (f.auth === 'none' && entry.auth !== 'none') return false
  if (f.free === true && !entry.free) return false
  if (f.verified === true && !entry.verified) return false
  if (f.vercelCompatible === true && entry.vercelCompatible !== true) return false
  if (f.category && entry.category.toLowerCase() !== f.category.toLowerCase()) return false
  return true
}

function priorityBoost(entry: ToolCatalogEntry): number {
  // §6–§7: executableNow first, then free + no-auth + HTTPS + verified.
  let score = 0
  if (entry.executableNow === true) score += 8
  if (entry.free) score += 4
  if (entry.auth === 'none') score += 5
  if (entry.https) score += 2
  if (entry.verified) score += 3
  if (entry.verificationStatus === 'verified') score += 3
  if (entry.verificationStatus === 'dead') score -= 6
  score += (entry.reliability ?? 0.5) * 4
  return score
}

export type ScoredEntry = { entry: ToolCatalogEntry; score: number }

export function searchIndex(
  index: IndexedEntry[],
  query: string,
  filters: SearchFilters = {}
): ScoredEntry[] {
  const limit = Math.max(1, Math.min(100, filters.limit ?? 10))
  const terms = tokenize(query)
  const scored: ScoredEntry[] = []
  for (const { entry, tokens } of index) {
    if (!matchesFilters(entry, filters)) continue
    let relevance = 0
    if (terms.length === 0) {
      relevance = 1
    } else {
      for (const term of terms) {
        const exact = tokens.get(term) ?? 0
        if (exact > 0) {
          relevance += exact * 2
          continue
        }
        // Prefix/stem sympathy: 'météo'≈'meteo', 'currenc'≈'currency'.
        for (const [token, weight] of tokens) {
          if (token.startsWith(term) || term.startsWith(token)) {
            relevance += weight * 0.7
            break
          }
        }
      }
    }
    if (terms.length > 0 && relevance === 0) continue
    scored.push({ entry, score: relevance * 3 + priorityBoost(entry) })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}

/** Exact-behavior probes required by the spec (§5). */
export function findTools(
  index: IndexedEntry[],
  query: string,
  filters: SearchFilters = {}
): ToolCatalogEntry[] {
  return searchIndex(index, query, filters).map(s => s.entry)
}
