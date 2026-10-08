import { tool } from 'ai'
import { z } from 'zod'

/**
 * Catalogues ouverts de Nelth Agent : chaque adaptateur ci-dessous couvre des
 * MILLIONS d'entrées (registres npm/PyPI, Open Library, MusicBrainz/iTunes,
 * REST Countries, Wikidata, USGS, arXiv-like…), tous gratuits et sans clé.
 * Couplés aux 8 bricks (agent/bricks.ts), l'agent couvre des milliers de
 * sujets via une poignée d'adaptateurs — c'est ça, passer à l'échelle.
 * Sorties structurées → cartes de components/agent/tool-cards.tsx.
 * Échec = message propre, jamais d'exception dans le stream.
 */

import { safeFetchJson, safeFetchText } from './fetch'

function arxivTag(entry: string, tag: string): string {
  const m = entry.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))
  return (m?.[1] ?? '').replace(/\s+/g, ' ').trim()
}

// Fixed public hosts this file's tools may call (SSRF allowlist, §12).
const HOSTS = [
  'registry.npmjs.org',
  'pypi.org',
  'openlibrary.org',
  'itunes.apple.com',
  'restcountries.com',
  'api.spacexdata.com',
  'earthquake.usgs.gov',
  'date.nager.at',
  'pokeapi.co',
  'www.wikidata.org',
  'export.arxiv.org',
  'api.openalex.org',
  'api.crossref.org',
  'api.semanticscholar.org'
]

async function fetchJson(url: string): Promise<unknown> {
  return safeFetchJson(url, { allowedHosts: HOSTS })
}

async function fetchText(url: string): Promise<string> {
  return safeFetchText(url, { allowedHosts: HOSTS })
}

// ------------------------------------------------- carte universelle ---

export type EntityItem = {
  title: string
  subtitle: string
  image?: string
  url?: string
}

export type EntityData = {
  kind: 'entity'
  title: string
  items: EntityItem[]
}

// ------------------------------------------------------------- paquets ---

export type PackageData = {
  kind: 'package'
  eco: string
  name: string
  version: string
  description: string
  extra: string
  url: string
}

export const npmTool = tool({
  description:
    'Infos d’un paquet npm (registre public, des millions de paquets) : version, description, licence.',
  inputSchema: z.object({
    pkg: z.string().min(1).max(100).describe('Ex. "react", "zod"')
  }),
  execute: async ({ pkg }) => {
    try {
      const name = pkg.trim().toLowerCase()
      if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)) {
        return 'Nom de paquet npm invalide.'
      }
      const res = (await fetchJson(
        `https://registry.npmjs.org/${encodeURIComponent(name).replace('%40', '@')}`
      )) as {
        name?: string
        description?: string
        'dist-tags'?: { latest?: string }
        versions?: Record<string, { license?: string; author?: { name?: string } | string; homepage?: string }>
      }
      const latest = res['dist-tags']?.latest
      const meta = (latest && res.versions?.[latest]) || {}
      if (!res.name || !latest) return `Paquet npm introuvable : ${name}.`
      const author =
        typeof meta.author === 'string'
          ? meta.author
          : (meta.author?.name ?? '')
      const data: PackageData = {
        kind: 'package',
        eco: 'npm',
        name: res.name,
        version: latest,
        description: res.description ?? '',
        extra: [meta.license, author].filter(Boolean).join(' · '),
        url: `https://www.npmjs.com/package/${res.name}`
      }
      return data
    } catch {
      return 'Registre npm indisponible pour le moment.'
    }
  }
})

export const pypiTool = tool({
  description:
    'Infos d’un paquet Python PyPI (registre public) : version, résumé, auteur.',
  inputSchema: z.object({
    pkg: z.string().min(1).max(100).describe('Ex. "requests", "pandas"')
  }),
  execute: async ({ pkg }) => {
    try {
      const name = pkg.trim().toLowerCase()
      if (!/^[a-z0-9_.-]+$/.test(name)) return 'Nom de paquet PyPI invalide.'
      const res = (await fetchJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`)) as {
        info?: { name?: string; version?: string; summary?: string; author?: string; license?: string; home_page?: string }
      }
      const info = res.info
      if (!info?.name) return `Paquet PyPI introuvable : ${name}.`
      const data: PackageData = {
        kind: 'package',
        eco: 'PyPI',
        name: info.name,
        version: info.version ?? '',
        description: info.summary ?? '',
        extra: [info.license, info.author].filter(Boolean).join(' · '),
        url: `https://pypi.org/project/${info.name}/`
      }
      return data
    } catch {
      return 'PyPI indisponible pour le moment.'
    }
  }
})

