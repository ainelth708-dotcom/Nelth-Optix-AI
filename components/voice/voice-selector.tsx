'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, Mic2 } from 'lucide-react'
import { REALTIME_VOICES, type RealtimeVoice } from '@/lib/voice/realtime-voices'
import { cn } from '@/lib/utils'

interface VoiceSelectorProps {
  selectedVoice: string
  onSelectVoice: (voiceId: string) => void
  disabled?: boolean
  className?: string
}

export function VoiceSelector({
  selectedVoice,
  onSelectVoice,
  disabled = false,
  className
}: VoiceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const activeVoice: RealtimeVoice =
    REALTIME_VOICES.find(v => v.id === selectedVoice) || REALTIME_VOICES[0]

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div ref={menuRef} className={cn('relative inline-block text-left', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          'flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border/70',
          'bg-background/80 hover:bg-muted/80 backdrop-blur-md text-xs font-medium text-foreground',
          'transition-all duration-150 shadow-sm active:scale-95',
          disabled && 'opacity-60 cursor-not-allowed',
          isOpen && 'border-primary/50 ring-2 ring-primary/20'
        )}
      >
        <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
        <Mic2 className="size-3.5 text-muted-foreground" />
        <span>Voix : <strong className="font-semibold text-foreground">{activeVoice.name}</strong></span>
        <ChevronDown
          className={cn(
            'size-3.5 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Sélectionner une voix"
          className={cn(
            'absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 sm:w-80',
            'rounded-2xl border border-border/80 bg-popover/95 p-1.5 shadow-2xl backdrop-blur-xl',
            'z-50 animate-in fade-in-0 zoom-in-95 duration-150 max-h-80 overflow-y-auto'
          )}
        >
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40">
            Choisir la voix Realtime (9 voix)
          </div>

          <div className="py-1 space-y-0.5">
            {REALTIME_VOICES.map((voice) => {
              const isSelected = voice.id === selectedVoice
              return (
                <button
                  key={voice.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelectVoice(voice.id)
                    setIsOpen(false)
                  }}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left text-xs transition-colors',
                    isSelected
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-muted text-foreground'
                  )}
                >
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium capitalize">{voice.name}</span>
                      {voice.alias && (
                        <span className="text-[10px] text-muted-foreground">({voice.alias})</span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {voice.description}
                    </span>
                  </div>

                  {isSelected && (
                    <div className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shrink-0">
                      <Check className="size-3 stroke-[2.5]" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
