import type { ToolCatalogEntry } from './types'

/**
 * Bundled seed: every tool actually implemented in this project, marked
 * verified:true + executable. Used as the discovery base when Firestore has
 * no synced data yet, and always merged as the executable layer.
 * Existing tools are preserved here as registry entries (§15) — nothing
 * was removed, only indexed.
 */

const V = {
  source: 'local',
  verified: true,
  https: true,
  vercelCompatible: true,
  reliability: 1,
  auth: 'none' as const,
  free: true,
  executableNow: true,
  requiresCredential: false,
  credentialConfigured: false,
  verificationStatus: 'verified' as const,
  lastVerifiedAt: new Date().toISOString()
}

function local(
  id: string,
  name: string,
  description: string,
  category: string,
  capabilities: string[],
  keywords: string[],
  documentationUrl?: string
): ToolCatalogEntry {
  return {
    id: `local:${id}`,
    name,
    description,
    category,
    ...V,
    type: 'rest',
    documentationUrl,
    capabilities: capabilities.map(c => c.toLowerCase()),
    keywords: keywords.map(k => k.toLowerCase()),
    lastChecked: new Date().toISOString()
  }
}

export const SEED_TOOLS: ToolCatalogEntry[] = [
  local('web_search', 'Web Search', 'Live web facts, news, prices, docs with cited sources.', 'Search',
    ['search', 'web', 'news', 'facts', 'research'], ['recherche', 'web', 'news', 'actualités', 'facts', 'google', 'search']),
  local('weather', 'Weather', 'Current weather + 5-day forecast for any city (Open-Meteo).', 'Weather',
    ['weather', 'forecast', 'geocoding'], ['météo', 'temps', 'pluie', 'temperature', 'forecast', 'weather', 'antananarivo', 'paris']),
  local('currency', 'Currency Converter', 'Fiat conversion with ECB rates (Frankfurter).', 'Finance',
    ['currency', 'forex', 'conversion', 'money'], ['devise', 'euro', 'dollar', 'ariary', 'mga', 'taux', 'conversion', 'currency', 'exchange']),
  local('crypto', 'Crypto Prices', 'USD prices + 24h change (CoinGecko).', 'Finance',
    ['crypto', 'bitcoin', 'prices'], ['crypto', 'bitcoin', 'ethereum', 'solana', 'prix', 'cours']),
  local('dictionary', 'Dictionary', 'English definitions with examples (Free Dictionary API).', 'Reference',
    ['dictionary', 'definitions', 'words'], ['dictionnaire', 'définition', 'mot', 'dictionary', 'english', 'word']),
  local('wikipedia', 'Wikipedia', 'Encyclopedia summaries FR/EN.', 'Reference',
    ['wikipedia', 'encyclopedia', 'summary'], ['wikipédia', 'encyclopédie', 'résumé', 'wikipedia']),
  local('tech_news', 'Tech News', 'Hacker News top stories + search.', 'News',
    ['news', 'tech', 'hackernews', 'stories'], ['news', 'actualités', 'tech', 'hacker', 'stories']),
  local('github', 'GitHub Repo', 'Public repo stats: stars, forks, language.', 'Development',
    ['github', 'repository', 'stars', 'code'], ['github', 'dépôt', 'repository', 'stars', 'repo', 'étoiles']),
  local('arxiv', 'arXiv Papers', 'Scientific papers search (arXiv).', 'Academic',
    ['papers', 'arxiv', 'science', 'research', 'academic'], ['articles', 'scientifiques', 'recherche', 'papers', 'science', 'llm', 'arxiv']),
  local('openalex', 'OpenAlex Works', 'Scholarly works across publishers (OpenAlex). Academic fallback chain.', 'Academic',
    ['papers', 'academic', 'openalex', 'research', 'science'], ['articles', 'académiques', 'openalex', 'publication']),
  local('crossref', 'Crossref Works', 'DOI metadata for scholarly works (Crossref). Academic fallback chain.', 'Academic',
    ['papers', 'academic', 'crossref', 'doi', 'research'], ['doi', 'crossref', 'publication', 'métadonnées']),
  local('semanticscholar', 'Semantic Scholar', 'Paper search with TLDR abstracts. Academic fallback chain.', 'Academic',
    ['papers', 'academic', 'semantic-scholar', 'research'], ['semantic', 'scholar', 'résumé', 'abstract']),
  local('academic_search', 'Academic Search', 'Composite: arXiv → OpenAlex → Crossref → Semantic Scholar, first success wins.', 'Academic',
    ['papers', 'academic', 'research', 'science'], ['articles', 'scientifiques', 'recherche', 'papers', 'universitaire']),
  local('npm', 'npm Package', 'npm registry info: version, license, author (millions of packages).', 'Development',
    ['npm', 'package', 'javascript', 'registry'], ['npm', 'paquet', 'package', 'javascript', 'version', 'librairie']),
  local('pypi', 'PyPI Package', 'Python package info (PyPI registry).', 'Development',
    ['pypi', 'package', 'python', 'registry'], ['pypi', 'python', 'paquet', 'package', 'pip']),
  local('book', 'Book Finder', 'Open Library search: author, year, cover (millions of titles).', 'Books',
    ['books', 'openlibrary', 'cover', 'author'], ['livre', 'livres', 'auteur', 'couverture', 'book', 'roman']),
  local('music', 'Music Search', 'Songs via iTunes: artist, genre, artwork.', 'Music',
    ['music', 'songs', 'artist', 'itunes'], ['musique', 'chanson', 'artiste', 'morceau', 'music', 'song']),
  local('country', 'Country Profile', '250 countries: capital, population, languages, flag (REST Countries).', 'Geography',
    ['country', 'geography', 'capital', 'population', 'flag', 'maps'], ['pays', 'capitale', 'population', 'drapeau', 'country', 'madagascar', 'france', 'carte', 'maps']),
  local('spacex', 'SpaceX Launch', 'Latest SpaceX launch: mission, date, outcome.', 'Space',
    ['spacex', 'space', 'launch', 'rockets'], ['spacex', 'espace', 'lancement', 'fusée', 'space', 'rocket']),
  local('quake', 'Earthquakes', 'Significant earthquakes of the month (USGS).', 'Geography',
    ['earthquake', 'seismic', 'usgs'], ['séisme', 'tremblement', 'terre', 'earthquake', 'seisme']),
  local('holidays', 'Public Holidays', 'Public holidays by ISO country (Nager.Date).', 'Reference',
    ['holidays', 'calendar', 'days-off'], ['fériés', 'feries', 'vacances', 'jours', 'holidays', 'fête']),
  local('pokemon', 'Pokémon', 'PokéAPI creatures: types, size, sprite (1000+).', 'Games',
    ['pokemon', 'pokedex', 'games'], ['pokémon', 'pokemon', 'pikachu', 'pokedex']),
  local('wikidata', 'Wikidata Entities', 'Millions of entities: people, places, works.', 'Reference',
    ['wikidata', 'entities', 'knowledge', 'people', 'places'], ['wikidata', 'entité', 'personne', 'lieu', 'qui est']),
  local('calculator', 'Calculator', 'Exact math evaluation.', 'Utilities',
    ['calculator', 'math', 'arithmetic'], ['calcul', 'calculatrice', 'math', 'combien', 'addition', 'diviser']),
  local('datetime', 'Date & Time', 'Current UTC + local date/time.', 'Utilities',
    ['datetime', 'date', 'time', 'clock'], ['date', 'heure', 'jour', 'aujourd’hui', 'time', 'clock', 'quelle heure']),
  local('delegate_research', 'Research Subagent', 'Bounded specialist: multi-angle research + synthesis.', 'Agents',
    ['delegation', 'research', 'subagent'], ['recherche', 'approfondie', 'déléguer', 'subagent', 'deep', 'dossier'])
]