// --------------------------------------------------------------- livres ---

export type BookData = {
  kind: 'book'
  title: string
  author: string
  year: string
  cover: string
  url: string
}

export const bookTool = tool({
  description:
    'Cherche un livre (Open Library, des millions de titres) : auteur, année, couverture.',
  inputSchema: z.object({
    query: z.string().min(2).max(150).describe('Titre et/ou auteur, ex. "Dune Herbert"')
  }),
  execute: async ({ query }) => {
    try {
      const res = (await fetchJson(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=1&fields=key,title,author_name,first_publish_year,cover_i`
      )) as {
        docs?: Array<{ key?: string; title?: string; author_name?: string[]; first_publish_year?: number; cover_i?: number }>
      }
      const doc = res.docs?.[0]
      if (!doc?.title) return `Aucun livre trouvé pour « ${query} ».`
      const data: BookData = {
        kind: 'book',
        title: doc.title,
        author: (doc.author_name ?? []).slice(0, 3).join(', '),
        year: String(doc.first_publish_year ?? ''),
        cover: doc.cover_i
          ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
          : '',
        url: doc.key ? `https://openlibrary.org${doc.key}` : ''
      }
      return data
    } catch {
      return 'Open Library indisponible pour le moment.'
    }
  }
})

// --------------------------------------------------------------- musique ---

export type MediaData = {
  kind: 'media'
  title: string
  subtitle: string
  image: string
  extra: string
  url: string
}

export const musicTool = tool({
  description:
    'Cherche un morceau (iTunes, des millions de titres) : artiste, genre, pochette.',
  inputSchema: z.object({
    query: z.string().min(2).max(150).describe('Titre et/ou artiste')
  }),
  execute: async ({ query }) => {
    try {
      const res = (await fetchJson(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=3`
      )) as {
        results?: Array<{ trackName?: string; artistName?: string; artworkUrl100?: string; primaryGenreName?: string; trackViewUrl?: string }>
      }
      const hits = (res.results ?? []).slice(0, 3)
      if (!hits.length) return `Aucun morceau trouvé pour « ${query} ».`
      const top = hits[0] as NonNullable<(typeof hits)[number]>
      const data: MediaData = {
        kind: 'media',
        title: top.trackName ?? query,
        subtitle: top.artistName ?? '',
        image: (top.artworkUrl100 ?? '').replace('100x100', '300x300'),
        extra: top.primaryGenreName ?? '',
        url: top.trackViewUrl ?? ''
      }
      return data
    } catch {
      return 'Recherche musicale indisponible pour le moment.'
    }
  }
})

// ----------------------------------------------------------------- pays ---

export type CountryData = {
  kind: 'country'
  name: string
  flag: string
  capital: string
  region: string
  population: number
  languages: string
  currencies: string
  url: string
}

export const countryTool = tool({
  description:
    'Fiche pays (REST Countries, 250 pays) : capitale, population, langues, monnaies, drapeau.',
  inputSchema: z.object({
    name: z.string().min(2).max(100).describe('Ex. "Madagascar", "France", "Japon"')
  }),
  execute: async ({ name }) => {
    try {
      const res = (await fetchJson(
        `https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fields=name,capital,region,population,languages,currencies,flags,maps`
      )) as Array<{
        name?: { common?: string }
        capital?: string[]
        region?: string
        population?: number
        languages?: Record<string, string>
        currencies?: Record<string, { name?: string }>
        flags?: { png?: string }
        maps?: { googleMaps?: string }
      }>
      const c = res?.[0]
      if (!c?.name?.common) return `Pays introuvable : ${name}.`
      const data: CountryData = {
        kind: 'country',
        name: c.name.common,
        flag: c.flags?.png ?? '',
        capital: c.capital?.[0] ?? '',
        region: c.region ?? '',
        population: c.population ?? 0,
        languages: Object.values(c.languages ?? {}).slice(0, 5).join(', '),
        currencies: Object.entries(c.currencies ?? {})
          .slice(0, 3)
          .map(([code, cur]) => `${code}${cur.name ? ` (${cur.name})` : ''}`)
          .join(', '),
        url: c.maps?.googleMaps ?? ''
      }
      return data
    } catch {
      return 'Fiche pays indisponible pour le moment.'
    }
  }
})

// ----------------------------------------------------------- entités -------

function toEntity(
  title: string,
  items: EntityItem[]
): EntityData | string {
  if (!items.length) return `${title} : aucun résultat.`
  return { kind: 'entity', title, items: items.slice(0, 5) }
}

export const spacexTool = tool({
  description: 'Dernier lancement SpaceX (API publique) : mission, date, succès.',
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const l = (await fetchJson('https://api.spacexdata.com/v5/launches/latest')) as {
        name?: string
        date_utc?: string
        success?: boolean | null
        details?: string | null
        links?: { patch?: { small?: string }; webcast?: string; wikipedia?: string }
      }
      const date = (l.date_utc ?? '').slice(0, 10)
      return toEntity('🚀 SpaceX — dernier lancement', [
        {
          title: l.name ?? 'Lancement',
          subtitle: `${date} · ${l.success === true ? '✅ succès' : l.success === false ? '❌ échec' : 'à venir'}${l.details ? ` — ${l.details.slice(0, 160)}` : ''}`,
          image: l.links?.patch?.small ?? '',
          url: l.links?.webcast || l.links?.wikipedia || ''
        }
      ])
    } catch {
      return 'SpaceX indisponible pour le moment.'
    }
  }
})

export const quakeTool = tool({
  description: 'Séismes marquants du mois (USGS, gratuit) : magnitude, lieu, date.',
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const res = (await fetchJson(
        'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson'
      )) as {
        features?: Array<{ properties?: { mag?: number; place?: string; time?: number; url?: string } }>
      }
      const items = (res.features ?? []).slice(0, 5).map(f => {
        const p = f.properties ?? {}
        return {
          title: `M${p.mag ?? '?'} — ${p.place ?? 'lieu inconnu'}`,
          subtitle: p.time ? new Date(p.time).toLocaleDateString('fr-FR') : '',
          url: p.url ?? ''
        } as EntityItem
      })
      return toEntity('🌍 Séismes marquants du mois', items)
    } catch {
      return 'Données sismiques indisponibles pour le moment.'
    }
  }
})

export const holidaysTool = tool({
  description: 'Jours fériés de l’année par pays (Nager.Date, gratuit). Code ISO : MG, FR, US…',
  inputSchema: z.object({
    country: z.string().length(2).default('MG').describe('Code pays ISO, ex. MG')
  }),
  execute: async ({ country }) => {
    try {
      const code = country.toUpperCase()
      const year = new Date().getFullYear()
      const res = (await fetchJson(
        `https://date.nager.at/api/v3/publicholidays/${year}/${code}`
      )) as Array<{ date?: string; localName?: string; name?: string }>
      const now = new Date().toISOString().slice(0, 10)
      const items = res
        .filter(h => (h.date ?? '') >= now)
        .slice(0, 6)
        .map(h => ({
          title: h.localName || h.name || '',
          subtitle: h.date ?? '',
          url: ''
        }) as EntityItem)
      return toEntity(`🎉 Fériés ${code} ${year} à venir`, items.length ? items : res.slice(0, 3).map(h => ({
        title: h.localName || h.name || '',
        subtitle: h.date ?? '',
        url: ''
      }) as EntityItem))
    } catch {
      return 'Jours fériés indisponibles pour le moment.'
    }
  }
})

export const pokemonTool = tool({
  description: 'Fiche Pokémon (PokéAPI, 1000+ créatures) : types, taille, sprite.',
  inputSchema: z.object({
    name: z.string().min(1).max(50).describe('Ex. "pikachu", "bulbasaur"')
  }),
  execute: async ({ name }) => {
    try {
      const clean = name.trim().toLowerCase()
      if (!/^[a-z0-9-]+$/.test(clean)) return 'Nom de Pokémon invalide.'
      const p = (await fetchJson(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(clean)}`)) as {
        name?: string
        id?: number
        height?: number
        weight?: number
        sprites?: { front_default?: string | null }
        types?: Array<{ type?: { name?: string } }>
      }
      if (!p.name) return `Pokémon introuvable : ${name}.`
      return toEntity(`⚡ #${p.id ?? '?'} ${p.name}`, [
        {
          title: (p.types ?? []).map(t => t.type?.name ?? '').filter(Boolean).join(' · ') || 'type inconnu',
          subtitle: `Taille ${(Number(p.height ?? 0) / 10).toFixed(1)} m · Poids ${(Number(p.weight ?? 0) / 10).toFixed(1)} kg`,
          image: p.sprites?.front_default ?? '',
          url: `https://www.pokemon.com/us/pokedex/${p.name}`
        }
      ])
    } catch {
      return 'PokéAPI indisponible pour le moment.'
    }
  }
})

