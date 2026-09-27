'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  IconArrowLeft,
  IconLayoutGrid,
  IconLoader2,
  IconPhoto,
  IconPlus,
  IconRectangleVertical,
  IconSparkles,
  IconVideo,
  IconVolumeOff
} from '@tabler/icons-react'
import { ArrowUp, X } from 'lucide-react'

import {
  OFFICIAL_PRESETS_MIXED,
  type OfficialPreset
} from '@/lib/imagine/official-presets'
import { buildV3Prompt } from '@/lib/imagine/v3prompt'
import { compressImageForUpload } from '@/lib/upload/compress-image'
import {
  isAndroidDevice,
  pickSingleImageViaPhotoPicker
} from '@/lib/upload/photo-picker'
import { cn } from '@/lib/utils'

import AiImageCard from '@/components/ai-image-card'
import { ImageEditor } from '@/components/image-editor'
import { VideoPlayer } from '@/components/sora-ui/effects/video-player'

type StudioMode = 'image' | 'video'
type AspectRatio = '1:1' | '16:9' | '9:16'
type VideoResolution = '480p' | '720p'
type VideoDuration = '6s' | '10s'

export interface ImagineParams {
  mode: StudioMode
  prompt: string
  aspectRatio: AspectRatio
  resolution: VideoResolution
  duration: VideoDuration
  style: string | null
  variations: number
  sourceImageEntId: string | null
  imagenModel: ImagenModel
}

export type ImagenModel = 'v2' | 'v3'

export interface StudioAttachment {
  id: string
  name: string
  previewUrl: string
  status: 'uploading' | 'ready' | 'error'
  /** Visible sub-step while uploading: compression first, then send. */
  stage?: 'compress' | 'upload'
  error?: string
  /** Original file kept in memory so a failed upload can be retried. */
  file?: File
  ent?: {
    sourceImageEntId: string
    mediaEntId: string
    imageUrl: string
    allMediaEntIds: Array<{ accountIndex: number; mediaEntId: string }>
  }
}

export interface ComposerExtras {
  variations: number
  setVariations: (n: number) => void
  variationsLocked: boolean
  attachmentBar: React.ReactNode
  onAttach: () => void
  canSend: boolean
}

interface ImagineStudioProps {
  onGenerate?: (params: ImagineParams) => void
}

// ---------------------------------------------------------------------------
// Small building blocks (pixel spec: 752px composer, 22px radius, toolbar)
// ---------------------------------------------------------------------------

function ToolbarIconButton({
  label,
  onClick,
  children,
  className
}: {
  label: string
  onClick?: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/10',
        className
      )}
    >
      {children}
    </button>
  )
}

