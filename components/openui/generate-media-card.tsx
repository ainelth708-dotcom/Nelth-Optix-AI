'use client'

import { useEffect, useState } from 'react'

import { defineComponent, useIsStreaming } from '@openuidev/react-lang'
import { RotateCcw, TriangleAlert } from 'lucide-react'
import { z } from 'zod/v4'

import { addNelthLogo } from '@/lib/imagine/add-logo'
import { buildV3Prompt } from '@/lib/imagine/v3prompt'
import { compressImageForUpload } from '@/lib/upload/compress-image'

import { AiImageCard } from '@/components/ai-image-card'

// ---------------------------------------------------------------------------
// GenerateMediaCard — AI media generation for Nelth-IA OpenUI chat.
// A self-running OpenUI component (same models/pipelines as /imagine):
//   kind image          → Nelth-imagen_V3 (metaai) text-to-image
//   kind image_edit     → Nelth-imagen_V3 image-to-image from sourceImageUrl
//   kind video          → Nelth-omni_V1 text-to-video (vibes batch)
//   kind image_to_video → Nelth-omni_V1 animate sourceImageUrl
// Fires once post-stream, shows the Imagine waiting card while working, then
// the final media. Results are cached (memory + localStorage) so re-rendered
// stored messages never regenerate.
// ---------------------------------------------------------------------------

type GenerateMediaKind = 'image' | 'video' | 'image_edit' | 'image_to_video'

interface MediaResult {
  url: string
  isVideo: boolean
}

type Json = Record<string, unknown>

const V3_PHASE_LABELS: Record<string, string> = {
  waiting: 'Attente',
  sending: 'Envoi',
  generating: 'Génération',
  image: 'Finalisation'
}

const INITIAL_LABELS: Record<GenerateMediaKind, string> = {
  image: 'Démarrage V3…',
  image_edit: 'Édition de l’image…',
  video: 'Démarrage de la vidéo…',
  image_to_video: 'Préparation de l’image…'
}

/* Helpers ------------------------------------------------------------------ */

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms))

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function strArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

async function postJson(url: string, body: Json): Promise<Json> {
  const response = await imagineFetch(url, JSON.stringify(body))
  const data = (await response.json().catch(() => null)) as Json | null
  if (!response.ok || !data) {
    throw new Error(str(data?.error) || 'La requête a échoué, réessaie.')
  }
  const error = str(data.error)
  if (error) throw new Error(error)
  return data
}

/**
 * Same POST helper as the /imagine studio: single automatic retry on
 * NETWORK failures only (never on HTTP errors), and only when the failure
 * happens fast (<20s — the server can't have finished, so no duplicate
 * generation risk). Mobile networks drop mid-request often.
 */
async function imagineFetch(path: string, body: string): Promise<Response> {
  let lastError: unknown = null
  for (let attempt = 0; attempt <= 1; attempt++) {
    const started = Date.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 70000)
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal
      })
      clearTimeout(timeout)
      return response
    } catch (error) {
      clearTimeout(timeout)
      lastError = error
      const transient =
        error instanceof DOMException
          ? error.name === 'AbortError'
          : error instanceof TypeError
      const fast = Date.now() - started < 20000
      if (!transient || !fast || attempt >= 1) throw error
      await sleep(2000)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Échec réseau.')
}

type Progress = (label: string) => void

function humanizeV3Phase(data: Json): string {
  const note = str(data.note)
  if (note) return note
  return V3_PHASE_LABELS[str(data.phase)] ?? 'Génération'
}

/* Durable result store (localStorage) — stored messages re-render without
 * re-running paid generations after a reload. Only http(s) URLs are kept. */

const STORE_KEY = 'nelth-opui-media-results-v1'
const STORE_MAX = 60

function readStore(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}')
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, string>)
      : {}
  } catch {
    return {}
  }
}