export type OpenAlexItem = { title: string; authors: string; year: string; url: string }

async function fetchOpenAlex(query: string): Promise<OpenAlexItem[]> {
  const res = (await fetchJson(
    `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=3&mailto=nelth-agent@example.com`
  )) as {
    results?: Array<{
      title?: string
      publication_year?: number
      doi?: string
      primary_location?: { landing_page_url?: string }
      authorships?: Array<{ author?: { display_name?: string } }>
    }>
  }
  return (res.results ?? []).slice(0, 3).map(w => ({
    title: w.title ?? '',
    authors: (w.authorships ?? []).slice(0, 4).map(a => a.author?.display_name ?? '').filter(Boolean).join(', '),
    year: String(w.publication_year ?? ''),
    url: w.doi ? `https://doi.org/${w.doi.replace(/^https?:\/\/doi.org\//, '')}` : (w.primary_location?.landing_page_url ?? '')
  })).filter(p => p.title)
}

async function fetchCrossref(query: string): Promise<OpenAlexItem[]> {
  const res = (await fetchJson(
    `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=3&mailto=nelth-agent@example.com&select=title,author,published,DOI,URL`
  )) as {
    message?: {
      items?: Array<{ title?: string[]; author?: Array<{ given?: string; family?: string }>; published?: { 'date-parts'?: number[][] }; DOI?: string; URL?: string }>
    }
  }
  return (res.message?.items ?? []).slice(0, 3).map(w => ({
    title: w.title?.[0] ?? '',
    authors: (w.author ?? []).slice(0, 4).map(a => `${a.given ?? ''} ${a.family ?? ''}`.trim()).filter(Boolean).join(', '),
    year: String(w.published?.['date-parts']?.[0]?.[0] ?? ''),
    url: w.DOI ? `https://doi.org/${w.DOI}` : (w.URL ?? '')
  })).filter(p => p.title)
}