function ModeCapsule({
  active,
  onClick,
  label,
  icon,
  wide
}: {
  active?: boolean
  onClick?: () => void
  label: string
  icon: React.ReactNode
  wide?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex h-[38px] shrink-0 items-center gap-1.5 rounded-[18px] px-3 text-[14px] font-medium transition-colors',
        wide && 'min-w-[70px] justify-center',
        active
          ? 'border border-black/5 bg-white text-[#111] shadow-[0_1px_3px_rgba(0,0,0,0.10)] dark:border-white/10 dark:bg-background dark:text-foreground'
          : 'text-neutral-500 hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/10'
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabledValues = [],
  disabledHint
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  disabledValues?: readonly T[]
  disabledHint?: string
}) {
  return (
    <div className="flex h-[38px] shrink-0 items-center gap-1 rounded-[20px] bg-neutral-100 p-1 dark:bg-muted">
      {options.map(option => {
        const isActive = option === value
        const isDisabled = disabledValues.includes(option) && !isActive
        return (
          <button
            key={option}
            type="button"
            disabled={isDisabled}
            title={isDisabled ? disabledHint : option}
            onClick={() => onChange(option)}
            className={cn(
              'flex h-full items-center justify-center rounded-[16px] px-3 text-[14px] transition-colors',
              isActive
                ? 'bg-white font-medium text-[#111] shadow-[0_1px_3px_rgba(0,0,0,0.10)] dark:bg-background dark:text-foreground'
                : 'text-neutral-500 dark:text-neutral-400',
              !isActive &&
                !isDisabled &&
                'hover:bg-black/5 dark:hover:bg-white/10',
              isDisabled && 'cursor-not-allowed opacity-50'
            )}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Imagine studio (frontend only — backend wiring comes later)
// ---------------------------------------------------------------------------

const ASPECT_RATIOS: AspectRatio[] = ['1:1', '16:9', '9:16']
const VIDEO_RESOLUTIONS: VideoResolution[] = ['480p', '720p']
const VIDEO_DURATIONS: VideoDuration[] = ['6s', '10s']

// ---------------------------------------------------------------------------
// Variations selector (1-4, default 2). Locked to 1 when an image is
// attached (the request becomes image-to-image / image-to-video).
// ---------------------------------------------------------------------------

function VariationsSelect({
  value,
  onChange,
  locked
}: {
  value: number
  onChange: (n: number) => void
  locked: boolean
}) {
  return (
    <div
      title={locked ? 'Fixé à 1 avec une image' : 'Variations'}
      className="flex h-[38px] shrink-0 items-center gap-0.5 rounded-[19px] bg-neutral-100 p-1 dark:bg-muted"
    >
      {[1, 2, 3, 4].map(n => (
        <button
          key={n}
          type="button"
          disabled={locked}
          onClick={() => onChange(n)}
          aria-pressed={value === n}
          aria-label={`${n} variation${n > 1 ? 's' : ''}`}
          className={cn(
            'flex size-[30px] items-center justify-center rounded-full text-[13px] transition-colors',
            value === n
              ? 'bg-white font-semibold text-[#111] shadow-[0_1px_3px_rgba(0,0,0,0.10)] dark:bg-background dark:text-foreground'
              : 'text-neutral-500 dark:text-neutral-400',
            !locked && value !== n && 'hover:bg-black/5 dark:hover:bg-white/10',
            locked && 'cursor-not-allowed opacity-60'
          )}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Imagen model selector (glassmorphic segmented): V2 (vibes backend) /
// V3 (metaai backend, new). Video stays single-model: fixed Omni chip.
// ---------------------------------------------------------------------------

const IMAGEN_MODELS: Array<{
  id: ImagenModel
  short: string
  name: string
  badge?: string
}> = [
  { id: 'v2', short: 'V2', name: 'Nelth-imagen_V2 (vibes)' },
  { id: 'v3', short: 'V3', name: 'Nelth-imagen_V3 (metaai)', badge: 'new' }
]

function ImagenModelSelect({
  value,
  onChange
}: {
  value: ImagenModel
  onChange: (m: ImagenModel) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Modèle image"
      title="Modèle image"
      className="flex h-[38px] shrink-0 items-center gap-0.5 rounded-[19px] border border-white/50 bg-white/55 p-1 shadow-[0_2px_14px_rgba(30,60,120,0.10)] backdrop-blur-md dark:border-white/15 dark:bg-white/10"
    >
      {IMAGEN_MODELS.map(m => {
        const active = value === m.id
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={active}
            title={m.name}
            onClick={() => onChange(m.id)}
            className={cn(
              'flex h-[30px] items-center gap-1 rounded-full px-2.5 text-[13px] transition-colors',
              active
                ? 'bg-white/90 font-semibold text-[#111] shadow-sm dark:bg-white/20 dark:text-foreground'
                : 'text-neutral-500 hover:bg-white/60 dark:text-neutral-400 dark:hover:bg-white/10'
            )}
          >
            {m.short}
            {m.badge ? (
              <span className="rounded-full bg-sky-500 px-1 text-[9px] font-bold uppercase leading-[1.4] text-white">
                {m.badge}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function VideoOmniChip() {
  return (
    <span
      title="Nelth-omni_V1 — unique modèle vidéo"
      className="flex h-[38px] shrink-0 items-center gap-1.5 rounded-[19px] border border-white/50 bg-white/55 px-3 text-[13px] font-medium text-[#111] shadow-[0_2px_14px_rgba(0,0,0,0.06)] backdrop-blur-md dark:border-white/15 dark:bg-white/10 dark:text-foreground"
    >
      <span className="size-1.5 rounded-full bg-emerald-500" />
      Omni V1
    </span>
  )
}

// ---------------------------------------------------------------------------
// Attached source images (thumbnail + upload status + remove, one chip
// per image — multi-upload: adding a file appends, never replaces).
// ---------------------------------------------------------------------------

function AttachmentChip({
  attachment,
  onRemove,
  onRetry
}: {
  attachment: StudioAttachment
  onRemove: () => void
  onRetry: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-black/5 bg-neutral-100 dark:border-white/10 dark:bg-white/10">
        {attachment.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={attachment.previewUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : null}
        {attachment.status === 'uploading' && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
            <IconLoader2 size={14} className="animate-spin text-white" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[#111] dark:text-foreground">
          {attachment.name}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {attachment.status === 'uploading'
            ? attachment.stage === 'upload'
              ? 'Envoi…'
              : 'Compression…'
            : attachment.status === 'ready'
              ? 'Prête — variations fixées à 1'
              : (attachment.error ?? 'Échec de l’envoi.')}
        </p>
      </div>
      {attachment.status === 'error' && attachment.file ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-full border border-black/10 px-2.5 py-1 text-xs font-medium text-[#111] transition-colors hover:bg-black/5 dark:border-white/15 dark:text-foreground dark:hover:bg-white/10"
        >
          Réessayer
        </button>
      ) : null}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Retirer l’image"
        className="shrink-0 rounded-full p-1.5 text-neutral-500 transition-colors hover:bg-black/5 hover:text-foreground dark:text-neutral-400"
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  )
}

function AttachmentBar({
  attachments,
  onRemove,
  onRetry
}: {
  attachments: StudioAttachment[]
  onRemove: (id: string) => void
  onRetry: (id: string) => void
}) {
  if (attachments.length === 0) return null
  return (
    <div className="flex flex-col gap-2 px-[19px] pt-3">
      {attachments.map(attachment => (
        <AttachmentChip
          key={attachment.id}
          attachment={attachment}
          onRemove={() => onRemove(attachment.id)}
          onRetry={() => onRetry(attachment.id)}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Autoplay helper for the video preset cards: forces muted (the muted
// content attribute alone is unreliable through React) and starts the
// infinite loop. Module-level so the ref identity is stable across
// renders — the <video> node is never recreated while typing.
// ---------------------------------------------------------------------------

function autoplayMutedLoop(el: HTMLVideoElement | null) {
  if (!el) return
  el.muted = true
  void el.play().catch(() => {
    // Autoplay blocked (data saver…) — the poster stays visible.
  })
}

// ---------------------------------------------------------------------------
// V2 → V3 upsell modal: shown once per session when a second source
// image is added while on the V2 model. Modern compact card, same
// visual language as the preset modal, portaled to document.body.
// ---------------------------------------------------------------------------

function V2UpsellModal({
  onStay,
  onSwitch
}: {
  onStay: () => void
  onSwitch: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onStay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onStay])

  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Passer au modèle V3"
      onClick={onStay}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/60 backdrop-blur-lg"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          onClick={e => e.stopPropagation()}
          className="w-[400px] max-w-full rounded-[24px] bg-white p-5 text-neutral-800 shadow-[0_24px_90px_rgba(0,0,0,0.55)] dark:bg-[#202020] dark:text-neutral-200"
        >
          <div className="flex size-11 items-center justify-center rounded-full bg-black text-white">
            <IconSparkles size={20} />
          </div>
          <p className="mt-4 text-[17px] font-semibold leading-snug">
            Plusieurs images ?
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-neutral-600 dark:text-neutral-400">
            Pour que le multi-image fonctionne, bascule sur le dernier modèle
            Nelth-AI :{' '}
            <span className="font-semibold text-neutral-900 dark:text-white">
              Nelth-Imagen_V3
            </span>
            , le plus performant.
          </p>
          <button
            type="button"
            onClick={onSwitch}
            className="mt-5 h-[50px] w-full rounded-[25px] bg-black text-[15px] font-semibold text-white transition-colors duration-200 hover:bg-neutral-800 dark:text-neutral-100"
          >
            Basculer vers Nelth-Imagen_V3
          </button>
          <button
            type="button"
            onClick={onStay}
            className="mt-[18px] w-full text-center text-[14px] font-semibold transition-opacity hover:opacity-70"
          >
            Rester sur le modèle actuel
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function V3ActivatedBanner({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-[16px] bg-sky-500/10 px-3 py-2 text-left dark:bg-sky-400/10">
      <IconSparkles
        size={15}
        className="shrink-0 text-sky-600 dark:text-sky-300"
      />
      <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-neutral-700 dark:text-neutral-200">
        <span className="font-semibold">Nelth-Imagen_V3 activé</span> — le
        modèle le plus performant. Essaie d&apos;uploader plusieurs images
        maintenant.
      </p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="shrink-0 rounded-full p-1 text-neutral-500 transition-colors hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/10"
      >
        <X size={13} strokeWidth={2} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Official preset grid (Whisk-style): dense compact cards, image cover,
// bottom gradient, white label. Artwork + prompts come from the official
// ImageKit catalog (OFFICIAL_PRESETS_MIXED): photos and videos interleaved
// in a single grid that never changes with the studio mode — selecting a
// card switches the studio to that card's mode. Video cards show their
// mp4 poster (plain <img>) with a play badge.
// ---------------------------------------------------------------------------

function StylePresetGrid({
  presets,
  activePrompt,
  onSelect,
  expanded,
  onToggle
}: {
  presets: OfficialPreset[]
  activePrompt: string
  onSelect: (preset: OfficialPreset) => void
  expanded: boolean
  onToggle: () => void
}) {
  // Collapsed: first 17 presets + a "Plus" card; expanded: all + Fermer.
  // The trailing toggle card only renders when collapsing hides presets.
  const COLLAPSED_COUNT = 17
  const visible = expanded ? presets : presets.slice(0, COLLAPSED_COUNT)
  return (
    <div className="grid grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-5">
      {visible.map(preset => {
        const isActive =
          activePrompt.length > 0 && activePrompt === preset.prompt
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset)}
            aria-pressed={isActive}
            title={preset.label}
            className={cn(
              'group relative aspect-[60/86] w-full overflow-hidden rounded-[18px] bg-neutral-200 transition-all duration-150 ease-out hover:scale-[1.04] hover:shadow-md dark:bg-white/10',
              isActive && 'shadow-lg ring-2 ring-white'
            )}
          >
            {preset.kind === 'video' ? (
              <video
                ref={autoplayMutedLoop}
                src={preset.image}
                poster={preset.poster}
                preload="auto"
                autoPlay
                muted
                loop
                playsInline
                disablePictureInPicture
                aria-hidden
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <img
                src={preset.image}
                alt={preset.label}
                loading="lazy"
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/65 via-black/20 to-transparent"
            />
            <span className="absolute bottom-[8px] left-[8px] right-[8px] text-left text-[12px] font-semibold leading-tight text-white">
              {preset.label}
            </span>
          </button>
        )
      })}
      {/* Trailing card — Fermer collapses to 17 + Plus, Plus expands
          back to the full list. Same shape, no image. */}
      {presets.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={onToggle}
          className="flex aspect-[60/86] w-full flex-col items-center justify-center gap-1 rounded-[18px] bg-[#F1F1F1] text-[#555555] transition-transform duration-150 ease-out hover:scale-[1.04] dark:bg-white/10 dark:text-neutral-400"
        >
          {expanded ? (
            <X size={20} strokeWidth={2} />
          ) : (
            <IconPlus size={20} strokeWidth={2} />
          )}
          <span className="text-xs font-medium">
            {expanded ? 'Fermer' : 'Plus'}
          </span>
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Preset card modal: click a card → centered modal with the preset's
// official artwork fully visible (fixed viewer height + contain: never
// cropped or zoomed, and the modal never jumps when the media loads),
// videos autoplay muted in an infinite loop, the card's official prompt
// (collapsed with "Voir plus" / "Moins" when long), then per-category
// actions — edit cards: "Sélectionner une photo" (the picked photo
// becomes the transformation source) + "Annuler"; image/video-gen
// cards: "Envoyer" + "Annuler". Premium dark/blurred backdrop, compact
// rounded card, light + dark mode.
// ---------------------------------------------------------------------------

const PROMPT_COLLAPSED_CHARS = 140

function StylePreviewCard({
  preset,
  onSelectPhoto,
  onSend,
  onClose
}: {
  preset: OfficialPreset
  onSelectPhoto: (file: File) => void
  onSend: () => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const photoInputRef = useRef<HTMLInputElement>(null)
  const [showFullPrompt, setShowFullPrompt] = useState(false)
  const isLongPrompt = preset.prompt.length > PROMPT_COLLAPSED_CHARS
  const promptText =
    !isLongPrompt || showFullPrompt
      ? preset.prompt
      : `${preset.prompt.slice(0, PROMPT_COLLAPSED_CHARS).trimEnd()}…`

  // Portal to document.body: an ancestor with a CSS transform/filter
  // would otherwise turn `fixed inset-0` into ancestor-relative
  // positioning, so after scrolling down the modal+blur would open at
  // the top of the page instead of centered on the viewport.
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={preset.label}
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/60 backdrop-blur-lg"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          onClick={e => e.stopPropagation()}
          className="w-[400px] max-w-full rounded-[24px] bg-white p-4 text-neutral-800 shadow-[0_24px_90px_rgba(0,0,0,0.55)] dark:bg-[#202020] dark:text-neutral-200"
        >
          <div className="relative h-[min(280px,36dvh)] w-full overflow-hidden rounded-[14px] bg-neutral-100 dark:bg-white/5">
            {preset.kind === 'video' ? (
              <video
                ref={autoplayMutedLoop}
                src={preset.image}
                poster={preset.poster}
                preload="auto"
                autoPlay
                muted
                loop
                playsInline
                className="absolute inset-0 h-full w-full object-contain"
              />
            ) : (
              <img
                src={preset.image}
                alt={preset.label}
                draggable={false}
                className="absolute inset-0 h-full w-full object-contain"
              />
            )}
          </div>
          <p className="mt-4 whitespace-pre-wrap text-left text-[16px] font-medium leading-[1.45]">
            {promptText}{' '}
            {isLongPrompt && (
              <button
                type="button"
                onClick={() => setShowFullPrompt(v => !v)}
                className="font-semibold underline underline-offset-2"
              >
                {showFullPrompt ? 'Moins' : 'Voir plus'}
              </button>
            )}
          </p>
          {preset.category === 'edit' ? (
            <>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="mt-4 h-[50px] w-full rounded-[25px] bg-black text-[15px] font-semibold text-white transition-colors duration-200 hover:bg-neutral-800 dark:text-neutral-100"
              >
                Sélectionner une photo
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                // Visually hidden but RENDERED (never display:none): on Android
                // Chrome a display:none input opened by code falls back to the
                // Files manager instead of the gallery picker.
                className="pointer-events-none absolute h-px w-px opacity-0"
                aria-hidden
                tabIndex={-1}
                onChange={e => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) onSelectPhoto(file)
                }}
              />
            </>
          ) : (
            <button
              type="button"
              onClick={onSend}
              className="mt-4 h-[50px] w-full rounded-[25px] bg-black text-[15px] font-semibold text-white transition-colors duration-200 hover:bg-neutral-800 dark:text-neutral-100"
            >
              Envoyer
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="mt-[22px] w-full text-center text-[15px] font-semibold transition-opacity hover:opacity-70"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ---------------------------------------------------------------------------
// Découvrir composer — matches the Découvrir reference twin of the studio
// toolbar: quality pills (Vitesse / Qualité 2.0), mic, pastel-blue CTA.
// ---------------------------------------------------------------------------

interface DiscoverComposerProps {
  prompt: string
  setPrompt: (v: string) => void
  mode: StudioMode
  setMode: (m: StudioMode) => void
  aspectRatio: AspectRatio
  cycleAspectRatio: () => void
  resolution: VideoResolution
  setResolution: (r: VideoResolution) => void
  duration: VideoDuration
  setDuration: (d: VideoDuration) => void
  generating: boolean
  onGenerate: () => void
  extras: ComposerExtras
  imagenModel: ImagenModel
  setImagenModel: (m: ImagenModel) => void
}

function DiscoverComposer({
  prompt,
  setPrompt,
  mode,
  setMode,
  aspectRatio,
  cycleAspectRatio,
  resolution,
  setResolution,
  duration,
  setDuration,
  generating,
  onGenerate,
  extras,
  imagenModel,
  setImagenModel
}: DiscoverComposerProps) {
  return (
    <>
      <div className="w-full overflow-hidden rounded-[24px] border border-[#e5e5e5] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:border-border dark:bg-card">
        {extras.attachmentBar}
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onGenerate()
            }
          }}
          placeholder="Décrivez ce que vous imaginez"
          rows={1}
          className="min-h-[48px] w-full resize-none bg-transparent px-[19px] pt-[16px] text-[16px] leading-[22px] text-[#111] outline-none placeholder:text-[#707070] dark:text-foreground"
        />
        <div className="no-scrollbar flex flex-nowrap items-center gap-2 overflow-x-auto px-[15px] pt-[6px] pb-[11px] md:flex-wrap md:gap-3 md:overflow-visible md:px-[19px]">
          <ToolbarIconButton
            label="Ajouter"
            className="-ml-2"
            onClick={extras.onAttach}
          >
            <IconPlus size={20} strokeWidth={2} />
          </ToolbarIconButton>
          {mode === 'image' ? (
            <>
              <ModeCapsule
                active
                label="Image"
                icon={<IconPhoto size={15} />}
              />
              <ToolbarIconButton
                label="Mode vidéo"
                onClick={() => setMode('video')}
              >
                <IconVideo size={20} />
              </ToolbarIconButton>
              <ToolbarIconButton label="Médias">
                <IconLayoutGrid size={19} />
              </ToolbarIconButton>
              <ImagenModelSelect
                value={imagenModel}
                onChange={setImagenModel}
              />
            </>
          ) : (
            <>
              <ToolbarIconButton
                label="Mode image"
                onClick={() => setMode('image')}
              >
                <IconPhoto size={20} />
              </ToolbarIconButton>
              <ModeCapsule
                active
                wide
                label="Vidéo"
                icon={
                  <IconVideo
                    size={16}
                    className="text-black dark:text-foreground"
                  />
                }
              />
              <ToolbarIconButton label="Médias">
                <IconLayoutGrid size={19} />
              </ToolbarIconButton>
              <VideoOmniChip />
              <div className="hidden md:contents">
                <SegmentedControl
                  options={VIDEO_RESOLUTIONS}
                  value={resolution}
                  onChange={setResolution}
                />
              </div>
              <div className="hidden md:contents">
                <SegmentedControl
                  options={VIDEO_DURATIONS}
                  value={duration}
                  onChange={setDuration}
                  disabledValues={['10s']}
                  disabledHint="Bientôt disponible"
                />
              </div>
              <ToolbarIconButton label="Audio (bientôt disponible)">
                <IconVolumeOff size={18} />
              </ToolbarIconButton>
            </>
          )}
          {/* No ratio in edit/animate mode — the source image decides. */}
          {!extras.variationsLocked && (
            <button
              type="button"
              onClick={cycleAspectRatio}
              title="Format d'image"
              className="flex h-[39px] w-[63px] shrink-0 items-center justify-center gap-1.5 rounded-[20px] bg-neutral-100 text-[14px] text-[#111] transition-colors hover:bg-neutral-200/70 dark:bg-muted dark:text-foreground dark:hover:bg-white/10"
            >
              <IconRectangleVertical size={14} />
              {aspectRatio}
            </button>
          )}
          <VariationsSelect
            value={extras.variationsLocked ? 1 : extras.variations}
            onChange={extras.setVariations}
            locked={extras.variationsLocked}
          />
          <div className="sticky right-0 ml-auto flex shrink-0 items-center gap-1 bg-white pl-1 dark:bg-card">
            <button
              type="button"
              onClick={onGenerate}
              aria-label="Générer"
              title="Générer"
              disabled={!extras.canSend}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black text-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {generating ? (
                <IconLoader2 size={18} className="animate-spin" />
              ) : (
                <ArrowUp size={18} strokeWidth={2.5} />
              )}
            </button>
          </div>
        </div>
      </div>
      {/* Settings row below the composer — mobile only, hidden on
          Android (model switching there goes through the V2 upsell). */}
      {mode === 'video' && !isAndroidDevice() && (
        <div className="mt-3 flex w-full flex-wrap items-center justify-center gap-2 md:hidden">
          <VideoOmniChip />
          <SegmentedControl
            options={VIDEO_RESOLUTIONS}
            value={resolution}
            onChange={setResolution}
          />
          <SegmentedControl
            options={VIDEO_DURATIONS}
            value={duration}
            onChange={setDuration}
            disabledValues={['10s']}
            disabledHint="Bientôt disponible"
          />
        </div>
      )}
      {mode === 'image' && !isAndroidDevice() && (
        <div className="mt-3 flex w-full flex-wrap items-center justify-center gap-2 md:hidden">
          <ImagenModelSelect value={imagenModel} onChange={setImagenModel} />
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Découvrir view: back nav + upgrade pill, user badge, two 2:3 cards
// (loading grain → results), floating composer. Shown with animation
// right when the user sends a prompt.
// ---------------------------------------------------------------------------

export interface ImagineResult {
  kind: 'image' | 'video'
  url: string
  prompt: string
  /** True for fbcdn URLs (video + uncleaned images) that expire (~1h). */
  temporary?: boolean
  /** True when the edit prompt was auto-enhanced (not raw user text). */
  enhanced?: boolean
}

const V3_PHASE_LABEL: Record<string, string> = {
  waiting: 'Attente',
  sending: 'Envoi',
  generating: 'Génération',
  image: 'Finalisation'
}

export function humanizeV3Phase(phase?: string | null): string | null {
  if (!phase) return null
  return V3_PHASE_LABEL[phase.toLowerCase()] ?? phase
}

/**
 * ImageGenerationLoadingCard — loading skeleton with the exact geometry
 * of the final card (same width, 2:3 aspect, rounded corners). Live
 * blinking-grid while the backend works, with its live phase as label;
 * the elapsed-seconds counter is hidden. The reveal is driven by our
 * real results (the card unmounts on arrival), never by the countdown.
 * The card box never changes size, so the conversation height stays
 * frozen while loading.
 */
export function ImageGenerationLoadingCard({
  loading,
  label = ''
}: {
  loading: boolean
  label?: string
}) {
  if (!loading) {
    return <div aria-hidden className="noise-placeholder absolute inset-0" />
  }
  return (
    <AiImageCard
      generateDuration={9999}
      imageSrc=""
      imageAlt=""
      label={label}
      showFooter={false}
      className="absolute inset-0 aspect-auto rounded-[4px] border-0 bg-[#f5f5f5] dark:bg-white/5 [&_.tabular-nums]:hidden"
    />
  )
}

function DiscoverCard({
  result,
  loading,
  onEdit,
  phase
}: {
  result?: ImagineResult | null
  loading: boolean
  onEdit?: () => void
  phase?: string | null
}) {
  // Fresh mount per URL (parent keys by identity): video starts hidden
  // over its own skeleton and fades in on first playable frame — same
  // geometry, no height change, smooth skeleton → media transition.
  const [videoReady, setVideoReady] = useState(false)
  return (
    <div className="group relative aspect-[2/3] w-full overflow-hidden rounded-[4px] bg-[#f5f5f5] transition-shadow duration-150 ease-out hover:shadow-lg dark:bg-white/5">
      {result?.kind === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={result.url}
          src={result.url}
          alt=""
          draggable={false}
          onClick={onEdit}
          className="discover-card-in absolute inset-0 h-full w-full cursor-pointer object-cover"
        />
      ) : result?.kind === 'video' ? (
        <VideoPlayer
          src={result.url}
          defaultSpeed={1}
          dialogLabel="Lecture de la vidéo"
          triggerClassName="absolute inset-0 block h-full w-full cursor-pointer p-0"
        >
          {!videoReady && (
            <ImageGenerationLoadingCard loading={loading} label={phase ?? ''} />
          )}
          <video
            key={result.url}
            src={result.url}
            muted
            playsInline
            preload="metadata"
            onCanPlay={() => setVideoReady(true)}
            className={cn(
              'pointer-events-none absolute inset-0 h-full w-full object-cover transition-all duration-150 ease-out group-hover:scale-[1.04]',
              videoReady ? 'opacity-100' : 'opacity-0'
            )}
          />
          <span className="pointer-events-none absolute left-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/55 text-white">
            <IconVideo size={14} />
          </span>
        </VideoPlayer>
      ) : (
        <ImageGenerationLoadingCard loading={loading} label={phase ?? ''} />
      )}
      {result?.temporary ? (
        <span
          title="URL temporaire (~1h)"
          className="pointer-events-none absolute right-2 top-2 rounded-full bg-amber-100/95 px-2 py-0.5 text-[10px] font-medium text-amber-700"
        >
          Temporaire
        </span>
      ) : null}
      {result?.kind === 'image' && result?.enhanced ? (
        <span
          title="Prompt auto-amélioré appliqué"
          className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white"
        >
          ✨ Amélioré
        </span>
      ) : null}
    </div>
  )
}

function DiscoverView({
  onBack,
  onRetry,
  onEditResult,
  results,
  expected,
  working,
  status,
  error,
  phase,
  composer
}: {
  onBack: () => void
  onRetry: () => void
  onEditResult: (r: ImagineResult) => void
  results: ImagineResult[]
  expected: number
  working: boolean
  status: string | null
  error: string | null
  phase: string | null
  composer: React.ReactNode
}) {
  return (
    <div className="flex min-h-full w-full flex-col bg-[#fafafa] [font-family:Arial,sans-serif] dark:bg-background">
      <div className="sticky top-0 z-20 flex items-center justify-between bg-[#fafafa]/85 px-3 pb-3 pt-16 backdrop-blur-md md:px-6 md:pt-3 dark:bg-background/85">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Retour"
            title="Retour"
            className="flex size-10 items-center justify-center rounded-full bg-[#f1f1f1] text-black transition-transform hover:scale-105 active:scale-95 dark:bg-white/10 dark:text-foreground"
          >
            <IconArrowLeft size={18} />
          </button>
          <span className="select-none text-[16px] font-semibold text-[#171717] dark:text-foreground">
            Découvrir
          </span>
        </div>
        <button
          type="button"
          title="Bientôt disponible"
          className="flex h-[36px] items-center gap-1.5 rounded-full bg-[#D9E7FF] px-4 text-[13px] font-medium text-[#5D769C] transition hover:brightness-[0.97] dark:bg-[#D9E7FF]/15 dark:text-[#9db4d4]"
        >
          <IconSparkles size={15} />
          <span className="hidden sm:inline">Mettre à niveau</span>
          <span className="sm:hidden">Pro</span>
        </button>
      </div>
      {/* Status slot with reserved height: appearing/disappearing status
          never shifts the cards below. */}
      <div className="pl-4 pr-4 pt-3 md:pl-14">
        <div className="min-h-[24px]">
          {status && !error ? (
            <div className="flex cursor-default select-none flex-row items-center gap-2 text-[14px] text-neutral-600 dark:text-neutral-300">
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neutral-400 opacity-40" />
                <span className="relative inline-flex size-2 rounded-full bg-neutral-400" />
              </span>
              <span className="imagine-status-shimmer">{status}</span>
            </div>
          ) : null}
          {error ? (
            <div className="flex items-center gap-2">
              <p className="flex-1 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="shrink-0 rounded-full border border-black/10 px-3 py-1.5 text-[13px] font-medium text-[#111] transition-colors hover:bg-black/5 dark:border-white/15 dark:text-foreground dark:hover:bg-white/10"
              >
                Réessayer
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 pl-4 pr-4 pt-3 md:grid-cols-3 md:pl-14 xl:grid-cols-4">
        {/* In-flight generation: fresh loading cards first … */}
        {working &&
          Array.from({ length: Math.max(1, expected) }).map((_, i) => (
            <DiscoverCard
              key={`pending-${i}`}
              result={null}
              loading
              phase={phase}
            />
          ))}
        {/* … then every past result, keyed by identity so nothing already
            displayed is ever replaced: 4 max per row, following
            generations flow to the rows below. */}
        {results.map(r => (
          <DiscoverCard
            key={`${r.kind}-${r.url}`}
            result={r}
            loading={false}
            onEdit={r.kind === 'image' ? () => onEditResult(r) : undefined}
          />
        ))}
      </div>
      <div className="sticky bottom-4 z-10 mx-auto mt-auto w-full max-w-[750px] px-4 pb-2 pt-8">
        {composer}
      </div>
      <div className="pb-4" />
    </div>
  )
}

export function ImagineStudio({ onGenerate }: ImagineStudioProps) {
  const [mode, setMode] = useState<StudioMode>('image')
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1')
  const [resolution, setResolution] = useState<VideoResolution>('480p')
  const [duration, setDuration] = useState<VideoDuration>('6s')
  const [expanded, setExpanded] = useState(true)
  const [preview, setPreview] = useState<OfficialPreset | null>(null)
  // V2 multi-image upsell: modal once per session + confirmation banner.
  const [v2UpsellOpen, setV2UpsellOpen] = useState(false)
  const v2UpsellShownRef = useRef(false)
  const [v3BannerVisible, setV3BannerVisible] = useState(false)
  const [view, setView] = useState<'create' | 'discover'>('create')
  const [editing, setEditing] = useState<ImagineResult | null>(null)
  const [expectedCount, setExpectedCount] = useState(2)
  const [variations, setVariations] = useState(2)
  const [imagenModel, setImagenModel] = useState<ImagenModel>('v2')
  // Multi-upload: every added file appends its own entry (never replaces
  // the previous ones), each with its own compress/upload lifecycle.
  const [attachments, setAttachments] = useState<StudioAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [generating, setGenerating] = useState(false)
  const [job, setJob] = useState<
    | { status: 'working'; label: string }
    | { status: 'error'; message: string }
    | null
  >(null)
  const [results, setResults] = useState<ImagineResult[]>([])
  // Live backend phase (V3: sending → generating → image), shown on the
  // loading cards instead of raw counters.
  const [v3phase, setV3Phase] = useState<string | null>(null)
  const busyRef = useRef(false)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Effective variations: locked to 1 as soon as a source image is
  // attached (the request becomes image-to-image / image-to-video).
  // Primary source = the most recently added ready image.
  const readyAttachments = attachments.filter(a => a.status === 'ready')
  const primaryAttachment =
    readyAttachments.length > 0
      ? readyAttachments[readyAttachments.length - 1]
      : null
  const variationsLocked = primaryAttachment !== null
  const effectiveVariations = variationsLocked ? 1 : variations
  // Send allowed with prompt text — or empty for auto-animate (attached
  // image + video mode, motion directive optional). Blocked while any
  // upload is still running.
  const canSend =
    !generating &&
    !attachments.some(a => a.status === 'uploading') &&
    (prompt.trim().length > 0 || (mode === 'video' && variationsLocked))
  // Card-modal flow only: when set, the generation starts automatically
  // as soon as the modal-picked photo finishes uploading (single-shot).
  const autoStartRef = useRef<{
    prompt: string
    mode: StudioMode
    attachmentId: string
  } | null>(null)

  // Stop any pending video poll on unmount.
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [])

  // Lock background scroll while an overlay is open (editor, preset
  // preview, or the video player dialog which signals via its hidden
  // attribute) so wheel/touch never scrolls the page behind them.
  // NOTE: the real scroller is the studio container below (the app shell
  // is position:fixed, body itself never scrolls) — lock them both.
  const scrollRootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const sync = () => {
      const videoOpen = !!document.querySelector(
        '[data-media-01-player]:not([hidden])'
      )
      const locked = editing !== null || preview !== null || videoOpen
      document.body.style.overflow = locked ? 'hidden' : ''
      if (scrollRootRef.current) {
        scrollRootRef.current.style.overflow = locked ? 'hidden' : ''
      }
    }
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['hidden', 'class']
    })
    return () => {
      obs.disconnect()
      document.body.style.overflow = ''
      if (scrollRootRef.current) {
        scrollRootRef.current.style.overflow = ''
      }
    }
  }, [editing, preview])

  const cycleAspectRatio = () => {
    setAspectRatio(
      prev =>
        ASPECT_RATIOS[(ASPECT_RATIOS.indexOf(prev) + 1) % ASPECT_RATIOS.length]
    )
  }

  const withStyle = (text: string, styleOverride: string | null) =>
    styleOverride ? `${text} (${styleOverride} style)` : text

  // POST helper for our imagine routes: single automatic retry on
  // NETWORK failures only (never on HTTP errors), and only when the
  // failure happens fast (<20s — the server can't have finished, so no
  // duplicate generation risk). Mobile networks drop mid-request often;
  // one transparent retry fixes most of those.
  const fetchImagineApi = async (
    path: string,
    body: unknown,
    timeoutMs = 70000
  ): Promise<Response> => {
    let lastErr: unknown = null
    for (let attempt = 0; attempt <= 1; attempt++) {
      const started = Date.now()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const res = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal
        })
        clearTimeout(timeout)
        return res
      } catch (err) {
        clearTimeout(timeout)
        lastErr = err
        const transient =
          err instanceof DOMException
            ? err.name === 'AbortError'
            : err instanceof TypeError
        const fast = Date.now() - started < 20000
        if (!transient || !fast || attempt >= 1) throw err
        await new Promise(r => setTimeout(r, 2000))
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Échec réseau.')
  }

  // Watermark removal + logo via our clean proxy, returned as a session
  // blob URL (browser-local, no ImageKit). Throws on failure so callers
  // can fall back to the raw fbcdn URL.
  const cleanToBlobUrl = async (fbcdnUrl: string): Promise<string> => {
    const res = await fetchImagineApi('/api/imagine/images/clean', {
      image_url: fbcdnUrl
    })
    if (!res.ok) throw new Error('Nettoyage impossible.')
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  }

  // Hard input cap (OOM safety only): the compressor below shrinks
  // everything else to a sub-Mo payload, so big phone photos are welcome.
  const MAX_IMAGE_BYTES = 25 * 1024 * 1024

  const handleRemoveAttachment = (id: string) => {
    // A pending card-modal autostart dies with its photo.
    if (autoStartRef.current?.attachmentId === id) autoStartRef.current = null
    setAttachments(prev => {
      const target = prev.find(a => a.id === id)
      if (target?.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl)
      }
      return prev.filter(a => a.id !== id)
    })
  }

  const newAttachmentId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.floor(Math.random() * 1e6)}`

  const clearAttachments = () => {
    setAttachments(prev => {
      for (const a of prev) {
        if (a.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(a.previewUrl)
        }
      }
      return []
    })
  }

  const handleAttachFile = async (file: File, existingId?: string) => {
    // Appends a new entry (multi-upload) — or refreshes the retried one.
    const id = existingId ?? newAttachmentId()
    const upsert = (entry: StudioAttachment) =>
      setAttachments(prev => {
        const i = prev.findIndex(a => a.id === id)
        if (i === -1) return [...prev, entry]
        const current = prev[i]
        if (
          current.previewUrl.startsWith('blob:') &&
          current.previewUrl !== entry.previewUrl
        ) {
          URL.revokeObjectURL(current.previewUrl)
        }
        const next = [...prev]
        next[i] = entry
        return next
      })
    const patch = (partial: Partial<StudioAttachment>) =>
      setAttachments(prev =>
        prev.map(a => (a.id === id ? { ...a, ...partial } : a))
      )
    if (!file.type.startsWith('image/')) {
      upsert({
        id,
        name: file.name,
        previewUrl: '',
        status: 'error',
        error: 'Image uniquement.'
      })
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      upsert({
        id,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        status: 'error',
        error: 'Image trop lourde (max 25 Mo).',
        file
      })
      return
    }
    upsert({
      id,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      status: 'uploading',
      stage: 'compress',
      file
    })
    // V2 upsell: adding a second source image while on the V2 model →
    // offer the switch to V3 once per session (uploads continue anyway).
    if (
      !existingId &&
      imagenModel === 'v2' &&
      attachments.length >= 1 &&
      !v2UpsellShownRef.current
    ) {
      v2UpsellShownRef.current = true
      setV2UpsellOpen(true)
    }
    try {
      const pressed = await compressImageForUpload(file)
      patch({ stage: 'upload' })
      const res = await fetchImagineApi('/api/imagine/upload', {
        imageBase64: pressed.base64,
        filename: file.name
      })
      const json = (await res.json().catch(() => null)) as {
        sourceImageEntId?: string
        mediaEntId?: string
        imageUrl?: string
        allMediaEntIds?: Array<{ accountIndex: number; mediaEntId: string }>
        error?: string
      } | null
      if (
        !res.ok ||
        !json?.sourceImageEntId ||
        !json?.mediaEntId ||
        !json?.imageUrl
      ) {
        throw new Error(
          json?.error ||
            (res.status === 413
              ? 'Image trop lourde pour l’envoi.'
              : `L'envoi a échoué (${res.status}).`)
        )
      }
      patch({
        status: 'ready',
        ent: {
          sourceImageEntId: json.sourceImageEntId,
          mediaEntId: json.mediaEntId,
          imageUrl: json.imageUrl,
          allMediaEntIds: json.allMediaEntIds ?? []
        }
      })
      // Card-modal flow only: the picked photo is fully imported →
      // start the generation automatically (single-shot).
      const pending = autoStartRef.current
      if (pending && pending.attachmentId === id) {
        autoStartRef.current = null
        void runGeneration({
          mode: pending.mode,
          prompt: pending.prompt,
          aspectRatio,
          resolution,
          style: null
        })
      }
    } catch (err) {
      const isHeic =
        file.type === 'image/heic' ||
        file.type === 'image/heif' ||
        /\.hei[cf]$/i.test(file.name)
      const message =
        err instanceof DOMException && err.name === 'AbortError'
          ? 'Délai dépassé, réessaie.'
          : isHeic &&
              err instanceof Error &&
              /lecture impossible/i.test(err.message)
            ? 'Format HEIC non pris en charge ici.'
            : err instanceof Error
              ? err.message
              : "L'envoi a échoué."
      if (autoStartRef.current?.attachmentId === id) {
        autoStartRef.current = null
      }
      patch({ status: 'error', error: message })
    }
  }

  const runGeneration = async (params: {
    mode: StudioMode
    prompt: string
    aspectRatio: AspectRatio
    resolution: VideoResolution
    style: string | null
    variations?: number
  }) => {
    const text = params.prompt.trim()
    // Primary source = the most recently added ready image.
    const ent = primaryAttachment?.ent ?? null
    const count = ent
      ? 1
      : typeof params.variations === 'number' &&
          params.variations >= 1 &&
          params.variations <= 4
        ? params.variations
        : variations
    if ((!text && !(ent && params.mode === 'video')) || busyRef.current) return
    // An attached image that isn't ready must block the send explicitly —
    // silently falling back to text-only generation would answer the wrong
    // request. The error surfaces in the Découvrir view.
    const pendingAttachment = attachments.find(a => a.status !== 'ready')
    if (pendingAttachment) {
      setView('discover')
      setExpectedCount(count)
      setJob({
        status: 'error',
        message:
          pendingAttachment.status === 'uploading'
            ? "Attends la fin de l'envoi des images."
            : "Une image n'est pas prête — réessaie l'envoi ou retire-la."
      })
      return
    }
    // Fresh composer right after sending (chat-like): prompt text and
    // sources were captured above, so clearing state here is safe.
    setPrompt('')
    clearAttachments()
    // External handler (embedding) takes over entirely when provided.
    if (onGenerate) {
      onGenerate({
        ...params,
        prompt: text,
        duration,
        variations: count,
        sourceImageEntId: ent?.sourceImageEntId ?? null,
        imagenModel
      })
      return
    }
    // Swap to the Découvrir view with its loading cards (animated).
    setView('discover')
    setExpectedCount(count)
    busyRef.current = true
    setGenerating(true)
    setJob(null)
    setV3Phase(null)
    // V3 (metaai async) job polling: 2.5s cadence, live phase in the
    // status label, collects image URLs across jobs.
    const pollV3Jobs = async (
      jobIds: string[],
      expected: number
    ): Promise<string[]> => {
      const pending = new Set(jobIds)
      const found: string[] = []
      let attempt = 0
      while (pending.size > 0) {
        attempt += 1
        if (attempt > 60) throw new Error('Délai dépassé, réessaie.')
        const settled = await Promise.all(
          [...pending].map(async id => {
            try {
              const r = await fetchImagineApi('/api/imagine/v3/images/poll', {
                jobId: id
              })
              const j = (await r.json().catch(() => null)) as {
                success?: boolean
                status?: string
                imageUrls?: string[]
                phase?: string
                error?: string
              } | null
              return { id, ok: r.ok, j }
            } catch {
              return { id, ok: false, j: null }
            }
          })
        )
        for (const { id, ok, j } of settled) {
          if (!ok || !j?.success) continue
          const st = (j.status ?? '').toLowerCase()
          if (st === 'done') {
            pending.delete(id)
            for (const u of j.imageUrls ?? []) {
              if (typeof u === 'string' && u.length > 0 && !found.includes(u)) {
                found.push(u)
              }
            }
          } else if (st === 'failed' || st === 'error') {
            pending.delete(id)
          } else if (j.phase) {
            const human = humanizeV3Phase(j.phase)
            setV3Phase(human)
            setJob({
              status: 'working',
              label: human ? `Génération V3… ${human}` : 'Génération V3…'
            })
          }
        }
        if (pending.size > 0) {
          await new Promise<void>(resolve => {
            pollTimerRef.current = setTimeout(() => resolve(), 2500)
          })
        }
      }
      return found.slice(0, expected)
    }
    try {
      const fullPrompt = withStyle(text, params.style)
      // Attached source image → image-to-image edit (auto-enhanced
      // server-side) or image-to-video animate. Variations locked to 1.
      if (ent && params.mode === 'image') {
        if (imagenModel === 'v3') {
          // Multi-image fusion: every ready source is forwarded (the
          // MetaAI endpoint accepts 1–8 reference images).
          const imageUrls = readyAttachments
            .map(a => a.ent?.imageUrl)
            .filter((u): u is string => typeof u === 'string' && u.length > 0)
            .slice(0, 8)
          setJob({
            status: 'working',
            label:
              imageUrls.length > 1
                ? `Édition V3 (${imageUrls.length} images)…`
                : 'Édition V3…'
          })
          const startRes = await fetchImagineApi(
            '/api/imagine/v3/images/edit',
            {
              imageUrls,
              prompt: buildV3Prompt(fullPrompt, 1, params.aspectRatio)
            }
          )
          const startJson = (await startRes.json().catch(() => null)) as {
            jobId?: string
            error?: string
          } | null
          if (!startRes.ok || !startJson?.jobId) {
            throw new Error(startJson?.error || "L'édition a échoué.")
          }
          const urls = await pollV3Jobs([startJson.jobId], 1)
          if (urls.length === 0) throw new Error('Aucune image générée.')
          setResults(prev => [
            ...urls.map(url => ({
              kind: 'image' as const,
              url,
              prompt: text,
              temporary: true
            })),
            ...prev
          ])
          setJob(null)
          return
        }
        setJob({ status: 'working', label: 'Édition de l’image…' })
        const res = await fetchImagineApi('/api/imagine/images/edit', {
          sourceImageEntId: ent.sourceImageEntId,
          editPrompt: fullPrompt,
          allMediaEntIds: ent.allMediaEntIds
        })
        const json = (await res.json().catch(() => null)) as {
          contentItem?: { imageUrl: string }
          usedPrompt?: string
          fallback?: boolean
          error?: string
        } | null
        if (!res.ok || !json?.contentItem?.imageUrl) {
          throw new Error(json?.error || "L'édition a échoué.")
        }
        setJob({ status: 'working', label: 'Nettoyage…' })
        let editUrl = json.contentItem.imageUrl
        let editTemporary = true
        try {
          editUrl = await cleanToBlobUrl(json.contentItem.imageUrl)
          editTemporary = false
        } catch {
          // Fallback: raw fbcdn URL stays visible (~1h).
        }
        setResults(prev => [
          {
            kind: 'image' as const,
            url: editUrl,
            prompt: json.usedPrompt || text,
            temporary: editTemporary,
            enhanced: json.fallback === false
          },
          ...prev
        ])
        setJob(null)
        return
      }
      // Batch starter (text-to-x or animate): returns a batchId, then poll.
      let batchId: string
      if (ent) {
        setJob({ status: 'working', label: 'Animation de l’image…' })
        const res = await fetchImagineApi('/api/imagine/videos/animate', {
          source: {
            id: ent.mediaEntId,
            imageUrl: ent.imageUrl,
            mediaEntId: ent.mediaEntId
          },
          ...(text ? { motion: fullPrompt } : {})
        })
        const json = (await res.json().catch(() => null)) as {
          batchId?: string
          error?: string
        } | null
        if (!res.ok || !json?.batchId) {
          throw new Error(json?.error || "L'animation a échoué.")
        }
        batchId = json.batchId
      } else if (params.mode === 'image') {
        if (imagenModel === 'v3') {
          setJob({ status: 'working', label: 'Démarrage V3…' })
          const startRes = await fetchImagineApi('/api/imagine/v3/images', {
            prompt: buildV3Prompt(fullPrompt, count, params.aspectRatio),
            variations: count,
            aspectRatio: params.aspectRatio
          })
          const startJson = (await startRes.json().catch(() => null)) as {
            jobs?: string[]
            error?: string
          } | null
          if (!startRes.ok || !startJson?.jobs?.length) {
            throw new Error(startJson?.error || 'La génération a échoué.')
          }
          const urls = await pollV3Jobs(startJson.jobs, count)
          if (urls.length === 0) throw new Error('Aucune image générée.')
          setResults(prev => [
            ...urls.map(url => ({
              kind: 'image' as const,
              url,
              prompt: text,
              temporary: true
            })),
            ...prev
          ])
          setJob(null)
          return
        }
        setJob({ status: 'working', label: 'Génération de l’image…' })
        const res = await fetchImagineApi('/api/imagine/images', {
          prompt: fullPrompt,
          aspectRatio: params.aspectRatio,
          variations: count
        })
        const json = (await res.json().catch(() => null)) as {
          data?: Array<{ url: string }>
          error?: string
        } | null
        if (!res.ok || !json?.data?.length) {
          throw new Error(json?.error || 'La génération a échoué.')
        }
        setJob({ status: 'working', label: 'Nettoyage…' })
        const cleaned = await Promise.all(
          json.data!.map(async d => {
            try {
              return {
                url: await cleanToBlobUrl(d.url),
                temporary: false
              }
            } catch {
              // Fallback: raw fbcdn URL stays visible (~1h).
              return { url: d.url, temporary: true }
            }
          })
        )
        setResults(prev => [
          ...cleaned.map(c => ({
            kind: 'image' as const,
            url: c.url,
            prompt: text,
            temporary: c.temporary
          })),
          ...prev
        ])
        setJob(null)
        return
      } else {
        setJob({ status: 'working', label: 'Démarrage de la vidéo…' })
        const res = await fetchImagineApi('/api/imagine/videos', {
          prompt: fullPrompt,
          aspectRatio: params.aspectRatio,
          resolution: params.resolution,
          variations: count
        })
        const json = (await res.json().catch(() => null)) as {
          batchId?: string
          error?: string
        } | null
        if (!res.ok || !json?.batchId) {
          throw new Error(json?.error || 'La génération a échoué.')
        }
        batchId = json.batchId
      }
      {
        // Poll every 5s (backend timeout=5s) until enough videoUrls land.
        let attempt = 0
        const poll = async (): Promise<void> => {
          attempt += 1
          if (attempt > 60) throw new Error('Délai dépassé, réessaie.')
          setJob({
            status: 'working',
            label: 'Génération vidéo…'
          })
          let content: Array<{ videoUrl?: string | null }> = []
          let batchComplete = false
          try {
            const pollRes = await fetchImagineApi(
              '/api/imagine/videos/poll',
              { batchId },
              30000
            )
            const pollJson = (await pollRes.json().catch(() => null)) as {
              batch?: {
                isComplete?: boolean
                content?: Array<{ videoUrl?: string | null }>
              }
              error?: string
            } | null
            if (!pollRes.ok || !pollJson?.batch) {
              throw new Error(pollJson?.error || 'Le suivi a échoué.')
            }
            content = pollJson.batch.content ?? []
            batchComplete = pollJson.batch.isComplete === true
          } catch (err) {
            // Transient network blip mid-poll: skip this round and try
            // the next one instead of killing the whole generation.
            const transient =
              err instanceof DOMException
                ? err.name === 'AbortError'
                : err instanceof TypeError
            if (!transient) throw err
          }
          const urls = [
            ...new Set(
              content.flatMap(c =>
                typeof c.videoUrl === 'string' && c.videoUrl.length > 0
                  ? [c.videoUrl]
                  : []
              )
            )
          ]
          if (urls.length >= count || batchComplete) {
            if (urls.length === 0) throw new Error('Aucune vidéo générée.')
            setResults(prev => [
              ...urls.slice(0, count).map(
                (url): ImagineResult => ({
                  kind: 'video',
                  url,
                  prompt: text,
                  temporary: true
                })
              ),
              ...prev
            ])
            setJob(null)
            return
          }
          await new Promise<void>(resolve => {
            pollTimerRef.current = setTimeout(() => resolve(), 5000)
          })
          return poll()
        }
        await poll()
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Échec de génération.'
      // fetch() TypeError ("Failed to fetch") = connection dropped,
      // typically our serverless function hitting its time limit while
      // the backend was still working — retrying usually succeeds.
      const message =
        err instanceof TypeError || /failed to fetch|networkerror/i.test(raw)
          ? 'Connexion interrompue (serveur trop lent), réessaie.'
          : raw
      setJob({ status: 'error', message })
    } finally {
      busyRef.current = false
      setGenerating(false)
      setV3Phase(null)
    }
  }

  const handleGenerate = () => {
    void runGeneration({ mode, prompt, aspectRatio, resolution, style: null })
  }
  const extras: ComposerExtras = {
    variations,
    setVariations,
    variationsLocked,
    attachmentBar: (
      <AttachmentBar
        attachments={attachments}
        onRemove={handleRemoveAttachment}
        onRetry={id => {
          const file = attachments.find(a => a.id === id)?.file
          if (file) void handleAttachFile(file, id)
        }}
      />
    ),
    // Android: dedicated photo-picker-eligible input (system gallery);
    // desktop/iOS: existing hidden input (native behavior unchanged).
    onAttach: () => {
      if (isAndroidDevice()) {
        void pickSingleImageViaPhotoPicker().then(file => {
          // null = user cancelled: nothing to do.
          if (file) void handleAttachFile(file)
        })
        return
      }
      fileInputRef.current?.click()
    },
    canSend
  }

  return (
    <div
      ref={scrollRootRef}
      className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-y-auto bg-[#faf9f7] [font-family:Arial,sans-serif] dark:bg-background"
    >
      <div key={view} className="discover-view flex min-h-full w-full flex-col">
        {view === 'discover' ? (
          <DiscoverView
            onBack={() => setView('create')}
            onRetry={handleGenerate}
            onEditResult={r => setEditing(r)}
            results={results}
            expected={expectedCount}
            working={generating}
            status={job?.status === 'working' ? job.label : null}
            error={job?.status === 'error' ? job.message : null}
            phase={v3phase}
            composer={
              <>
                {v3BannerVisible && (
                  <div className="mx-auto mb-2 w-full max-w-[750px] px-4">
                    <V3ActivatedBanner
                      onClose={() => setV3BannerVisible(false)}
                    />
                  </div>
                )}
                <DiscoverComposer
                  prompt={prompt}
                  setPrompt={setPrompt}
                  mode={mode}
                  setMode={setMode}
                  aspectRatio={aspectRatio}
                  cycleAspectRatio={cycleAspectRatio}
                  resolution={resolution}
                  setResolution={setResolution}
                  duration={duration}
                  setDuration={setDuration}
                  generating={generating}
                  onGenerate={handleGenerate}
                  extras={extras}
                  imagenModel={imagenModel}
                  setImagenModel={setImagenModel}
                />
              </>
            }
          />
        ) : (
          <div className="mx-auto flex w-full max-w-[752px] flex-col items-center px-4 pt-20 pb-16 md:pt-[100px]">
            <h1 className="imagine-title-shine text-center text-[25px] font-bold leading-[31px] md:text-[26px]">
              Que voulez-vous créer aujourd&apos;hui ?
            </h1>

            {/* Prompt composer */}
            {v3BannerVisible && (
              <div className="mt-[20px] w-full">
                <V3ActivatedBanner onClose={() => setV3BannerVisible(false)} />
              </div>
            )}
            <div className="mt-[34px] w-full overflow-hidden rounded-[22px] border border-[#e3e3e3] bg-white dark:border-border dark:bg-card">
              {extras.attachmentBar}
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleGenerate()
                  }
                }}
                placeholder="Décrivez ce que vous imaginez"
                rows={1}
                className="min-h-[48px] w-full resize-none bg-transparent px-[19px] pt-[16px] text-[16px] leading-[22px] text-[#111] outline-none placeholder:text-[#707070] dark:text-foreground"
              />

              {/* Bottom toolbar — same composer, controls swap per mode.
              Single scrollable row on mobile (compact, app-like), wrapping
              row on desktop per the reference layout. */}
              <div className="no-scrollbar flex flex-nowrap items-center gap-2 overflow-x-auto px-[15px] pt-[6px] pb-[11px] md:flex-wrap md:gap-3 md:overflow-visible md:px-[19px]">
                {/* Plus */}
                <ToolbarIconButton
                  label="Ajouter"
                  className="-ml-2"
                  onClick={extras.onAttach}
                >
                  <IconPlus size={20} strokeWidth={2} />
                </ToolbarIconButton>

                {mode === 'image' ? (
                  <>
                    {/* Active Image mode */}
                    <ModeCapsule
                      active
                      label="Image"
                      icon={<IconPhoto size={15} />}
                    />
                    {/* Switch to video mode */}
                    <ToolbarIconButton
                      label="Mode vidéo"
                      onClick={() => setMode('video')}
                    >
                      <IconVideo size={20} />
                    </ToolbarIconButton>
                    {/* Secondary media control */}
                    <ToolbarIconButton label="Médias">
                      <IconLayoutGrid size={19} />
                    </ToolbarIconButton>
                    <ImagenModelSelect
                      value={imagenModel}
                      onChange={setImagenModel}
                    />
                  </>
                ) : (
                  <>
                    {/* Back to image mode (icon only) */}
                    <ToolbarIconButton
                      label="Mode image"
                      onClick={() => setMode('image')}
                    >
                      <IconPhoto size={20} />
                    </ToolbarIconButton>
                    {/* Active Video mode */}
                    <ModeCapsule
                      active
                      wide
                      label="Vidéo"
                      icon={
                        <IconVideo
                          size={16}
                          className="text-black dark:text-foreground"
                        />
                      }
                    />
                    {/* Secondary media control */}
                    <ToolbarIconButton label="Médias">
                      <IconLayoutGrid size={19} />
                    </ToolbarIconButton>
                    <VideoOmniChip />
                    {/* Resolution selector — desktop: in toolbar /
                    mobile: below the composer (see below) */}
                    <div className="hidden md:contents">
                      <SegmentedControl
                        options={VIDEO_RESOLUTIONS}
                        value={resolution}
                        onChange={setResolution}
                      />
                    </div>
                    {/* Duration selector (10s coming soon) — desktop: in
                    toolbar / mobile: below the composer (see below) */}
                    <div className="hidden md:contents">
                      <SegmentedControl
                        options={VIDEO_DURATIONS}
                        value={duration}
                        onChange={setDuration}
                        disabledValues={['10s']}
                        disabledHint="Bientôt disponible"
                      />
                    </div>
                    {/* Sound (audio coming soon — stays disabled) */}
                    <ToolbarIconButton label="Audio (bientôt disponible)">
                      <IconVolumeOff size={18} />
                    </ToolbarIconButton>
                  </>
                )}

                {/* Aspect ratio (click cycles 1:1 → 16:9 → 9:16).
                    Hidden in edit/animate mode — the source image decides. */}
                {!extras.variationsLocked && (
                  <button
                    type="button"
                    onClick={cycleAspectRatio}
                    title="Format d'image"
                    className="flex h-[39px] w-[63px] shrink-0 items-center justify-center gap-1.5 rounded-[20px] bg-neutral-100 text-[14px] text-[#111] transition-colors hover:bg-neutral-200/70 dark:bg-muted dark:text-foreground dark:hover:bg-white/10"
                  >
                    <IconRectangleVertical size={14} />
                    {aspectRatio}
                  </button>
                )}
                <VariationsSelect
                  value={extras.variationsLocked ? 1 : extras.variations}
                  onChange={extras.setVariations}
                  locked={extras.variationsLocked}
                />

                {/* Generate, pinned right (stays visible while the
                toolbar row scrolls on mobile) */}
                <div className="sticky right-0 ml-auto flex shrink-0 items-center gap-1 bg-white pl-1 dark:bg-card">
                  <button
                    type="button"
                    onClick={handleGenerate}
                    aria-label="Générer"
                    title="Générer"
                    disabled={!extras.canSend}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black text-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 dark:bg-white dark:text-black"
                  >
                    {generating ? (
                      <IconLoader2 size={18} className="animate-spin" />
                    ) : (
                      <ArrowUp size={18} strokeWidth={2.5} />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Video settings below the composer — mobile only
            (desktop keeps them inside the toolbar), hidden on Android
            (model switching there goes through the V2 upsell) */}
            {mode === 'video' && !isAndroidDevice() && (
              <div className="mt-3 flex w-full flex-wrap items-center justify-center gap-2 md:hidden">
                <VideoOmniChip />
                <SegmentedControl
                  options={VIDEO_RESOLUTIONS}
                  value={resolution}
                  onChange={setResolution}
                />
                <SegmentedControl
                  options={VIDEO_DURATIONS}
                  value={duration}
                  onChange={setDuration}
                  disabledValues={['10s']}
                  disabledHint="Bientôt disponible"
                />
              </div>
            )}
            {mode === 'image' && !isAndroidDevice() && (
              <div className="mt-3 flex w-full flex-wrap items-center justify-center gap-2 md:hidden">
                <ImagenModelSelect
                  value={imagenModel}
                  onChange={setImagenModel}
                />
              </div>
            )}

            {/* Official presets (mixed photos + videos): below the composer
            on desktop, below the resolution/duration selectors on mobile
            (both sit above this block). The grid never changes with the
            mode — selecting a card switches to its mode. */}
            <div className="mt-8 w-full">
              <StylePresetGrid
                presets={OFFICIAL_PRESETS_MIXED}
                activePrompt={prompt}
                onSelect={preset => {
                  setMode(preset.kind === 'video' ? 'video' : 'image')
                  setPreview(preset)
                }}
                expanded={expanded}
                onToggle={() => setExpanded(prev => !prev)}
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              // Visually hidden but RENDERED (never display:none): on
              // Android Chrome a display:none input opened by code falls
              // back to the Files manager instead of the gallery picker.
              className="pointer-events-none absolute h-px w-px opacity-0"
              aria-hidden
              tabIndex={-1}
              onChange={e => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void handleAttachFile(file)
              }}
            />
          </div>
        )}
        {editing?.kind === 'image' && (
          <ImageEditor
            key={editing.url}
            src={editing.url}
            title={editing.prompt}
            onClose={() => setEditing(null)}
            onSave={blob => {
              const url = URL.createObjectURL(blob)
              setResults(prev => [
                {
                  kind: 'image',
                  url,
                  prompt: `${editing.prompt} (édité)`
                },
                ...prev
              ])
              setEditing(null)
            }}
          />
        )}
        {preview && (
          <StylePreviewCard
            preset={preview}
            onSelectPhoto={file => {
              // Edit-card flow only: the picked photo becomes the source,
              // the composer is filled with the card's prompt + mode, and
              // the generation starts automatically once the photo is
              // fully imported (single-shot autostart).
              const presetMode = preview.kind === 'video' ? 'video' : 'image'
              setMode(presetMode)
              setPrompt(preview.prompt)
              setPreview(null)
              const attachmentId = newAttachmentId()
              autoStartRef.current = {
                prompt: preview.prompt,
                mode: presetMode,
                attachmentId
              }
              void handleAttachFile(file, attachmentId)
            }}
            onSend={() => {
              // Image/video-gen cards: no source photo — send directly.
              const presetMode = preview.kind === 'video' ? 'video' : 'image'
              const presetPrompt = preview.prompt
              setMode(presetMode)
              setPrompt(presetPrompt)
              setPreview(null)
              void runGeneration({
                mode: presetMode,
                prompt: presetPrompt,
                aspectRatio,
                resolution,
                style: null
              })
            }}
            onClose={() => setPreview(null)}
          />
        )}
        {v2UpsellOpen && (
          <V2UpsellModal
            onStay={() => setV2UpsellOpen(false)}
            onSwitch={() => {
              setImagenModel('v3')
              setV2UpsellOpen(false)
              setV3BannerVisible(true)
            }}
          />
        )}
      </div>
    </div>
  )
}
