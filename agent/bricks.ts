import { tool } from 'ai'
import { z } from 'zod'

/**
 * Bricks open-source de Nelth Agent : 8 outils 100% gratuits, sans clé API,
 * chacun avec sa carte UI dédiée (components/agent/tool-cards.tsx).
 * Tous READ-only et sûrs serverless : timeouts courts, sorties bornées,
 * échec = message propre (jamais d'exception qui casse le stream).
 */

import { safeFetchJson, safeFetchText } from './fetch'

// Fixed public hosts this file's tools may call (SSRF allowlist, §12).
// User input only ever fills query/path params — never the host.
const HOSTS = [
  'geocoding-api.open-meteo.com',
  'api.open-meteo.com',
  'wttr.in',
  'api.frankfurter.app',
  'api.coingecko.com',
  'api.dictionaryapi.dev',
  'fr.wikipedia.org',
  'en.wikipedia.org',
  'hn.algolia.com',
  'api.github.com',
  'export.arxiv.org'
]

async function fetchJson(url: string): Promise<unknown> {
  return safeFetchJson(url, { allowedHosts: HOSTS })
}

async function fetchText(url: string): Promise<string> {
  return safeFetchText(url, { allowedHosts: HOSTS })
}

// ---------------------------------------------------------------- météo ---

const WMO_FR: Record<number, { label: string; icon: string }> = {
  0: { label: 'Ciel dégagé', icon: '☀️' },
  1: { label: 'Plutôt dégagé', icon: '🌤️' },
  2: { label: 'Partiellement nuageux', icon: '⛅' },
  3: { label: 'Couvert', icon: '☁️' },
  45: { label: 'Brouillard', icon: '🌫️' },
  48: { label: 'Brouillard givrant', icon: '🌫️' },
  51: { label: 'Bruine légère', icon: '🌦️' },
  53: { label: 'Bruine', icon: '🌦️' },
  55: { label: 'Forte bruine', icon: '🌧️' },
  61: { label: 'Pluie faible', icon: '🌧️' },
  63: { label: 'Pluie', icon: '🌧️' },
  65: { label: 'Forte pluie', icon: '🌧️' },
  71: { label: 'Neige faible', icon: '🌨️' },
  73: { label: 'Neige', icon: '🌨️' },
  75: { label: 'Forte neige', icon: '❄️' },
  80: { label: 'Averses', icon: '🌦️' },
  81: { label: 'Averses', icon: '🌦️' },
  82: { label: 'Fortes averses', icon: '🌧️' },
  95: { label: 'Orage', icon: '⛈️' },
  96: { label: 'Orage avec grêle', icon: '⛈️' },
  99: { label: 'Orage avec grêle', icon: '⛈️' }
}

export type WeatherDay = {
  date: string
  tmin: number
  tmax: number
  icon: string
  label: string
}

export type WeatherData = {
  kind: 'weather'
  place: string
  temp: number
  feelsLike: number
  humidity: number
  wind: number
  icon: string
  label: string
  daily: WeatherDay[]
}