async function fetchSemanticScholar(query: string): Promise<OpenAlexItem[]> {
  const res = (await fetchJson(
    `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=3&fields=title,authors,year,abstract,url,openAccessPdf`
  )) as {
    data?: Array<{ title?: string; authors?: Array<{ name?: string }>; year?: number; abstract?: string | null; url?: string; openAccessPdf?: { url?: string } | null }>
  }
  return (res.data ?? []).slice(0, 3).map(p => ({
    title: p.title ?? '',
    authors: (p.authors ?? []).slice(0, 4).map(a => a.name ?? '').filter(Boolean).join(', '),
    year: String(p.year ?? ''),
    url: p.openAccessPdf?.url || p.url || ''
  })).filter(p => p.title)
}

function papersToEntity(title: string, papers: OpenAlexItem[]): EntityData | null {
  if (!papers.length) return null
  return {
    kind: 'entity',
    title,
    items: papers.map(p => ({
      title: p.title,
      subtitle: [p.authors, p.year].filter(Boolean).join(' · '),
      url: p.url
    }))
  }
}

export const openalexTool = tool({
  description: 'Scholarly works across publishers (OpenAlex, free).',
  inputSchema: z.object({
    query: z.string().min(2).max(200).describe('Keywords, ex. "transformer models"')
  }),
  execute: async ({ query }) => {
    try {
      const entity = papersToEntity(`🎓 OpenAlex : ${query}`, await fetchOpenAlex(query))
      return entity ?? `Rien trouvé sur OpenAlex pour « ${query} ».`
    } catch {
      return 'OpenAlex indisponible pour le moment.'
    }
  }
})