function storeResult(key: string, url: string): void {
  try {
    if (!/^https?:\/\//i.test(url)) return
    const entries = readStore()
    const ids = Object.keys(entries)
    while (ids.length >= STORE_MAX) delete entries[ids.shift() as string]
    entries[key] = url
    localStorage.setItem(STORE_KEY, JSON.stringify(entries))
  } catch {
    // Private mode / quota: cache misses simply mean regeneration next time.
  }
}

/* In-memory run cache — deduplicates concurrent mounts of the same args. */

const runs = new Map<string, Promise<MediaResult>>()

/* Generation pipelines (the exact /imagine flows) --------------------------- */

async function pollV3ImageJob(
  jobId: string,
  onProgress: Progress
): Promise<string> {
  for (let attempt = 0; attempt < 60; attempt++) {
    await sleep(2500)
    const data = await postJson('/api/imagine/v3/images/poll', { jobId })
    const urls = strArray(data.imageUrls)
    if (str(data.status) === 'done' && urls.length > 0) return urls[0]
    if (['failed', 'error'].includes(str(data.status))) {
      throw new Error('La génération a échoué, réessaie.')
    }
    onProgress(`Génération V3… ${humanizeV3Phase(data)}`)
  }
  throw new Error('Délai dépassé, réessaie.')
}

async function pollVideoBatch(batchId: string): Promise<string> {
  for (let attempt = 0; attempt < 60; attempt++) {
    await sleep(5000)
    const data = await postJson('/api/imagine/videos/poll', { batchId })
    const batch = data.batch as
      | {
          isComplete?: unknown
          hasError?: unknown
          content?: Array<{ videoUrl?: unknown; imageUrl?: unknown }>
        }
      | undefined
    const first = batch?.content?.[0]
    if (typeof first?.videoUrl === 'string' && first.videoUrl) {
      return first.videoUrl
    }
    if (batch?.hasError === true) {
      throw new Error('La vidéo a échoué, réessaie.')
    }
  }
  throw new Error('Délai dépassé, réessaie.')
}

/**
 * Watermark strip (server fetch, like the studio) + Nelth logo stamp, then
 * persistence through /api/upload. Any failure walks back to the raw URL.
 */
async function finalizeImage(rawUrl: string): Promise<string> {
  let cleaned: Blob | null = null
  try {
    const response = await fetch('/api/imagine/images/clean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: rawUrl })
    })
    if (response.ok) {
      const cleanedBlob = new Blob([await response.blob()], {
        type: 'image/png'
      })
      const cleanedUrl = URL.createObjectURL(cleanedBlob)
      try {
        cleaned = await addNelthLogo(cleanedUrl)
      } finally {
        URL.revokeObjectURL(cleanedUrl)
      }
    }
  } catch {
    cleaned = null
  }
  if (cleaned) {
    const durable = await persistMedia(cleaned, 'nelth-ai-image.png')
    if (durable) return durable
    return URL.createObjectURL(cleaned)
  }
  return rawUrl
}

/** Persists a blob through the existing /api/upload pipeline. */
async function persistMedia(
  blob: Blob,
  filename: string
): Promise<string | null> {
  try {
    const form = new FormData()
    form.append(
      'file',
      new File([blob], filename, {
        type: blob.type || 'application/octet-stream'
      })
    )
    const response = await fetch('/api/upload', { method: 'POST', body: form })
    if (!response.ok) return null
    const data = (await response.json().catch(() => null)) as {
      file?: { url?: unknown }
    } | null
    const url = data?.file?.url
    return typeof url === 'string' && url ? url : null
  } catch {
    return null
  }
}

/**
 * The animate starter needs the image registered in the vibes project
 * (mediaEntId). Chat attachments don't have one, so fetch the source bytes
 * and run the same upload pipeline as /imagine.
 */
