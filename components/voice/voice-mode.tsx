'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, RefreshCw, X as XIcon } from 'lucide-react'
import type { OrbState } from 'orb-ui'
import { Orb } from 'orb-ui'

import type { UIMessage } from '@/lib/types/ai'
import { cn } from '@/lib/utils'
import {
  getSavedRealtimeVoice,
  REALTIME_VOICES,
  saveRealtimeVoice
} from '@/lib/voice/realtime-voices'

import { useI18n } from '../i18n-provider'

import { useRealtimeVoice } from './use-realtime-voice'
import { VoiceSelector } from './voice-selector'

const EXIT_MS = 240

export interface VoiceModeProps {
  onClose: () => void
  onSubmitText: (text: string) => void
  messages: UIMessage[]
  status: 'submitted' | 'streaming' | 'ready' | 'error'
  locale: string
}

export function VoiceMode({
  onClose,
  onSubmitText: _onSubmitText,
  messages: _messages,
  status: _status,
  locale: _locale
}: VoiceModeProps) {
  const { t } = useI18n()
  const [leaving, setLeaving] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState<string>(() =>
    getSavedRealtimeVoice()
  )
  const closingRef = useRef(false)

  const {
    status: realtimeStatus,
    errorMessage,
    isMuted,
    micLevel,
    assistantLevel,
    isAssistantSpeaking,
    connect,
    disconnect,
    toggleMute
  } = useRealtimeVoice({
    voice: selectedVoice
  })

  // Start Realtime connection on mount
  useEffect(() => {
    connect(selectedVoice)
    return () => {
      disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle voice selection change
  const handleSelectVoice = useCallback(
    (newVoiceId: string) => {
      setSelectedVoice(newVoiceId)
      saveRealtimeVoice(newVoiceId)
      // Reconnect with new voice
      connect(newVoiceId)
    },
    [connect]
  )

  const handleClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    disconnect()
    setLeaving(true)
    window.setTimeout(onClose, EXIT_MS)
  }, [disconnect, onClose])

  // Escape key closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [handleClose])

  // Determine Orb visual state
  const orbState: OrbState =
    realtimeStatus === 'connecting' ||
    realtimeStatus === 'requesting-permission' ||
    realtimeStatus === 'reconnecting'
      ? 'connecting'
      : realtimeStatus === 'error'
        ? 'error'
        : isAssistantSpeaking
          ? 'speaking'
          : 'listening'

  // Determine dynamic volume for Orb animation
  const orbVolume =
    realtimeStatus === 'error'
      ? 0
      : isAssistantSpeaking
        ? Math.min(1, Math.max(0.2, assistantLevel * 3.5))
        : Math.min(1, Math.max(0.08, micLevel * 2.8))

  const activeVoiceObj =
    REALTIME_VOICES.find(v => v.id === selectedVoice) || REALTIME_VOICES[0]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('voice.title')}
      data-testid="voice-mode"
      className={cn(
        'fixed inset-0 z-[120] flex flex-col items-center justify-between bg-background/95 px-6 py-8 backdrop-blur-xl select-none',
        leaving ? 'nelth-voice-leave' : 'nelth-voice-enter'
      )}
    >
      {/* Header controls */}
      <div className="flex w-full max-w-2xl items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border backdrop-blur-md',
              realtimeStatus === 'connected'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                : realtimeStatus === 'error'
                  ? 'border-destructive/30 bg-destructive/10 text-destructive'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-500'
            )}
          >
            <span
              className={cn(
                'size-2 rounded-full',
                realtimeStatus === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : realtimeStatus === 'error'
                    ? 'bg-destructive'
                    : 'bg-amber-500 animate-ping'
              )}
            />
            <span>
              {realtimeStatus === 'connected'
                ? 'Direct WebRTC'
                : realtimeStatus === 'error'
                  ? 'Erreur'
                  : 'Connexion...'}
            </span>
          </div>

          <span className="hidden sm:inline text-xs text-muted-foreground">
            {activeVoiceObj.name} ({activeVoiceObj.tag})
          </span>
        </div>

        <button
          type="button"
          onClick={handleClose}
          aria-label={t('voice.close')}
          data-testid="voice-close"
          className="grid size-10 cursor-pointer place-items-center rounded-full border border-border bg-background/80 text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95 shadow-sm"
        >
          <XIcon className="size-5" />
        </button>
      </div>

      {/* Main Orb Center */}
      <div className="flex flex-col items-center justify-center gap-6 my-auto">
        <div className="relative">
          <Orb
            state={orbState}
            volume={orbVolume}
            theme="cloud"
            interactive={false}
            aria-label={t('voice.title')}
          />
        </div>

        {/* Dynamic status and hints */}
        <div className="flex min-h-[3.5rem] w-full max-w-md flex-col items-center gap-2 text-center">
          {errorMessage ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm font-medium text-destructive">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={() => connect(selectedVoice)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted/60 text-xs font-medium text-foreground hover:bg-muted transition-colors active:scale-95"
              >
                <RefreshCw className="size-3.5" />
                <span>Réessayer</span>
              </button>
            </div>
          ) : (
            <>
              <p
                aria-live="polite"
                className="text-base font-medium tracking-tight text-foreground"
              >
                {realtimeStatus === 'connecting' ||
                realtimeStatus === 'requesting-permission'
                  ? 'Connexion au mode vocal temps réel...'
                  : isAssistantSpeaking
                    ? `${activeVoiceObj.name} parle...`
                    : isMuted
                      ? 'Microphone coupé'
                      : 'À votre écoute, parlez naturellement...'}
              </p>
              <p className="text-xs text-muted-foreground">
                {realtimeStatus === 'connected'
                  ? 'Audio bidirectionnel fluide sans délai'
                  : 'Autorisez le microphone si demandé par le navigateur'}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Footer controls: Voice Selector & Mic Mute */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-xl pb-2">
        <VoiceSelector
          selectedVoice={selectedVoice}
          onSelectVoice={handleSelectVoice}
          disabled={realtimeStatus === 'connecting'}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? 'Activer le microphone' : 'Couper le microphone'}
            className={cn(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-full border transition-all text-xs font-medium active:scale-95 shadow-sm',
              isMuted
                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                : 'border-border/70 bg-background/80 text-foreground hover:bg-muted/80'
            )}
          >
            {isMuted ? (
              <>
                <MicOff className="size-3.5 text-destructive" />
                <span>Micro coupé</span>
              </>
            ) : (
              <>
                <Mic className="size-3.5 text-muted-foreground" />
                <span>Couper micro</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