export const weatherTool = tool({
  description:
    'Météo actuelle + 5 jours pour une ville (Open-Meteo, gratuit). Ex: "Paris", "Antananarivo".',
  inputSchema: z.object({
    city: z.string().min(2).max(100).describe('Nom de la ville')
  }),
  execute: async ({ city }) => {
    try {
      const geo = (await fetchJson(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`
      )) as { results?: Array<{ name: string; country?: string; latitude: number; longitude: number }> }
      const loc = geo.results?.[0]
      if (!loc) return `Ville introuvable : ${city}.`
      const fc = (await fetchJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=6`
      )) as {
        current?: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; wind_speed_10m: number; weather_code: number }
        daily?: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] }
      }
      const cur = fc.current
      if (!cur) throw new Error('empty')
      const wmo = (code?: number) => WMO_FR[code ?? -1] ?? { label: '—', icon: '🌡️' }
      const daily: WeatherDay[] = (fc.daily?.time ?? []).slice(0, 6).map((date, i) => ({
        date,
        tmin: Math.round(fc.daily?.temperature_2m_min?.[i] ?? 0),
        tmax: Math.round(fc.daily?.temperature_2m_max?.[i] ?? 0),
        ...wmo(fc.daily?.weather_code?.[i])
      }))
      const data: WeatherData = {
        kind: 'weather',
        place: `${loc.name}${loc.country ? `, ${loc.country}` : ''}`,
        temp: Math.round(cur.temperature_2m),
        feelsLike: Math.round(cur.apparent_temperature),
        humidity: Math.round(cur.relative_humidity_2m),
        wind: Math.round(cur.wind_speed_10m),
        ...wmo(cur.weather_code),
        daily
      }
      return data
    } catch {
      // Fallback automatique (§14) : wttr.in accepte les noms de villes.
      try {
        const wttr = (await fetchJson(
          `https://wttr.in/${encodeURIComponent(city)}?format=j1`
        )) as {
          current_condition?: Array<{ temp_C?: string; FeelsLikeC?: string; humidity?: string; windspeedKmph?: string; weatherDesc?: Array<{ value?: string }> }>
          weather?: Array<{ date?: string; mintempC?: string; maxtempC?: string }>
        }
        const now = wttr.current_condition?.[0]
        if (!now?.temp_C) throw new Error('empty')
        const daily: WeatherDay[] = (wttr.weather ?? []).slice(0, 6).map(d => ({
          date: d.date ?? '',
          tmin: Number(d.mintempC ?? 0),
          tmax: Number(d.maxtempC ?? 0),
          icon: '🌡️',
          label: ''
        }))
        const data: WeatherData = {
          kind: 'weather',
          place: city,
          temp: Number(now.temp_C),
          feelsLike: Number(now.FeelsLikeC ?? now.temp_C),
          humidity: Number(now.humidity ?? 0),
          wind: Number(now.windspeedKmph ?? 0),
          icon: '🌡️',
          label: now.weatherDesc?.[0]?.value ?? '',
          daily
        }
        return data
      } catch {
        return 'Météo indisponible pour le moment.'
      }
    }
  }
})

// --------------------------------------------------------------- devises ---

export type CurrencyData = {
  kind: 'currency'
  from: string
  to: string
  amount: number
  rate: number
  result: number
  date: string
}

export const currencyTool = tool({
  description:
    'Convertit un montant entre devises (taux BCE via Frankfurter, gratuit). Codes ISO : EUR, USD, MGA, GBP…',
  inputSchema: z.object({
    amount: z.number().positive().max(1e12).describe('Montant à convertir'),
    from: z.string().length(3).describe('Devise source, ex. EUR'),
    to: z.string().length(3).describe('Devise cible, ex. USD')
  }),
  execute: async ({ amount, from, to }) => {
    try {
      const src = from.toUpperCase()
      const dst = to.toUpperCase()
      if (src === dst) {
        return { kind: 'currency', from: src, to: dst, amount, rate: 1, result: amount, date: '' } as CurrencyData
      }
      const res = (await fetchJson(
        `https://api.frankfurter.app/v1/latest?base=${src}&symbols=${dst}`
      )) as { rates?: Record<string, number>; date?: string }
      const rate = res.rates?.[dst]
      if (!rate) return `Devise non supportée : ${src} → ${dst}.`
      const data: CurrencyData = {
        kind: 'currency',
        from: src,
        to: dst,
        amount,
        rate,
        result: Math.round(amount * rate * 100) / 100,
        date: res.date ?? ''
      }
      return data
    } catch {
      return 'Conversion indisponible pour le moment.'
    }
  }
})

// ----------------------------------------------------------------- crypto ---

const COIN_IDS: Record<string, string> = {
  btc: 'bitcoin',
  bitcoin: 'bitcoin',
  eth: 'ethereum',
  ethereum: 'ethereum',
  sol: 'solana',
  solana: 'solana',
  doge: 'dogecoin',
  dogecoin: 'dogecoin',
  ada: 'cardano',
  cardano: 'cardano',
  xrp: 'ripple',
  ripple: 'ripple',
  bnb: 'binancecoin',
  link: 'chainlink'
}

export type CryptoData = {
  kind: 'crypto'
  prices: Array<{ symbol: string; usd: number; change24h: number | null }>
}