async function ensureVibesSource(
  imageUrl: string
): Promise<{ id: string; imageUrl: string; mediaEntId: string }> {
  const response = await fetch(imageUrl)
  if (!response.ok) throw new Error('Image source inaccessible.')
  const blob = await response.blob()
  const kind = (blob.type || 'image/png').split('/')[1] ?? 'png'
  const file = new File([blob], `source.${kind}`, {
    type: blob.type || 'image/png'
  })
  const compressed = await compressImageForUpload(file).catch(() => null)
  if (!compressed?.base64) throw new Error('Lecture de l’image impossible.')
  const data = await postJson('/api/imagine/upload', {
    imageBase64: compressed.base64,
    filename: `source.${kind}`
  })
  const mediaEntId = str(data.mediaEntId)
  if (!mediaEntId) throw new Error('La préparation de la source a échoué.')
  return {
    id: mediaEntId,
    imageUrl: str(data.imageUrl) || imageUrl,
    mediaEntId
  }
}

async function runGeneration(
  kind: GenerateMediaKind,
  prompt: string,
  sourceImageUrl: string,
  aspectRatio: string,
  onProgress: Progress
): Promise<MediaResult> {
  if (kind === 'image') {
    onProgress('Démarrage V3…')
    const data = await postJson('/api/imagine/v3/images', {
      prompt: buildV3Prompt(prompt, 1, aspectRatio || 'auto')
    })
    const [jobId] = strArray(data.jobs)
    if (!jobId) throw new Error('La génération a échoué, réessaie.')
    const rawUrl = await pollV3ImageJob(jobId, onProgress)
    onProgress('Nettoyage…')
    return { url: await finalizeImage(rawUrl), isVideo: false }
  }

  if (kind === 'image_edit') {
    onProgress('Édition de l’image…')
    const data = await postJson('/api/imagine/v3/images/edit', {
      imageUrl: sourceImageUrl,
      prompt
    })
    const jobId = str(data.jobId)
    if (!jobId) throw new Error('L’édition a échoué, réessaie.')
    const rawUrl = await pollV3ImageJob(jobId, onProgress)
    onProgress('Nettoyage…')
    return { url: await finalizeImage(rawUrl), isVideo: false }
  }

  if (kind === 'video') {
    onProgress('Démarrage de la vidéo…')
    const batchId = await startVideoJob(async () => {
      const data = await postJson('/api/imagine/videos', {
        prompt,
        // /imagine parity: the studio's "auto" maps to 1:1 for videos.
        aspectRatio: aspectRatio || '1:1',
        resolution: '480p',
        variations: 1
      })
      const id = str(data.batchId)
      if (!id) throw new Error('La génération a échoué, réessaie.')
      return id
    })
    onProgress('Génération vidéo…')
    return {
      url: await finishVideoJob(await pollVideoBatch(batchId)),
      isVideo: true
    }
  }

  // image_to_video
  const source = await ensureVibesSource(sourceImageUrl)
  onProgress('Animation de l’image…')
  const batchId = await startVideoJob(async () => {
    const data = await postJson('/api/imagine/videos/animate', {
      source,
      motion: prompt || undefined
    })
    const id = str(data.batchId)
    if (!id) throw new Error('L’animation a échoué, réessaie.')
    return id
  })
  onProgress('Génération vidéo…')
  return {
    url: await finishVideoJob(await pollVideoBatch(batchId)),
    isVideo: true
  }
}

/**
 * /imagine parity: the backend fails fast on some video starts, so a fast
 * failure (<20s → no server-side job could exist) is retried once.
 */
async function startVideoJob(start: () => Promise<string>): Promise<string> {
  let lastMessage = ''
  for (let attempt = 0; attempt <= 1; attempt++) {
    const started = Date.now()
    try {
      return await start()
    } catch (error) {
      lastMessage = error instanceof Error && error.message ? error.message : ''
      if (attempt >= 1 || Date.now() - started >= 20000) break
    }
  }
  throw new Error(lastMessage || 'La génération a échoué, réessaie.')
}

