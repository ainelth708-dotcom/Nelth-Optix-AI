import type { LanguageModel } from 'ai'

import {
  academicTool,
  bookTool,
  countryTool,
  crossrefTool,
  holidaysTool,
  musicTool,
  npmTool,
  openalexTool,
  pokemonTool,
  pypiTool,
  quakeTool,
  semanticscholarTool,
  spacexTool,
  wikidataTool
} from '../adapters'
import {
  arxivTool,
  cryptoTool,
  currencyTool,
  dictionaryTool,
  githubTool,
  newsTool,
  weatherTool,
  wikipediaTool
} from '../bricks'
import {
  calculatorTool,
  createDelegateResearchTool,
  createWebSearchTool,
  datetimeTool
} from '../tools'
import { createOpenApiTool } from './exec'
import { searchIndex, tokenize, type IndexedEntry } from './index'
import type { ToolCatalogEntry } from './types'

/**
 * Tool Router (§13): capability extraction → catalog search → ranked
 * selection → schema-validated execution (AI SDK validates inputSchema).
 * Only EXECUTABLE tools (verified + implemented here, never MCP) are handed
 * to the model — the catalog can hold thousands of entries, the prompt only
 * ever sees ≤ MAX_TOOLS. Ranking = relevance + free + no-auth + https +
 * reliability (§6); fallback chains order equivalents (§14).
 */

export const MAX_ROUTER_TOOLS = 10

const CORE_TOOL_IDS = ['web_search', 'calculator', 'datetime']

/** Fallback chains: best first; the composite wins when it exists. */
export const FALLBACK_CHAINS: Record<string, string[]> = {
  academic: ['academic_search', 'arxiv', 'openalex', 'crossref', 'semanticscholar'],
  weather: ['weather'],
  currency: ['currency'],
  crypto: ['crypto'],
  dictionary: ['dictionary'],
  wiki: ['wikipedia'],
  news: ['tech_news', 'web_search'],
  github: ['github'],
  packages: ['npm', 'pypi'],
  books: ['book'],
  music: ['music'],
  country: ['country'],
  space: ['spacex'],
  earthquake: ['quake'],
  holidays: ['holidays'],
  pokemon: ['pokemon'],
  entities: ['wikidata'],
  datetime: ['datetime'],
  calculator: ['calculator'],
  research: ['delegate_research', 'academic_search', 'web_search']
}

const CAPABILITY_TERMS: Record<string, string[]> = {
  weather: ['météo', 'meteo', 'weather', 'forecast', 'pluie', 'température', 'temperature', 'climat', 'quel temps'],
  academic: ['article', 'articles', 'papier', 'papers', 'scientifique', 'scientific', 'étude', 'etude', 'thèse', 'these', 'publication', 'arxiv', 'doi', 'littérature', 'universitaire'],
  github: ['github', 'repository', 'repo', 'dépôt', 'depot', 'stars', 'étoiles'],
  currency: ['devise', 'currency', 'exchange', 'taux', 'euro', 'dollar', 'ariary', 'convertir', 'conversion', 'forex'],
  country: ['pays', 'country', 'capitale', 'capital', 'population', 'drapeau', 'flag', 'carte', 'maps', 'madagascar'],
  earthquake: ['séisme', 'seisme', 'earthquake', 'tremblement'],
  music: ['musique', 'music', 'chanson', 'morceau', 'artiste', 'song', 'album'],
  books: ['livre', 'livres', 'book', 'roman', 'auteur', 'author', 'couverture'],
  packages: ['npm', 'package', 'paquet', 'pypi', 'pip', 'librairie', 'library', 'version', 'dépendance'],
  crypto: ['crypto', 'bitcoin', 'ethereum', 'solana', 'doge', 'cours', 'prix crypto'],
  dictionary: ['dictionnaire', 'dictionary', 'définition', 'definition', 'mot anglais', 'word', 'english', 'veut dire'],
  wiki: ['wikipédia', 'wikipedia', 'encyclopédie', 'encyclopedia', 'qui est', 'résumé'],
  news: ['news', 'actualités', 'actualites', 'actu', 'tech', 'hacker', 'nouvelles', 'dernieres'],
  space: ['spacex', 'espace', 'space', 'lancement', 'fusée', 'fusee', 'rocket', 'nasa'],
  holidays: ['férié', 'ferie', 'fériés', 'holiday', 'vacances', 'jours fériés'],
  pokemon: ['pokémon', 'pokemon', 'pikachu', 'pokedex'],
  entities: ['wikidata', 'entité', 'entite'],
  datetime: ['date', 'heure', 'time', "aujourd'hui", 'aujourdhui', 'clock', 'quelle heure', 'jour'],
  calculator: ['calcul', 'calculatrice', 'math', 'combien', 'addition', 'diviser', 'multiplier', 'pourcent'],
  research: ['approfondi', 'approfondie', 'dossier', 'comparatif', 'comparer', 'analyse', 'analyser', 'déléguer', 'deleguer', 'deep', 'exhaustif', 'complète']
}

export function extractCapabilities(text: string): string[] {
  const tokens = new Set(tokenize(text))
  const scored: Array<{ cap: string; score: number }> = []
  for (const [cap, terms] of Object.entries(CAPABILITY_TERMS)) {
    let score = 0
    for (const term of terms) {
      const parts = term.split(' ')
      if (parts.every(p => tokens.has(p))) score += parts.length
    }
    if (score > 0) scored.push({ cap, score })
  }
  scored.sort((a, b) => b.score - a.score)
  const caps = scored.map(s => s.cap)
  // Long/complex requests get the research subagent even without keywords.
  if (text.length > 220 && !caps.includes('research')) caps.push('research')
  return caps
}

