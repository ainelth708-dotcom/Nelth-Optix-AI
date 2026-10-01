'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { playGeminiConnectSound, playGeminiDisconnectSound } from '@/lib/audio/gemini-sounds'

export type RealtimeStatus =
  | 'idle'
  | 'requesting-permission'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'disconnected'

export interface RealtimeVoiceHookOptions {
  voice: string
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (err: string) => void
}

export function useRealtimeVoice({
  voice,
  onConnect,
  onDisconnect,
  onError
}: RealtimeVoiceHookOptions) {
  const [status, setStatus] = useState<RealtimeStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [micLevel, setMicLevel] = useState(0)
  const [assistantLevel, setAssistantLevel] = useState(0)
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const hasPlayedConnectSound = useRef(false)
  const isClosingRef = useRef(false)
  const activeVoiceRef = useRef(voice)
  activeVoiceRef.current = voice

  // Cleanup all audio and connection resources
  const cleanup = useCallback((triggerDisconnectSound = false) => {
    if (triggerDisconnectSound && !isClosingRef.current) {
      playGeminiDisconnectSound()
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }

    if (pcRef.current) {
      try {
        pcRef.current.close()
      } catch {
        /* ignore */
      }
      pcRef.current = null
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        try {
          track.stop()
        } catch {
          /* ignore */
        }
      })
      localStreamRef.current = null
    }

    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close()
      } catch {
        /* ignore */
      }
      audioCtxRef.current = null
    }

    if (remoteAudioRef.current) {
      try {
        remoteAudioRef.current.srcObject = null
        remoteAudioRef.current.pause()
      } catch {
        /* ignore */
      }
    }

    setMicLevel(0)
    setAssistantLevel(0)
    setIsAssistantSpeaking(false)
  }, [])

  const connect = useCallback(async (targetVoice?: string) => {
    cleanup(false)
    isClosingRef.current = false
    hasPlayedConnectSound.current = false
    setErrorMessage(null)
    setStatus('requesting-permission')

    const currentVoice = targetVoice || activeVoiceRef.current || 'cove'

    try {
      if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone WebRTC non supporté par ce navigateur.')
      }

      // 1. Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      localStreamRef.current = stream

      setStatus('connecting')

      // 2. Setup Web Audio Analysers for mic activity
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      let micAnalyser: AnalyserNode | null = null
      let remoteAnalyser: AnalyserNode | null = null

      if (AudioCtxClass) {
        try {
          const ctx = new AudioCtxClass()
          audioCtxRef.current = ctx
          const micSource = ctx.createMediaStreamSource(stream)
          micAnalyser = ctx.createAnalyser()
          micAnalyser.fftSize = 256
          micAnalyser.smoothingTimeConstant = 0.4
          micSource.connect(micAnalyser)
        } catch (e) {
          console.warn('[RealtimeVoice] AudioContext mic setup warning:', e)
        }
      }

      // 3. Create WebRTC PeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      })
      pcRef.current = pc

      // 4. Handle incoming remote audio stream (Assistant speech)
      pc.ontrack = (event) => {
        if (!remoteAudioRef.current) {
          const audio = document.createElement('audio')
          audio.autoplay = true
          // @ts-expect-error playsinline attribute
          audio.playsInline = true
          remoteAudioRef.current = audio
        }

        const remoteStream = event.streams[0] || new MediaStream([event.track])
        remoteAudioRef.current.srcObject = remoteStream
        remoteAudioRef.current.play().catch(e => {
          console.warn('[RealtimeVoice] Remote audio autoplay deferred:', e)
        })

        // Setup remote audio analyzer
        if (audioCtxRef.current && !remoteAnalyser) {
          try {
            const remoteSource = audioCtxRef.current.createMediaStreamSource(remoteStream)
            remoteAnalyser = audioCtxRef.current.createAnalyser()
            remoteAnalyser.fftSize = 256
            remoteAnalyser.smoothingTimeConstant = 0.3
            remoteSource.connect(remoteAnalyser)
          } catch (e) {
            console.warn('[RealtimeVoice] Remote analyser setup warning:', e)
          }
        }

        // Play Gemini connect sound upon receiving remote stream
        if (!hasPlayedConnectSound.current) {
          hasPlayedConnectSound.current = true
          playGeminiConnectSound()
          setStatus('connected')
          onConnect?.()
        }
      }

      // 5. Add local mic tracks to PeerConnection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream)
      })

      // 6. Handle connection state changes
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState
        if (state === 'connected') {
          if (!hasPlayedConnectSound.current) {
            hasPlayedConnectSound.current = true
            playGeminiConnectSound()
            setStatus('connected')
            onConnect?.()
          }
        } else if (state === 'failed') {
          setErrorMessage('La connexion audio en direct a échoué. Veuillez réessayer.')
          setStatus('error')
          onError?.('La connexion audio a échoué')
        } else if (state === 'disconnected') {
          setStatus('disconnected')
          onDisconnect?.()
        }
      }

      // 7. Create SDP offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true
      })
      await pc.setLocalDescription(offer)

      // 8. Wait for local ICE candidates gathering
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve()
          return
        }
        const onGather = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', onGather)
            resolve()
          }
        }
        pc.addEventListener('icegatheringstatechange', onGather)
        setTimeout(() => {
          pc.removeEventListener('icegatheringstatechange', onGather)
          resolve()
        }, 1100)
      })

      const localSdp = pc.localDescription?.sdp
      if (!localSdp) {
        throw new Error('Erreur de génération de l’offre SDP locale')
      }

      // 9. Send offer SDP to /api/realtime/connect
      const res = await fetch('/api/realtime/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdp: localSdp,
          voice: currentVoice,
          voice_mode: 'wingman',
          language_code: 'auto'
        })
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || `Erreur serveur Realtime HTTP ${res.status}`)
      }

      const resData = await res.json()
      if (!resData.answer_sdp) {
        throw new Error(resData.error || 'Aucune réponse SDP valide reçue du serveur')
      }

      // 10. Set remote answer
      await pc.setRemoteDescription(
        new RTCSessionDescription({
          type: 'answer',
          sdp: resData.answer_sdp
        })
      )

      // Fallback connected trigger after setting remote description if ontrack hasn't fired yet
      setTimeout(() => {
        if (!hasPlayedConnectSound.current && pc.connectionState !== 'failed') {
          hasPlayedConnectSound.current = true
          playGeminiConnectSound()
          setStatus('connected')
          onConnect?.()
        }
      }, 1500)

      // 11. Start animation loop for audio visualizers
      const micData = new Uint8Array(128)
      const remoteData = new Uint8Array(128)

      const updateLevels = () => {
        if (micAnalyser) {
          micAnalyser.getByteFrequencyData(micData)
          let sum = 0
          for (let i = 0; i < micData.length; i++) sum += micData[i]
          const avg = sum / micData.length / 255
          setMicLevel(avg)
        }

        if (remoteAnalyser) {
          remoteAnalyser.getByteFrequencyData(remoteData)
          let sum = 0
          for (let i = 0; i < remoteData.length; i++) sum += remoteData[i]
          const avg = sum / remoteData.length / 255
          setAssistantLevel(avg)
          setIsAssistantSpeaking(avg > 0.04)
        }

        animFrameRef.current = requestAnimationFrame(updateLevels)
      }

      animFrameRef.current = requestAnimationFrame(updateLevels)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('[RealtimeVoice] Connect error:', err)
      cleanup(false)
      setErrorMessage(msg)
      setStatus('error')
      onError?.(msg)
    }
  }, [cleanup, onConnect, onDisconnect, onError])

  const disconnect = useCallback(() => {
    isClosingRef.current = true
    cleanup(true)
    setStatus('disconnected')
    onDisconnect?.()
  }, [cleanup, onDisconnect])

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const nextMuted = !isMuted
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !nextMuted
      })
      setIsMuted(nextMuted)
    }
  }, [isMuted])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup(false)
    }
  }, [cleanup])

  return {
    status,
    errorMessage,
    isMuted,
    micLevel,
    assistantLevel,
    isAssistantSpeaking,
    connect,
    disconnect,
    toggleMute
  }
}
