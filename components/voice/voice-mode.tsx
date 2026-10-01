'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Mic,
  MicOff,
  RefreshCw,
  Send,
  Volume2,
  X as XIcon
} from 'lucide-react'
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
  const [typedInput, setTypedInput] = useState('')
  const [showTranscript, setShowTranscript] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState<string>(() =>
    getSavedRealtimeVoice()
  )
  const closingRef = useRef(false)

  const {
    status: realtimeStatus,
    errorMessage,
    isMuted,
    micLevel,
    isAssistantSpeaking,
    messages: realtimeMessages,
    currentAssistantText,
    currentUserText,
    audioElRef,
    connect,
    disconnect,
    toggleMute,
    sendTextMessage
  } = useRealtimeVoice({
    voice: selectedVoice
  })

  // Start Realtime WebRTC connection on mount
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

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault()
    if (!typedInput.trim()) return
    sendTextMessage(typedInput)
    setTypedInput('')
  }

  // Determine Orb visual state
  const orbState: OrbState =
    realtimeStatus === 'connecting' ||
    realtimeStatus === 'requesting-permission'
      ? 'connecting'
      : realtimeStatus === 'error'
        ? 'error'
        : isAssistantSpeaking
          ? 'speaking'
          : 'listening'

  // Dynamic volume for Orb animation
  const orbVolume =
    realtimeStatus === 'error'
      ? 0
      : isAssistantSpeaking
        ? 0.8
        : Math.min(1, Math.max(0.08, micLevel * 3))

  const activeVoiceObj =
    REALTIME_VOICES.find(v => v.id === selectedVoice) || REALTIME_VOICES[0]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('voice.title')}
      data-testid="voice-mode"
      className={cn(
        'fixed inset-0 z-[120] flex flex-col items-center justify-between bg-background/95 px-4 sm:px-6 py-6 sm:py-8 backdrop-blur-2xl select-none',
        leaving ? 'nelth-voice-leave' : 'nelth-voice-enter'
      )}
    >
      {/* Hidden audio element for receiving WebRTC assistant voice */}
      <audio ref={audioElRef} autoPlay playsInline className="hidden" />

      {/* Header controls */}
      <div className="flex w-full max-w-2xl items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border backdrop-blur-md transition-colors',
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
                ? 'Realtime WebRTC Actif'
                : realtimeStatus === 'error'
                  ? 'Erreur de connexion'
                  : 'Négociation SDP...'}
            </span>
          </div>

          <span className="hidden sm:inline text-xs text-muted-foreground">
            {activeVoiceObj.name} · {activeVoiceObj.tag}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTranscript(!showTranscript)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              showTranscript
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border/60 bg-background/80 text-muted-foreground hover:text-foreground'
            )}
          >
            Transcription
          </button>

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
      </div>

      {/* Main Center Stage */}
      <div className="flex flex-col items-center justify-center gap-6 my-auto w-full max-w-xl">
        <div className="relative">
          <Orb
            state={orbState}
            volume={orbVolume}
            theme="cloud"
            interactive={false}
            aria-label={t('voice.title')}
          />
        </div>

        {/* Dynamic status / caption */}
        <div className="flex min-h-[4.5rem] w-full flex-col items-center justify-center gap-2 text-center px-4">
          {errorMessage ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm font-medium text-destructive">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={() => connect(selectedVoice)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border bg-muted/60 text-xs font-medium text-foreground hover:bg-muted transition-colors active:scale-95"
              >
                <RefreshCw className="size-3.5" />
                <span>Réessayer la connexion</span>
              </button>
            </div>
          ) : showTranscript && realtimeMessages.length > 0 ? (
            <div className="w-full max-h-36 overflow-y-auto space-y-1.5 p-3 rounded-2xl bg-muted/30 border border-border/40 text-left text-xs">
              {realtimeMessages.slice(-6).map(m => (
                <div
                  key={m.id}
                  className={cn(
                    'px-2.5 py-1.5 rounded-xl max-w-[85%]',
                    m.role === 'user'
                      ? 'ml-auto bg-primary text-primary-foreground font-medium'
                      : m.role === 'assistant'
                        ? 'mr-auto bg-card text-card-foreground border border-border/50'
                        : 'mx-auto text-[11px] text-muted-foreground italic text-center'
                  )}
                >
                  {m.text}
                </div>
              ))}
            </div>
          ) : (
            <>
              <p
                aria-live="polite"
                className="text-base sm:text-lg font-medium tracking-tight text-foreground transition-all line-clamp-3"
              >
                {realtimeStatus === 'connecting' ||
                realtimeStatus === 'requesting-permission'
                  ? 'Connexion audio en direct avec ace-studio...'
                  : isAssistantSpeaking
                    ? currentAssistantText || `${activeVoiceObj.name} parle...`
                    : currentUserText ||
                      (isMuted
                        ? 'Microphone coupé'
                        : 'À votre écoute, parlez librement...')}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Volume2 className="size-3.5 text-emerald-500" />
                <span>Interruption vocale naturelle (barge-in) activée</span>
              </p>
            </>
          )}
        </div>
      </div>

      {/* Footer controls */}
      <div className="flex flex-col items-center gap-3 w-full max-w-xl pb-2">
        {/* Quick text input option */}
        {realtimeStatus === 'connected' && (
          <form
            onSubmit={handleSendText}
            className="flex items-center gap-2 w-full max-w-md bg-muted/40 border border-border/60 rounded-full px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary/20 backdrop-blur-md"
          >
            <input
              type="text"
              value={typedInput}
              onChange={e => setTypedInput(e.target.value)}
              placeholder="Écrire à l'assistant vocal..."
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none px-1"
            />
            <button
              type="submit"
              disabled={!typedInput.trim()}
              className="p-1.5 rounded-full bg-primary text-primary-foreground disabled:opacity-30 transition-opacity"
            >
              <Send className="size-3" />
            </button>
          </form>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 w-full">
          <VoiceSelector
            selectedVoice={selectedVoice}
            onSelectVoice={handleSelectVoice}
            disabled={realtimeStatus === 'connecting'}
          />

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