function chainRank(capability: string, toolId: string): number {
  const chain = FALLBACK_CHAINS[capability]
  if (!chain) return 0
  const idx = chain.indexOf(toolId)
  return idx === -1 ? chain.length + 1 : idx
}

export type Builder = () => unknown

export function executableBuilders(model: LanguageModel): Record<string, Builder> {
  return {
    web_search: () => createWebSearchTool(),
    calculator: () => calculatorTool,
    datetime: () => datetimeTool,
    delegate_research: () => createDelegateResearchTool(model),
    weather: () => weatherTool,
    currency: () => currencyTool,
    crypto: () => cryptoTool,
    dictionary: () => dictionaryTool,
    wikipedia: () => wikipediaTool,
    tech_news: () => newsTool,
    github: () => githubTool,
    arxiv: () => arxivTool,
    academic_search: () => academicTool,
    openalex: () => openalexTool,
    crossref: () => crossrefTool,
    semanticscholar: () => semanticscholarTool,
    npm: () => npmTool,
    pypi: () => pypiTool,
    book: () => bookTool,
    music: () => musicTool,
    country: () => countryTool,
    spacex: () => spacexTool,
    quake: () => quakeTool,
    holidays: () => holidaysTool,
    pokemon: () => pokemonTool,
    wikidata: () => wikidataTool
  }
}

function localId(entry: ToolCatalogEntry): string | null {
  return entry.id.startsWith('local:') ? entry.id.slice('local:'.length) : null
}

// Re-exported so routes can build dynamic tools without extra imports.
export { createOpenApiTool }

export function discoverRelevant(
  index: IndexedEntry[],
  text: string,
  capabilities: string[],
  limit = 12
): ToolCatalogEntry[] {
  const seen = new Set<string>()
  const out: ToolCatalogEntry[] = []
  for (const scored of searchIndex(index, text, { limit })) {
    if (seen.has(scored.entry.id)) continue
    seen.add(scored.entry.id)
    out.push(scored.entry)
  }
  // Coverage guarantee: every detected capability gets its best executable.
  for (const cap of capabilities) {
    const terms = CAPABILITY_TERMS[cap]
    if (!terms) continue
    const found = searchIndex(index, terms.slice(0, 6).join(' '), {
      limit: 4
    }).find(
      s =>
        !seen.has(s.entry.id) &&
        s.entry.verified &&
        s.entry.type !== 'mcp'
    )
    if (found) {
      seen.add(found.entry.id)
      out.push(found.entry)
    }
  }
  // Fallback-chain order within each capability family.
  const primaryCap = capabilities[0]
  if (primaryCap && FALLBACK_CHAINS[primaryCap]) {
    out.sort((a, b) => {
      const ida = localId(a)
      const idb = localId(b)
      if (ida && idb) return chainRank(primaryCap, ida) - chainRank(primaryCap, idb)
      return 0
    })
  }
  return out.slice(0, limit)
}

export function buildAgentTools(
  index: IndexedEntry[],
  entries: ToolCatalogEntry[],
  text: string,
  model: LanguageModel,
  maxTools = MAX_ROUTER_TOOLS
): { tools: Record<string, never>; pickedIds: string[]; capabilities: string[] } {
  const capabilities = extractCapabilities(text)
  const builders = executableBuilders(model)
  const picked: string[] = []
  const tools: Record<string, never> = {}
  const take = (id: string) => {
    if (picked.includes(id) || picked.length >= maxTools) return
    const builder = builders[id]
    if (!builder) return
    tools[id] = builder() as never
    picked.push(id)
  }
  for (const id of CORE_TOOL_IDS) take(id)
  const relevant = discoverRelevant(index, text, capabilities, 12)
  const academicComposite = relevant.some(
    e => localId(e) === 'academic_search'
  )
  for (const entry of relevant) {
    const id = localId(entry)
    if (!id || !entry.verified || entry.type === 'mcp') continue
    // The composite already runs the whole academic chain (§14).
    if (
      academicComposite &&
      ['arxiv', 'openalex', 'crossref', 'semanticscholar'].includes(id)
    ) {
      continue
    }
    take(id)
  }
  if (capabilities.includes('research')) take('delegate_research')
  // Dynamic catalog tools (§6): previously VERIFIED Atlas entries carrying a
  // stored execution plan execute via the generic REST executor — no wrapper
  // written by hand. Unverified entries are never loaded here.
  const byId = new Map(entries.map(e => [e.id, e]))
  for (const candidate of relevant) {
    if (picked.length >= maxTools) break
    const entry = byId.get(candidate.id)
    if (
      !entry ||
      entry.source === 'local' ||
      entry.type === 'mcp' ||
      entry.executableNow !== true ||
      !entry.executionPlan
    ) {
      continue
    }
    const key = `catalog_${entry.id.replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}`
    if (picked.includes(key)) continue
    const dynamic = createOpenApiTool(entry, {
      baseUrl: entry.executionPlan.baseUrl,
      operations: [entry.executionPlan.operation]
    }, entry.executionPlan.operation)
    if (dynamic) {
      tools[key] = dynamic as never
      picked.push(key)
    }
  }
  return { tools, pickedIds: picked, capabilities }
}