export const cryptoTool = tool({
  description:
    'Prix USD des cryptos (CoinGecko, gratuit) : bitcoin, ethereum, solana, dogecoin…',
  inputSchema: z.object({
    coins: z
      .array(z.string().min(2).max(20))
      .min(1)
      .max(5)
      .describe('Ex. ["bitcoin", "solana"]')
  }),
  execute: async ({ coins }) => {
    try {
      const ids = [
        ...new Set(
          coins.map(c => COIN_IDS[c.toLowerCase()] ?? c.toLowerCase())
        )
      ].join(',')
      const res = (await fetchJson(
        `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`
      )) as Record<string, { usd?: number; usd_24h_change?: number }>
      const prices = Object.entries(res)
        .filter(([, v]) => typeof v.usd === 'number')
        .map(([id, v]) => ({
          symbol: id,
          usd: v.usd as number,
          change24h:
            typeof v.usd_24h_change === 'number'
              ? Math.round(v.usd_24h_change * 100) / 100
              : null
        }))
      if (!prices.length) return 'Cryptos introuvables, vérifiez les noms.'
      return { kind: 'crypto', prices } as CryptoData
    } catch {
      return 'Cours crypto indisponibles pour le moment.'
    }
  }
})

// ------------------------------------------------------------------ dico ---

export type DictionaryData = {
  kind: 'dictionary'
  word: string
  phonetic: string
  meanings: Array<{ pos: string; definitions: string[]; example: string }>
}

export const dictionaryTool = tool({
  description:
    'Définitions anglaises d’un mot (Free Dictionary API, gratuit), avec exemples.',
  inputSchema: z.object({
    word: z.string().min(1).max(50).describe('Mot anglais, ex. "serendipity"')
  }),
  execute: async ({ word }) => {
    try {
      const clean = word.trim().toLowerCase().split(/\s+/)[0] ?? ''
      const res = (await fetchJson(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`
      )) as Array<{
        word?: string
        phonetic?: string
        phonetics?: Array<{ text?: string }>
        meanings?: Array<{
          partOfSpeech?: string
          definitions?: Array<{ definition?: string; example?: string }>
        }>
      }>
      const entry = res?.[0]
      const meanings = (entry?.meanings ?? []).slice(0, 3).map(m => ({
        pos: m.partOfSpeech ?? '',
        definitions: (m.definitions ?? [])
          .slice(0, 3)
          .map(d => String(d.definition ?? '')),
        example: String(m.definitions?.find(d => d.example)?.example ?? '')
      }))
      if (!meanings.length) return `Aucune définition pour « ${clean} ».`
      const data: DictionaryData = {
        kind: 'dictionary',
        word: entry?.word ?? clean,
        phonetic:
          entry?.phonetic ?? entry?.phonetics?.find(p => p.text)?.text ?? '',
        meanings
      }
      return data
    } catch {
      return 'Dictionnaire indisponible pour le moment.'
    }
  }
})

// -------------------------------------------------------------- wikipedia ---

export type WikipediaData = {
  kind: 'wikipedia'
  title: string
  summary: string
  url: string
}

export const wikipediaTool = tool({
  description:
    'Résumé encyclopédique Wikipédia (gratuit). Langue fr par défaut.',
  inputSchema: z.object({
    topic: z.string().min(2).max(150).describe('Sujet, ex. "Madagascar"'),
    lang: z.enum(['fr', 'en']).default('fr').describe('Langue')
  }),
  execute: async ({ topic, lang }) => {
    try {
      const res = (await fetchJson(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`
      )) as {
        title?: string
        extract?: string
        content_urls?: { desktop?: { page?: string } }
        type?: string
      }
      if (!res.extract || res.type === 'disambiguation') {
        return `Pas de résumé Wikipédia pour « ${topic} » (${lang}).`
      }
      const data: WikipediaData = {
        kind: 'wikipedia',
        title: res.title ?? topic,
        summary: res.extract.slice(0, 900),
        url: res.content_urls?.desktop?.page ?? ''
      }
      return data
    } catch {
      return 'Wikipédia indisponible pour le moment.'
    }
  }
})

