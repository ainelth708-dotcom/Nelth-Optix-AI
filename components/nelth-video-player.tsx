'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { IconLoader2 } from '@tabler/icons-react'
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X
} from 'lucide-react'

import { cn } from '@/lib/utils'

interface NelthVideoPlayerProps {
  src: string
  poster?: string
  dialogLabel?: string
  triggerClassName?: string
  children?: React.ReactNode
}

function fmtTime(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return '0:00'
  const m = Math.floor(totalSeconds / 60)
  const s = Math.floor(totalSeconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Nelth premium video player: card trigger + fullscreen dialog with
 * custom chrome (play/pause, scrubber, time, mute, fullscreen, close).
 * The dialog is portaled to document.body so ancestor transforms can
 * never offset it, and the video is always fully visible (contain,
 * centered, natural ratio). No external player dependency.
 */
export function NelthVideoPlayer({
  src,
  poster,
  dialogLabel = 'Lecture de la vidéo',
  triggerClassName,
  children
}: NelthVideoPlayerProps) {
  const [open, setOpen] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffering, setBuffering] = useState(true)
  const [showChrome, setShowChrome] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [ratio, setRatio] = useState<[number, number] | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const scrubRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openPlayer = () => {
    setPlaying(false)
    setMuted(false)
    setCurrentTime(0)
    setDuration(0)
    setBuffering(true)
    setShowChrome(true)
    setIsFullscreen(false)
    setRatio(null)
    setOpen(true)
  }

  // Autoplay on open (user gesture precedes it, so sound is allowed);
  // fall back to muted when the browser refuses.
  useEffect(() => {
    if (!open) return
    const v = videoRef.current
    if (!v) return
    v.muted = false
    void v.play().catch(() => {
      v.muted = true
      setMuted(true)
      void v.play().catch(() => {})
    })
  }, [open, src])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onFsChange = () => {
      setIsFullscreen(document.fullscreenElement != null)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFsChange)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [open])

  const pokeChrome = () => {
    setShowChrome(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setShowChrome(false), 2800)
  }

  // Paused (or ended) → chrome forced visible; while playing the
  // 2.8s timer (or pointer activity) hides it. Timer callbacks only —
  // never synchronous setState here.
  const chromeVisible = showChrome || !playing
  useEffect(() => {
    if (!open || !playing) {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      return
    }
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setShowChrome(false), 2800)
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [open, playing])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      void v.play().catch(() => {})
    } else {
      v.pause()
    }
  }

  const toggleMute = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }

  const toggleFullscreen = () => {
    const frame = frameRef.current
    if (!frame) return
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
    } else {
      void frame.requestFullscreen?.().catch(() => {})
    }
  }

  const seekFromClientX = (clientX: number) => {
    const bar = scrubRef.current
    const v = videoRef.current
    if (!bar || !v || !isFinite(v.duration) || v.duration <= 0) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    v.currentTime = ratio * v.duration
    setCurrentTime(v.currentTime)
  }

  const progress =
    duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={dialogLabel}
        onClick={openPlayer}
        className={triggerClassName}
      >
        {children}
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={dialogLabel}
              data-nelth-player-open=""
              onClick={() => setOpen(false)}
              onPointerMove={pokeChrome}
              className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-black/70 backdrop-blur-md"
            >
              <div className="flex min-h-full items-center justify-center p-4">
                <div
                  ref={frameRef}
                  onClick={e => e.stopPropagation()}
                  style={
                    ratio
                      ? {
                          aspectRatio: `${ratio[0]} / ${ratio[1]}`,
                          maxHeight: '80dvh'
                        }
                      : { minHeight: 240 }
                  }
                  className="relative w-full max-w-[920px] overflow-hidden rounded-2xl bg-black shadow-[0_32px_100px_rgba(0,0,0,0.6)]"
                >
                  <video
                    ref={videoRef}
                    src={src}
                    poster={poster}
                    playsInline
                    preload="auto"
                    onClick={togglePlay}
                    onPlay={() => {
                      setPlaying(true)
                      setBuffering(false)
                    }}
                    onPause={() => setPlaying(false)}
                    onTimeUpdate={e =>
                      setCurrentTime(e.currentTarget.currentTime)
                    }
                    onLoadedMetadata={e => {
                      const v = e.currentTarget
                      setDuration(isFinite(v.duration) ? v.duration : 0)
                      if (v.videoWidth && v.videoHeight) {
                        setRatio([v.videoWidth, v.videoHeight])
                      }
                    }}
                    onWaiting={() => setBuffering(true)}
                    onPlaying={() => setBuffering(false)}
                    onEnded={() => setPlaying(false)}
                    className="absolute inset-0 h-full w-full cursor-pointer object-contain object-center"
                  />
                  {/* Buffering spinner */}
                  {buffering && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <IconLoader2
                        size={34}
                        className="animate-spin text-white/85"
                      />
                    </span>
                  )}
                  {/* Big center play while paused */}
                  {!playing && !buffering && (
                    <button
                      type="button"
                      onClick={togglePlay}
                      aria-label="Lecture"
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <span className="flex size-16 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-transform hover:scale-105 active:scale-95">
                        <Play size={26} className="ml-1" fill="currentColor" />
                      </span>
                    </button>
                  )}
                  {/* Close — docked inside the frame (mobile-safe) */}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Fermer le lecteur"
                    className={cn(
                      'absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/80',
                      chromeVisible
                        ? 'translate-y-0 opacity-100'
                        : 'pointer-events-none -translate-y-1 opacity-0'
                    )}
                  >
                    <X size={17} strokeWidth={2} />
                  </button>
                  {/* Bottom chrome */}
                  <div
                    className={cn(
                      'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-4 pb-3 pt-8 transition-opacity duration-200',
                      chromeVisible
                        ? 'opacity-100'
                        : 'pointer-events-none opacity-0'
                    )}
                  >
                    <div
                      ref={scrubRef}
                      role="slider"
                      aria-label="Position de lecture"
                      aria-valuemin={0}
                      aria-valuemax={Math.round(duration)}
                      aria-valuenow={Math.round(currentTime)}
                      onPointerDown={e => {
                        scrubRef.current?.setPointerCapture(e.pointerId)
                        seekFromClientX(e.clientX)
                      }}
                      onPointerMove={e => {
                        if (e.buttons & 1) seekFromClientX(e.clientX)
                      }}
                      className="touch-none py-2"
                    >
                      <div className="relative h-1 overflow-hidden rounded-full bg-white/25">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-white"
                          style={{ width: `${progress * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={togglePlay}
                        aria-label={playing ? 'Pause' : 'Lecture'}
                        className="flex size-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
                      >
                        {playing ? (
                          <Pause size={18} fill="currentColor" />
                        ) : (
                          <Play
                            size={18}
                            className="ml-0.5"
                            fill="currentColor"
                          />
                        )}
                      </button>
                      <span className="ml-1 text-xs font-medium tabular-nums text-white/90">
                        {fmtTime(currentTime)} / {fmtTime(duration)}
                      </span>
                      <span className="flex-1" />
                      <button
                        type="button"
                        onClick={toggleMute}
                        aria-label={muted ? 'Activer le son' : 'Couper le son'}
                        className="flex size-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
                      >
                        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                      </button>
                      <button
                        type="button"
                        onClick={toggleFullscreen}
                        aria-label="Plein écran"
                        className="flex size-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
                      >
                        {isFullscreen ? (
                          <Minimize size={18} />
                        ) : (
                          <Maximize size={18} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
