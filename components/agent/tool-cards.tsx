'use client'

import type {
  ArxivData,
  CryptoData,
  CurrencyData,
  DictionaryData,
  GithubData,
  NewsData,
  WeatherData,
  WikipediaData
} from '@/agent/bricks'
import type {
  BookData,
  CountryData,
  EntityData,
  MediaData,
  PackageData
} from '@/agent/adapters'

function CardShell({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="w-full rounded-xl border border-border bg-card px-3.5 py-3 text-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

function fmtNum(n: number): string {
  return n.toLocaleString('fr-FR')
}

export function WeatherCard({ data }: { data: WeatherData }) {
  const today = data.daily[0]
  return (
    <CardShell title={`☁️ ${data.place}`}>
      <div className="flex items-center gap-3">
        <span className="text-3xl">{data.icon}</span>
        <div>
          <p className="text-2xl font-semibold">{data.temp}°C</p>
          <p className="text-xs text-muted-foreground">
            {data.label} · ressenti {data.feelsLike}°C · 💧 {data.humidity}% · 💨{' '}
            {data.wind} km/h
          </p>
        </div>
      </div>
      <div className="mt-1 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {data.daily.slice(1, 6).map(d => (
          <div
            key={d.date}
            className="flex flex-col items-center rounded-lg bg-muted/50 px-1 py-1.5 text-center"
          >
            <span className="text-[11px] text-muted-foreground">
              {d.date.slice(5).replace('-', '/')}
            </span>
            <span className="text-lg leading-6">{d.icon}</span>
            <span className="text-[11px] font-medium">
              {d.tmin}° / {d.tmax}°
            </span>
          </div>
        ))}
      </div>
      {today ? (
        <p className="sr-only">
          Aujourd’hui : {today.label}, {today.tmin} à {today.tmax} degrés.
        </p>
      ) : null}
    </CardShell>
  )
}

export function CurrencyCard({ data }: { data: CurrencyData }) {
  return (
    <CardShell title="💱 Conversion">
      <p className="text-lg font-semibold">
        {fmtNum(data.amount)} {data.from} = {fmtNum(data.result)} {data.to}
      </p>
      <p className="text-xs text-muted-foreground">
        Taux 1 {data.from} = {data.rate} {data.to}
        {data.date ? ` · ${data.date}` : ''} (BCE)
      </p>
    </CardShell>
  )
}