// ------------------------------------------------------------ tech news ---

export type NewsData = {
  kind: 'news'
  hits: Array<{ title: string; url: string; points: number; author: string }>
}

export const newsTool = tool({
  description:
    'Actualités tech Hacker News (gratuit) : top stories ou recherche.',
  inputSchema: z.object({
    query: z
      .string()
      .max(150)
      .default('')
      .describe('Recherche (vide = top stories du moment)')
  }),
  execute: async ({ query }) => {
    try {
      const q = query.trim()
      const url = q
        ? `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=5`
        : 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=5'
      const res = (await fetchJson(url)) as {
        hits?: Array<{ title?: string; url?: string; points?: number; author?: string; objectID?: string }>
      }
      const hits = (res.hits ?? []).slice(0, 5).map(h => ({
        title: String(h.title ?? '(sans titre)'),
        url: String(
          h.url ?? `https://news.ycombinator.com/item?id=${h.objectID ?? ''}`
        ),
        points: Number(h.points ?? 0),
        author: String(h.author ?? '')
      }))
      if (!hits.length) return 'Aucune actualité trouvée.'
      return { kind: 'news', hits } as NewsData
    } catch {
      return 'Actualités indisponibles pour le moment.'
    }
  }
})

// ---------------------------------------------------------------- github ---

export type GithubData = {
  kind: 'github'
  repo: string
  description: string
  stars: number
  forks: number
  language: string
  url: string
}

export const githubTool = tool({
  description:
    'Infos publiques d’un dépôt GitHub (gratuit) : étoiles, forks, langage.',
  inputSchema: z.object({
    repo: z.string().min(3).max(100).describe('Ex. "vercel/ai"')
  }),
  execute: async ({ repo }) => {
    try {
      const clean = repo.trim().replace(/^github\.com\//i, '')
      if (!/^[\w.-]+\/[\w.-]+$/.test(clean)) {
        return 'Format attendu : owner/repo (ex. vercel/ai).'
      }
      const res = (await fetchJson(
        `https://api.github.com/repos/${clean}`
      )) as {
        full_name?: string
        description?: string | null
        stargazers_count?: number
        forks_count?: number
        language?: string | null
        html_url?: string
      }
      if (!res.full_name) return `Dépôt introuvable : ${clean}.`
      const data: GithubData = {
        kind: 'github',
        repo: res.full_name,
        description: res.description ?? '',
        stars: res.stargazers_count ?? 0,
        forks: res.forks_count ?? 0,
        language: res.language ?? '',
        url: res.html_url ?? `https://github.com/${clean}`
      }
      return data
    } catch {
      return 'GitHub indisponible pour le moment.'
    }
  }
})

// ------------------------------------------------------------------ arxiv ---

export type ArxivData = {
  kind: 'arxiv'
  papers: Array<{
    title: string
    authors: string
    published: string
    summary: string
    url: string
  }>
}

function arxivTag(entry: string, tag: string): string {
  const m = entry.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))
  return (m?.[1] ?? '').replace(/\s+/g, ' ').trim()
}

export const arxivTool = tool({
  description:
    'Articles scientifiques arXiv (gratuit) : recherche par mots-clés.',
  inputSchema: z.object({
    query: z.string().min(2).max(200).describe('Ex. "large language models agents"')
  }),
  execute: async ({ query }) => {
    try {
      const xml = await fetchText(
        `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=3&sortBy=submittedDate&sortOrder=descending`
      )
      const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []
      const papers = entries.slice(0, 3).map(entry => {
        const authors = [...entry.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)]
          .map(a => (a[1] ?? '').trim())
          .slice(0, 4)
          .join(', ')
        return {
          title: arxivTag(entry, 'title'),
          authors,
          published: arxivTag(entry, 'published').slice(0, 10),
          summary: arxivTag(entry, 'summary').slice(0, 500),
          url: arxivTag(entry, 'id')
        }
      })
      if (!papers.length) return 'Aucun article trouvé sur arXiv.'
      return { kind: 'arxiv', papers } as ArxivData
    } catch {
      return 'arXiv indisponible pour le moment.'
    }
  }
})