export const crossrefTool = tool({
  description: 'DOI metadata for scholarly works (Crossref, free).',
  inputSchema: z.object({
    query: z.string().min(2).max(200).describe('Keywords or title')
  }),
  execute: async ({ query }) => {
    try {
      const entity = papersToEntity(`🎓 Crossref : ${query}`, await fetchCrossref(query))
      return entity ?? `Rien trouvé sur Crossref pour « ${query} ».`
    } catch {
      return 'Crossref indisponible pour le moment.'
    }
  }
})

export const semanticscholarTool = tool({
  description: 'Paper search with abstracts (Semantic Scholar, free).',
  inputSchema: z.object({
    query: z.string().min(2).max(200).describe('Keywords')
  }),
  execute: async ({ query }) => {
    try {
      const entity = papersToEntity(`🎓 Semantic Scholar : ${query}`, await fetchSemanticScholar(query))
      return entity ?? `Rien trouvé sur Semantic Scholar pour « ${query} ».`
    } catch {
      return 'Semantic Scholar indisponible pour le moment.'
    }
  }
})

/**
 * Composite with AUTOMATIC fallback (§14): arXiv → OpenAlex → Crossref →
 * Semantic Scholar, first success wins. One tool in the prompt instead of 4.
 */
export const academicTool = tool({
  description:
    'Academic papers with automatic fallback (arXiv → OpenAlex → Crossref → Semantic Scholar). Prefer it for scientific literature.',
  inputSchema: z.object({
    query: z.string().min(2).max(200).describe('Keywords, ex. "large language models agents"')
  }),
  execute: async ({ query }) => {
    const attempts: Array<{ source: string; run: () => Promise<EntityData | null> }> = [
      {
        source: 'arXiv',
        run: async () => {
          const xml = await fetchText(
            `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=3&sortBy=submittedDate&sortOrder=descending`
          )
          const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []
          const papers = entries.slice(0, 3).map(entry => {
            const authors = [...entry.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)]
              .map(a => (a[1] ?? '').trim()).slice(0, 4).join(', ')
            return {
              title: arxivTag(entry, 'title'),
              authors,
              year: arxivTag(entry, 'published').slice(0, 4),
              url: arxivTag(entry, 'id')
            }
          }).filter(p => p.title)
          return papersToEntity(`🎓 arXiv : ${query}`, papers.map(p => ({ ...p, year: p.year })))
        }
      },
      { source: 'OpenAlex', run: async () => papersToEntity(`🎓 OpenAlex : ${query}`, await fetchOpenAlex(query)) },
      { source: 'Crossref', run: async () => papersToEntity(`🎓 Crossref : ${query}`, await fetchCrossref(query)) },
      { source: 'Semantic Scholar', run: async () => papersToEntity(`🎓 Semantic Scholar : ${query}`, await fetchSemanticScholar(query)) }
    ]
    for (const attempt of attempts) {
      try {
        const entity = await attempt.run()
        if (entity) return entity
      } catch {
        // next source in the chain
      }
    }
    return `Aucun article trouvé pour « ${query} » (arXiv, OpenAlex, Crossref, Semantic Scholar essayés).`
  }
})

export const wikidataTool = tool({
  description:
    'Entités Wikidata (des millions : personnes, lieux, œuvres) : description + lien.',
  inputSchema: z.object({
    query: z.string().min(2).max(150).describe('Ex. "Marie Curie", "Tour Eiffel"')
  }),
  execute: async ({ query }) => {
    try {
      const res = (await fetchJson(
        `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=fr&format=json&limit=4&origin=*`
      )) as {
        search?: Array<{ id?: string; label?: string; description?: string }>
      }
      const items = (res.search ?? []).slice(0, 4).map(s => ({
        title: s.label ?? '',
        subtitle: s.description ?? '',
        url: s.id ? `https://www.wikidata.org/wiki/${s.id}` : ''
      }) as EntityItem)
      return toEntity(`🧠 Wikidata : ${query}`, items)
    } catch {
      return 'Wikidata indisponible pour le moment.'
    }
  }
})