export function CryptoCard({ data }: { data: CryptoData }) {
  return (
    <CardShell title="🪙 Crypto">
      {data.prices.map(p => (
        <div
          key={p.symbol}
          className="flex items-center justify-between gap-2 border-b border-border/60 py-1 last:border-0"
        >
          <span className="font-medium capitalize">{p.symbol}</span>
          <span className="flex items-center gap-2">
            <span className="font-semibold">
              $
              {p.usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </span>
            {p.change24h !== null ? (
              <span
                className={
                  p.change24h >= 0 ? 'text-emerald-600' : 'text-destructive'
                }
              >
                {p.change24h >= 0 ? '▲' : '▼'} {Math.abs(p.change24h)}%
              </span>
            ) : null}
          </span>
        </div>
      ))}
    </CardShell>
  )
}

export function DictionaryCard({ data }: { data: DictionaryData }) {
  return (
    <CardShell title={`📖 ${data.word}`}>
      {data.phonetic ? (
        <p className="text-xs text-muted-foreground">{data.phonetic}</p>
      ) : null}
      {data.meanings.map((m, i) => (
        <div key={i}>
          <p className="text-xs font-semibold italic text-muted-foreground">
            {m.pos}
          </p>
          {m.definitions.map((d, j) => (
            <p key={j}>
              {j + 1}. {d}
            </p>
          ))}
          {m.example ? (
            <p className="text-xs italic text-muted-foreground">« {m.example} »</p>
          ) : null}
        </div>
      ))}
    </CardShell>
  )
}

export function WikipediaCard({ data }: { data: WikipediaData }) {
  return (
    <CardShell title={`📚 ${data.title}`}>
      <p className="leading-6">{data.summary}</p>
      {data.url ? (
        <a
          href={data.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary underline underline-offset-2"
        >
          Lire sur Wikipédia ↗
        </a>
      ) : null}
    </CardShell>
  )
}

export function NewsCard({ data }: { data: NewsData }) {
  return (
    <CardShell title="🔥 Hacker News">
      {data.hits.map((h, i) => (
        <a
          key={i}
          href={h.url}
          target="_blank"
          rel="noreferrer"
          className="block rounded-lg px-1 py-1 transition-colors hover:bg-accent"
        >
          <span className="font-medium">{h.title}</span>{' '}
          <span className="text-xs text-muted-foreground">
            ▲{h.points}
            {h.author ? ` · ${h.author}` : ''}
          </span>
        </a>
      ))}
    </CardShell>
  )
}

export function GithubCard({ data }: { data: GithubData }) {
  return (
    <CardShell title={`⭐ ${data.repo}`}>
      {data.description ? <p>{data.description}</p> : null}
      <p className="text-xs text-muted-foreground">
        ★ {fmtNum(data.stars)} · 🍴 {fmtNum(data.forks)}
        {data.language ? ` · ${data.language}` : ''}
      </p>
      <a
        href={data.url}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-primary underline underline-offset-2"
      >
        Voir sur GitHub ↗
      </a>
    </CardShell>
  )
}

export function PackageCard({ data }: { data: PackageData }) {
  return (
    <CardShell title={`📦 ${data.eco} · ${data.name}`}>
      <p>
        <span className="font-semibold">v{data.version}</span>
        {data.extra ? (
          <span className="text-muted-foreground"> · {data.extra}</span>
        ) : null}
      </p>
      {data.description ? <p>{data.description}</p> : null}
      <a
        href={data.url}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-primary underline underline-offset-2"
      >
        Voir le paquet ↗
      </a>
    </CardShell>
  )
}

export function BookCard({ data }: { data: BookData }) {
  return (
    <CardShell title={`📚 ${data.title}`}>
      <div className="flex gap-3">
        {data.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.cover}
            alt={`Couverture de ${data.title}`}
            className="h-28 w-auto shrink-0 rounded-md border border-border"
            loading="lazy"
          />
        ) : null}
        <div className="flex min-w-0 flex-col gap-1">
          {data.author ? <p className="font-medium">{data.author}</p> : null}
          {data.year ? (
            <p className="text-xs text-muted-foreground">{data.year}</p>
          ) : null}
          {data.url ? (
            <a
              href={data.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary underline underline-offset-2"
            >
              Fiche Open Library ↗
            </a>
          ) : null}
        </div>
      </div>
    </CardShell>
  )
}

export function CountryCard({ data }: { data: CountryData }) {
  return (
    <CardShell title={`${data.name}`}>
      <div className="flex items-center gap-3">
        {data.flag ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.flag}
            alt={`Drapeau ${data.name}`}
            className="h-10 w-auto shrink-0 rounded border border-border"
            loading="lazy"
          />
        ) : null}
        <div className="text-xs leading-5 text-muted-foreground">
          {data.capital ? <p>🏛️ {data.capital}</p> : null}
          {data.region ? <p>🌍 {data.region}</p> : null}
          {data.population ? <p>👥 {fmtNum(data.population)} hab.</p> : null}
          {data.languages ? <p>🗣️ {data.languages}</p> : null}
          {data.currencies ? <p>💰 {data.currencies}</p> : null}
        </div>
      </div>
      {data.url ? (
        <a
          href={data.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary underline underline-offset-2"
        >
          Voir la carte ↗
        </a>
      ) : null}
    </CardShell>
  )
}

export function MediaCard({ data }: { data: MediaData }) {
  return (
    <CardShell title={`🎵 ${data.title}`}>
      <div className="flex items-center gap-3">
        {data.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.image}
            alt={data.title}
            className="size-14 shrink-0 rounded-lg border border-border"
            loading="lazy"
          />
        ) : null}
        <div className="min-w-0">
          {data.subtitle ? (
            <p className="truncate font-medium">{data.subtitle}</p>
          ) : null}
          {data.extra ? (
            <p className="text-xs text-muted-foreground">{data.extra}</p>
          ) : null}
          {data.url ? (
            <a
              href={data.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary underline underline-offset-2"
            >
              Écouter / voir ↗
            </a>
          ) : null}
        </div>
      </div>
    </CardShell>
  )
}

export function EntityCard({ data }: { data: EntityData }) {
  return (
    <CardShell title={data.title}>
      {data.items.map((item, i) => {
        const body = (
          <>
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image}
                alt=""
                className="size-10 shrink-0 rounded-lg border border-border object-contain"
                loading="lazy"
              />
            ) : null}
            <span className="min-w-0">
              <span className="block truncate font-medium">{item.title}</span>
              {item.subtitle ? (
                <span className="block truncate text-xs text-muted-foreground">
                  {item.subtitle}
                </span>
              ) : null}
            </span>
          </>
        )
        return item.url ? (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-accent"
          >
            {body}
          </a>
        ) : (
          <div key={i} className="flex items-center gap-2.5 px-1 py-1">
            {body}
          </div>
        )
      })}
    </CardShell>
  )
}

export function ArxivCard({ data }: { data: ArxivData }) {
  return (
    <CardShell title="🔬 arXiv">
      {data.papers.map((p, i) => (
        <div
          key={i}
          className="border-b border-border/60 py-1.5 last:border-0"
        >
          <a
            href={p.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium hover:underline"
          >
            {p.title}
          </a>
          <p className="text-xs text-muted-foreground">
            {p.authors}
            {p.published ? ` · ${p.published}` : ''}
          </p>
          <p className="mt-0.5 text-xs leading-5">{p.summary}…</p>
        </div>
      ))}
    </CardShell>
  )
}