/** Poll result: try durable persistence, fall back to the raw URL. */
async function finishVideoJob(videoUrl: string): Promise<string> {
  const bytes = await fetch(videoUrl)
    .then(response => (response.ok ? response.blob() : null))
    .catch(() => null)
  const durable = bytes ? await persistMedia(bytes, 'nelth-ai-video.mp4') : null
  return durable ?? videoUrl
}

/**
 * Starts (or reuses) one generation for the given arguments. Labels stream to
 * the first caller only; duplicates resolve to the same result instantly.
 */
function startGeneration(
  kind: GenerateMediaKind,
  prompt: string,
  sourceImageUrl: string,
  aspectRatio: string,
  onProgress: Progress
): Promise<MediaResult> {
  const key = [kind, prompt, sourceImageUrl, aspectRatio].join('\n')
  const stored = readStore()[key]
  if (stored) {
    return Promise.resolve({
      url: stored,
      isVideo: kind === 'video' || kind === 'image_to_video'
    })
  }
  const existing = runs.get(key)
  if (existing) return existing
  const promise = runGeneration(
    kind,
    prompt,
    sourceImageUrl,
    aspectRatio,
    onProgress
  ).then(result => {
    storeResult(key, result.url)
    runs.delete(key)
    return result
  })
  const fail = (error: unknown) => {
    runs.delete(key)
    throw error
  }
  const guarded = promise.catch(fail) as Promise<MediaResult>
  runs.set(key, guarded)
  if (runs.size > 20) {
    const first = runs.keys().next().value
    if (first !== undefined) runs.delete(first)
  }
  return guarded
}

/* OpenUI component ---------------------------------------------------------- */

type Phase =
  | { state: 'working'; label: string }
  | { state: 'ready'; url: string; isVideo: boolean }
  | { state: 'error'; message: string }

const RATIO_CSS: Record<string, string> = {
  '1:1': '1 / 1',
  '16:9': '16 / 9',
  '9:16': '9 / 16'
}

/**
 * One card instance. Re-keyed by the parent whenever the arguments change, so
 * its state (and therefore one playwright-free flow) resets cleanly.
 */