/**
 * Curated MCP registry entries (discovery only — MCP servers need a host
 * process, so executable:false on Vercel; kept for the dashboard + roadmap).
 * Sources: modelcontextprotocol/servers, mcp.so, Smithery, PulseMCP.
 */
export const SEED_MCP: ToolCatalogEntry[] = (
  [
    ['mcp-filesystem', 'Filesystem MCP', 'Secure file operations with directory allowlists.', ['files', 'read', 'write', 'filesystem'], 'stdio'],
    ['mcp-github', 'GitHub MCP', 'Repos, issues, PRs, code search via GitHub API.', ['github', 'repository', 'issues', 'pull-request', 'code'], 'http'],
    ['mcp-brave-search', 'Brave Search MCP', 'Web + local search grounded results.', ['search', 'web', 'news'], 'http'],
    ['mcp-postgres', 'Postgres MCP', 'Read-only SQL inspection over a database.', ['postgres', 'sql', 'database'], 'stdio'],
    ['mcp-sqlite', 'SQLite MCP', 'Local SQLite querying.', ['sqlite', 'sql', 'database'], 'stdio'],
    ['mcp-fetch', 'Fetch MCP', 'URL fetching distilled for models.', ['fetch', 'web', 'url', 'scrape'], 'stdio'],
    ['mcp-puppeteer', 'Puppeteer MCP', 'Headless browser automation.', ['browser', 'automation', 'puppeteer', 'click', 'navigate'], 'stdio'],
    ['mcp-memory', 'Memory MCP', 'Knowledge-graph persistent memory.', ['memory', 'knowledge', 'graph'], 'stdio'],
    ['mcp-sequential-thinking', 'Sequential Thinking MCP', 'Structured step-by-step reasoning.', ['reasoning', 'planning', 'thinking'], 'stdio'],
    ['mcp-slack', 'Slack MCP', 'Channels, threads, users, messages.', ['slack', 'messages', 'team'], 'http']
  ] as Array<[string, string, string, string[], string]>
).map(([id, name, description, capabilities, transport]) => ({
  id: `local:${id}`,
  name,
  description: `${description} (Discovery only — needs a host process.)`,
  category: 'MCP',
  source: 'local',
  type: 'mcp' as const,
  repository: `https://github.com/modelcontextprotocol/servers`,
  transport,
  auth: 'unknown' as const,
  free: true,
  verified: false,
  https: true,
  vercelCompatible: false,
  capabilities,
  keywords: [],
  executableNow: false,
  requiresExternalHost: true,
  verificationStatus: 'unverified' as const,
  lastChecked: new Date().toISOString()
}))

export const SEED_ALL: ToolCatalogEntry[] = [...SEED_TOOLS, ...SEED_MCP]
