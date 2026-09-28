'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface NewModelModalProps {
  modelId: string
  modelName: string
  modelDescription: string
  modelImage: string
  badge: string
  features: string[]
  maxReferenceImages: number
  buttonText: string
  onTryNow: () => void
  onClose: () => void
}

/**
 * Reusable "New Model" announcement modal (premium SaaS style): visual
 * left, pitch right, single CTA. Data-driven — announcing another model
 * later only needs a new registry entry (lib/imagine/new-models.ts).
 * Portaled to document.body so ancestor transforms/filters can never
 * offset its viewport centering.
 */
export function NewModelModal({
  modelId,
  modelName,
  modelDescription,
  modelImage,
  badge,
  features,
  maxReferenceImages,
  buttonText,
  onTryNow,
  onClose
}: NewModelModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Nouveau modèle ${modelName}`}
      data-model-id={modelId}
      onClick={onClose}
      className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-black/55 backdrop-blur-md"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          onClick={e => e.stopPropagation()}
          className="grid w-[820px] max-w-full overflow-hidden rounded-[16px] bg-white text-neutral-900 shadow-[0_32px_100px_rgba(0,0,0,0.5)] md:grid-cols-[45%_55%]"
        >
          {/* Left visual: model artwork, cover, name inside the image. */}
          <div className="relative h-52 overflow-hidden md:h-auto md:min-h-[460px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={modelImage}
              alt={modelName}
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-black/70 via-black/25 to-transparent"
            />
            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-300">
                New model
              </p>
              <p className="mt-1 text-[20px] font-bold leading-tight text-white">
                {modelName}
              </p>
            </div>
          </div>
          {/* Right content: badge, title, pitch, features, CTA. */}
          <div className="relative flex flex-col p-6 md:max-h-[calc(100dvh-4rem)] md:overflow-y-auto md:p-8">
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="absolute right-4 top-4 rounded-full p-1.5 text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-800"
            >
              <X size={18} strokeWidth={2} />
            </button>
            <span className="inline-flex w-fit items-center rounded-md border border-sky-500/40 bg-white px-2 py-0.5 text-[12px] font-semibold text-sky-600">
              {badge}
            </span>
            <h2 className="mt-3 text-[21px] font-bold leading-tight">
              {modelName}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-neutral-600">
              {modelDescription}
            </p>
            <ul className="mt-4 space-y-2">
              {features.map(feature => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-[14px] leading-[1.45] text-neutral-700"
                >
                  <span
                    aria-hidden
                    className="mt-[7px] size-1.5 shrink-0 rounded-full bg-neutral-400"
                  />
                  <span
                    className={cn(
                      /8 images de référence/.test(feature) &&
                        'font-semibold text-sky-700'
                    )}
                  >
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-[10px] bg-sky-500/10 px-3 py-2 text-[13px] font-semibold leading-snug text-sky-700">
              Jusqu’à {maxReferenceImages} images de référence
            </p>
            <button
              type="button"
              onClick={onTryNow}
              className="mt-4 h-[40px] w-full shrink-0 rounded-[8px] bg-black text-[15px] font-semibold text-white transition-colors duration-200 hover:bg-neutral-800"
            >
              {buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