function MediaCardBody({
  kind,
  prompt,
  sourceImageUrl,
  aspectRatio,
  onRetry
}: {
  kind: GenerateMediaKind
  prompt: string
  sourceImageUrl: string
  aspectRatio: string
  onRetry: () => void
}) {
  const isStreaming = useIsStreaming()
  const missingSource =
    (kind === 'image_edit' || kind === 'image_to_video') &&
    !/^https?:\/\//i.test(sourceImageUrl)
  const [phase, setPhase] = useState<Phase>({
    state: 'working',
    label: INITIAL_LABELS[kind]
  })

  useEffect(() => {
    if (missingSource) return
    if (isStreaming) return
    let active = true
    const onProgress = (label: string) => {
      if (active) setPhase({ state: 'working', label })
    }
    startGeneration(kind, prompt, sourceImageUrl, aspectRatio, onProgress)
      .then(result => {
        if (active) {
          setPhase({ state: 'ready', url: result.url, isVideo: result.isVideo })
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setPhase({
            state: 'error',
            message:
              error instanceof Error && error.message
                ? error.message
                : 'La génération a échoué, réessaie.'
          })
        }
      })
    return () => {
      active = false
    }
  }, [kind, prompt, sourceImageUrl, aspectRatio, isStreaming, missingSource])

  // /imagine result cards render at a fixed 2:3 box (object-cover); an
  // explicit aspectRatio prop wins over that default.
  const ratio = RATIO_CSS[aspectRatio] ?? '2 / 3'

  if (missingSource) {
    return (
      <ErrorState
        message="Ajoute ou génère d’abord une image, puis redemande ta modification ou ton animation."
        onRetry={null}
      />
    )
  }

  if (phase.state === 'ready') {
    if (phase.isVideo) {
      return (
        <div
          className="relative w-full overflow-hidden rounded-[4px] bg-black"
          style={{ aspectRatio: ratio }}
        >
          <video
            src={phase.url}
            controls
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-contain"
          />
        </div>
      )
    }
    return (
      <div
        className="relative w-full overflow-hidden rounded-[4px] bg-[#f5f5f5] dark:bg-white/5"
        style={{ aspectRatio: ratio }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={phase.url}
          alt={prompt}
          loading="lazy"
          className="discover-card-in absolute inset-0 h-full w-full object-cover"
        />
      </div>
    )
  }

  if (phase.state === 'error') {
    return <ErrorState message={phase.message} onRetry={onRetry} />
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-[4px] bg-[#f5f5f5] dark:bg-white/5"
      style={{ aspectRatio: ratio }}
    >
      {/* The Imagine waiting card — 100% same blink-grid animation. */}
      <AiImageCard
        generateDuration={9999}
        imageSrc=""
        imageAlt=""
        label=""
        showFooter={false}
        className="absolute inset-0 aspect-auto rounded-[4px] border-0 bg-transparent [&_.tabular-nums]:hidden"
      />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 p-3">
        <span className="size-2 shrink-0 animate-ping rounded-full bg-sky-500" />
        <span className="imagine-status-shimmer text-xs font-medium">
          {phase.label}
        </span>
      </div>
    </div>
  )
}

function ErrorState({
  message,
  onRetry
}: {
  message: string
  onRetry: (() => void) | null
}) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-2 rounded-[4px] bg-[#f5f5f5] p-4 text-center dark:bg-white/5">
      <TriangleAlert size={16} className="text-red-500" aria-hidden="true" />
      <p className="max-w-[36ch] text-xs text-red-600 dark:text-red-400">
        {message}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-black"
        >
          <RotateCcw size={12} aria-hidden="true" /> Réessayer
        </button>
      ) : null}
    </div>
  )
}

function GenerateMediaCardView({
  kind,
  prompt,
  sourceImageUrl,
  aspectRatio
}: {
  kind: GenerateMediaKind
  prompt: string
  sourceImageUrl: string
  aspectRatio: string
}) {
  const [nonce, setNonce] = useState(0)
  const argKey = [nonce, kind, prompt, sourceImageUrl, aspectRatio].join('\n')
  return (
    <MediaCardBody
      key={argKey}
      kind={kind}
      prompt={prompt}
      sourceImageUrl={sourceImageUrl}
      aspectRatio={aspectRatio}
      onRetry={() => setNonce(value => value + 1)}
    />
  )
}

export const GenerateMediaCard = defineComponent({
  name: 'GenerateMediaCard',
  props: z.object({
    kind: z.enum(['image', 'video', 'image_edit', 'image_to_video']),
    prompt: z.string(),
    sourceImageUrl: z.string().optional(),
    aspectRatio: z.enum(['1:1', '16:9', '9:16']).optional()
  }),
  description:
    'Live AI media the app generates while the card animates (the original Nelth-imagine pipelines, the prompt is sent as-is). kind "image": text-to-image; prompt = the user\'s request VERBATIM, never rewritten, expanded or styled by you. kind "image_edit": edit/transform the image at sourceImageUrl, prompt = the user\'s edit request verbatim. kind "video": short text-to-video clip; prompt verbatim. kind "image_to_video": animate the image at sourceImageUrl; prompt = the motion the user described, verbatim. ALWAYS set sourceImageUrl when the user attached or generated an image and asks to modify or animate it — never merely describe such an image. aspectRatio "1:1", "16:9" or "9:16". Introduce it with at most one short sentence; never add Image/SearchImage placeholders for it and never describe its result yourself.',
  component: ({ props }) => (
    <GenerateMediaCardView
      kind={props.kind}
      prompt={props.prompt}
      sourceImageUrl={props.sourceImageUrl ?? ''}
      aspectRatio={props.aspectRatio ?? ''}
    />
  )
})
