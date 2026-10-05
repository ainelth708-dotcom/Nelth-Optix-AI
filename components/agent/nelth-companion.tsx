'use client'

import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

export type CompanionState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'working'
  | 'browsing'
  | 'tool'
  | 'waiting'
  | 'approval'
  | 'success'
  | 'error'
  | 'sleeping'

/**
 * Nelth-IA companion: an ORIGINAL abstract "wisp" (soft rounded spark +
 * orbit ring, gradient core, two eyes). Pure SVG + CSS, no assets, no
 * WebGL. Every visual state maps 1:1 to the REAL agent/task state passed
 * via `state` — never random. Pauses offscreen + honors reduced motion.
 */
export function NelthCompanion({
  state = 'idle',
  size = 120,
  className
}: {
  state?: CompanionState
  size?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      entries => setVisible(entries.some(e => e.isIntersecting)),
      { threshold: 0.05 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      role="img"
      aria-label={`Compagnon Nelth-IA : ${state}`}
      data-companion={state}
      data-paused={!visible || undefined}
      className={cn('nelth-companion', className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 120 120" className="size-full" aria-hidden>
        <defs>
          <radialGradient id="nc-core" cx="50%" cy="38%" r="65%">
            <stop offset="0%" stopColor="#8DCCF5" />
            <stop offset="55%" stopColor="#4E8FD1" />
            <stop offset="100%" stopColor="#1E3A6E" />
          </radialGradient>
        </defs>
        <ellipse
          className="nc-halo"
          cx="60"
          cy="104"
          rx="26"
          ry="5"
          fill="currentColor"
          opacity="0.12"
        />
        <ellipse
          className="nc-orbit"
          cx="60"
          cy="58"
          rx="46"
          ry="46"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="10 14"
          opacity="0.35"
        />
        <path
          className="nc-body"
          d="M60 14 C84 14 100 34 100 60 C100 88 80 106 60 106 C40 106 20 88 20 60 C20 34 36 14 60 14 Z"
          fill="url(#nc-core)"
        />
        <g className="nc-eyes" fill="#fff">
          <ellipse className="nc-eye" cx="48" cy="58" rx="7.5" ry="9" />
          <ellipse className="nc-eye" cx="72" cy="58" rx="7.5" ry="9" />
        </g>
        <g className="nc-pupils" fill="#0B1526">
          <circle className="nc-pupil" cx="48" cy="60" r="3.4" />
          <circle className="nc-pupil" cx="72" cy="60" r="3.4" />
        </g>
      </svg>
    </div>
  )
}
