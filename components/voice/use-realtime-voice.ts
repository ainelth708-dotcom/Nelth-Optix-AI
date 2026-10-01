'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { playGeminiConnectSound, playGeminiDisconnectSound } from '@/lib/audio/gemini-sounds'

export type RealtimeStatus =
  | 'idle'
  | 'requesting-permission'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'disconnected'

export interface RealtimeMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  timestamp: number
}

export interface RealtimeVoiceOptions {
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
}: RealtimeVoiceOptions) {
  const [status, setStatus] = useState<RealtimeStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [micLevel, setMicLevel] = useState(0)
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false)
  const [messages, setMessages] = useState<RealtimeMessage[]>([])
  const [currentAssistantText, setCurrentAssistantText] = useState('')
  const [currentUserText, setCurrentUserText] = useState('')

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)

  // Web Audio Analysers & Energy VAD refs
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const speechStartRef = useRef<number>(0)
  const bargeCooldownRef = useRef<number>(0)

  // Tracking current turn delta text
  const currentMsgRef = useRef<{ role: string; messageId: string; text: string }>({
    role: '',
    messageId: '',
    text: ''
  })
  const isAssistantSpeakingRef = useRef(false)
  const hasPlayedConnectSound = useRef(false)
  const isClosingRef = useRef(false)
  const activeVoiceRef = useRef(voice)
  activeVoiceRef.current = voice

  const addMessage = useCallback((role: 'user' | 'assistant' | 'system', text: string) => {
    if (!text.trim()) return
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setMessages(prev => [...prev.slice(-100), { id, role, text: text.trim(), timestamp: Date.now() }])
  }, [])

  // Send structured message over DataChannel
  const sendDataMessage = useCallback((payload: Record<string, unknown>) => {
    const dc = dcRef.current
    if (!dc || dc.readyState !== 'open') return
    try {
      dc.send(
        JSON.stringify({
          type: 'data_message',
          data: JSON.stringify(payload)
        })
      )
    } catch (e) {
      console.warn('[RealtimeVoice] Failed to send via DataChannel:', e)
    }
  }, [])

  // Barge-in: if user talks while AI is speaking, send stop_speaking
  const handleUserAudioEnergy = useCallback(
    (rms: number) => {
      if (status !== 'connected' || isMuted || !isAssistantSpeakingRef.current) {
        speechStartRef.current = 0
        return
      }

      const now = Date.now()
      if (now < bargeCooldownRef.current || rms < 0.16) {
        speechStartRef.current = 0
        return
      }

      if (!speechStartRef.current) {
        speechStartRef.current = now
        return
      }

      // If user speaks continuously for >= 400ms during assistant speech -> barge-in
      if (now - speechStartRef.current >= 400) {
        speechStartRef.current = 0
        bargeCooldownRef.current = now + 1500
        isAssistantSpeakingRef.current = false
        setIsAssistantSpeaking(false)
        try {
          sendDataMessage({
            type: 'action_request',
            payload: { action: 'stop_speaking' }
          })
          addMessage('system', 'Interruption vocale : arrêt de l’assistant')
        } catch {
          /* ignore */
        }
      }
    },
    [status, isMuted, sendDataMessage, addMessage]
  )

  // Setup mic volume analyser
  const setupMicAnalyser = useCallback(
    (stream: MediaStream) => {
      try {
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (!AudioCtxClass) return

        const ctx = new AudioCtxClass()
        audioCtxRef.current = ctx
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.3
        source.connect(analyser)
        analyserRef.current = analyser

        const buffer = new Uint8Array(analyser.frequencyBinCount)

        const loop = () => {
          if (!analyserRef.current) return
          analyserRef.current.getByteTimeDomainData(buffer)

          let sumSquares = 0
          for (let i = 0; i < buffer.length; i++) {
            const norm = (buffer[i] - 128) / 128
            sumSquares += norm * norm
          }
          const rms = Math.sqrt(sumSquares / buffer.length)
          setMicLevel(rms)
          handleUserAudioEnergy(rms)

          animFrameRef.current = requestAnimationFrame(loop)
        }

        animFrameRef.current = requestAnimationFrame(loop)
      } catch (e) {
        console.warn('[RealtimeVoice] Mic analyser init warning:', e)
      }
    },
    [handleUserAudioEnergy]
  )

  const stopMicAnalyser = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close()
      } catch {
        /* ignore */
      }
      audioCtxRef.current = null
    }
    analyserRef.current = null
    setMicLevel(0)
  }, [])

  // Helper to extract message delta from OpenAI Realtime schema
  const extractDelta = useCallback(
    (deltaObj: any) => {
      const cur = currentMsgRef.current
      const message = deltaObj?.v?.message
      if (message && typeof message === 'object') {
        const parts = Array.isArray(message.content?.parts) ? message.content.parts : []
        let role = message.author?.role || ''

        if (role !== 'assistant' && role !== 'user') {
          for (const p of parts) {
            if (p && typeof p === 'object' && p.content_type === 'audio_transcription') {
              if (p.direction === 'in') role = 'user'
              if (p.direction === 'out') role = 'assistant'
              break
            }
          }
        }

        if (role !== 'assistant' && role !== 'user') return null

        const combinedText = parts
          .map((p: any) =>
            typeof p === 'string'
              ? p
              : p && typeof p === 'object'
                ? p.text || p.content || p.transcript || ''
                : ''
          )
          .filter(Boolean)
          .join('\n')
          .trim()

        return {
          role,
          messageId: message.id ? String(message.id) : cur.messageId,
          text: combinedText || cur.text
        }
      }

      if (Array.isArray(deltaObj?.v) && cur.role) {
        let chunk = ''
        for (const item of deltaObj.v) {
          if (item && typeof item === 'object' && typeof item.text === 'string') {
            chunk += item.text
          }
        }
        if (chunk) {
          return {
            role: cur.role,
            messageId: cur.messageId,
            text: cur.text + chunk
          }
        }
      }

      return null
    },
    []
  )

  // Full cleanup
  const cleanup = useCallback(
    (triggerDisconnectSound = false) => {
      if (triggerDisconnectSound && !isClosingRef.current) {
        playGeminiDisconnectSound()
      }

      stopMicAnalyser()

      if (dcRef.current) {
        try {
          dcRef.current.close()
        } catch {
          /* ignore */
        }
        dcRef.current = null
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
        localStreamRef.current.getTracks().forEach(t => {
          try {
            t.stop()
          } catch {
            /* ignore */
          }
        })
        localStreamRef.current = null
      }

      remoteStreamRef.current = null

      if (audioElRef.current) {
        try {
          audioElRef.current.srcObject = null
          audioElRef.current.pause()
        } catch {
          /* ignore */
        }
      }

      isAssistantSpeakingRef.current = false
      setIsAssistantSpeaking(false)
      setCurrentAssistantText('')
      setCurrentUserText('')
    },
    [stopMicAnalyser]
  )

  const connect = useCallback(
    async (targetVoice?: string) => {
      cleanup(false)
      isClosingRef.current = false
      hasPlayedConnectSound.current = false
      setErrorMessage(null)
      setStatus('requesting-permission')
      currentMsgRef.current = { role: '', messageId: '', text: '' }

      const selectedVoice = targetVoice || activeVoiceRef.current || 'cove'

      try {
        if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          throw new Error('Microphone WebRTC non supporté par ce navigateur.')
        }

        // 1. Get user microphone stream
        const localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
        localStreamRef.current = localStream
        setupMicAnalyser(localStream)

        setStatus('connecting')

        // 2. Setup RTCPeerConnection with max-bundle (exact ace-studio config)
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun4.google.com:19302' }
          ],
          bundlePolicy: 'max-bundle'
        })
        pcRef.current = pc

        // 3. Add audio tracks to peer connection
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream)
        })

        // 4. Handle incoming remote audio tracks
        pc.ontrack = event => {
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream()
          }

          if (event.streams[0]) {
            event.streams[0].getTracks().forEach(t => remoteStreamRef.current?.addTrack(t))
          } else {
            remoteStreamRef.current.addTrack(event.track)
          }

          if (audioElRef.current) {
            audioElRef.current.srcObject = remoteStreamRef.current
            audioElRef.current.play().catch(e => {
              console.warn('[RealtimeVoice] Audio play promise deferred:', e)
            })
          }

          if (!hasPlayedConnectSound.current) {
            hasPlayedConnectSound.current = true
            playGeminiConnectSound()
            setStatus('connected')
            onConnect?.()
          }
        }

        // 5. Create negotiated DataChannel "oai-events" with id 0 (critical for ChatGPT Realtime!)
        const dc = pc.createDataChannel('oai-events', {
          negotiated: true,
          id: 0
        })
        dcRef.current = dc

        dc.onopen = () => {
          addMessage('system', 'Canal de données Realtime connecté')
        }

        dc.onclose = () => {
          if (dcRef.current === dc) dcRef.current = null
        }

        dc.onmessage = event => {
          try {
            let msg = JSON.parse(event.data)
            if (msg.type === 'data_message' && typeof msg.data === 'string') {
              msg = JSON.parse(msg.data)
            }

            const msgType = String(msg.type || '')
            const payload = msg.payload || msg

            // State updates: listening vs speaking
            if (msgType === 'state_update') {
              const state = String(payload.new_state || payload.state || '').toLowerCase()
              if (state === 'listening' || state === 'idle') {
                isAssistantSpeakingRef.current = false
                setIsAssistantSpeaking(false)
              } else if (state === 'speaking' || state === 'responding') {
                isAssistantSpeakingRef.current = true
                setIsAssistantSpeaking(true)
              }
            }

            // Live speech transcription delta
            if (msgType === 'chat_message_delta' || payload?.type === 'chat_message_delta') {
              const rawDelta =
                payload?.type === 'chat_message_delta' ? payload : msg
              const delta = rawDelta.delta || rawDelta.payload?.delta || {}
              const parsed = extractDelta(delta)

              if (parsed && parsed.text) {
                const prev = currentMsgRef.current
                if (
                  parsed.role !== prev.role ||
                  parsed.messageId !== prev.messageId ||
                  parsed.text !== prev.text
                ) {
                  currentMsgRef.current = parsed
                  if (parsed.role === 'assistant') {
                    setCurrentAssistantText(parsed.text)
                  } else if (parsed.role === 'user') {
                    setCurrentUserText(parsed.text)
                  }
                  addMessage(parsed.role as 'user' | 'assistant', parsed.text)
                }
              }
            }

            // Usage update
            if (msgType === 'usage_update') {
              const rem = payload.audio_s ?? payload.limits?.audio?.remaining_seconds
              if (typeof rem === 'number' && rem <= 10) {
                addMessage('system', `Temps restant : ${rem}s`)
              }
            }
          } catch {
            /* ignore malformed frame */
          }
        }

        // 6. Handle ICE / Connection state
        pc.oniceconnectionstatechange = () => {
          const state = pc.iceConnectionState
          if (state === 'connected' || state === 'completed') {
            if (!hasPlayedConnectSound.current) {
              hasPlayedConnectSound.current = true
              playGeminiConnectSound()
              setStatus('connected')
              onConnect?.()
            }
          } else if (state === 'failed') {
            setStatus('error')
            setErrorMessage('Échec de la connexion ICE réseau (NAT/Firewall).')
            onError?.('Échec de connexion réseau')
          }
        }

        pc.onconnectionstatechange = () => {
          const state = pc.connectionState
          if (state === 'connected') {
            if (!hasPlayedConnectSound.current) {
              hasPlayedConnectSound.current = true
              playGeminiConnectSound()
              setStatus('connected')
              onConnect?.()
            }
          } else if (state === 'disconnected' || state === 'failed') {
            setStatus(state === 'failed' ? 'error' : 'idle')
            isAssistantSpeakingRef.current = false
            setIsAssistantSpeaking(false)
            if (state === 'failed') {
              setErrorMessage('La connexion audio en direct a été interrompue.')
              onError?.('Connexion interrompue')
            }
          }
        }

        // 7. Create SDP offer
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false
        })
        await pc.setLocalDescription(offer)

        // 8. Wait for local ICE gathering
        await new Promise<void>(resolve => {
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
          }, 1500)
        })

        const sdp = pc.localDescription?.sdp
        if (!sdp || !sdp.startsWith('v=0')) {
          throw new Error('Offre SDP locale invalide')
        }

        // 9. Send offer SDP to /api/realtime/connect
        const res = await fetch('/api/realtime/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sdp,
            voice: selectedVoice,
            voice_mode: 'wingman',
            language_code: 'auto'
          })
        })

        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          throw new Error(data.error || `Erreur serveur Realtime HTTP ${res.status}`)
        }

        if (!data.answer_sdp || !String(data.answer_sdp).trimStart().startsWith('v=0')) {
          throw new Error('Le serveur n’a pas renvoyé de réponse SDP valide')
        }

        // 10. Set remote answer
        await pc.setRemoteDescription(
          new RTCSessionDescription({
            type: 'answer',
            sdp: data.answer_sdp
          })
        )

        // Safety fallback if events didn't trigger connected within 2s
        setTimeout(() => {
          if (!hasPlayedConnectSound.current && pc.connectionState !== 'failed') {
            hasPlayedConnectSound.current = true
            playGeminiConnectSound()
            setStatus('connected')
            onConnect?.()
          }
        }, 1800)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur inconnue'
        console.error('[RealtimeVoice] Connect failed:', err)
        cleanup(false)
        setStatus('error')
        setErrorMessage(msg)
        onError?.(msg)
      }
    },
    [cleanup, setupMicAnalyser, addMessage, extractDelta, onConnect, onError]
  )

  const disconnect = useCallback(() => {
    isClosingRef.current = true
    cleanup(true)
    setStatus('disconnected')
    onDisconnect?.()
  }, [cleanup, onDisconnect])

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const next = !isMuted
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !next
      })
      setIsMuted(next)
      addMessage('system', next ? 'Microphone désactivé' : 'Microphone activé')
    }
  }, [isMuted, addMessage])

  // Send typed text to the active Realtime AI session
  const sendTextMessage = useCallback(
    (text: string) => {
      const t = text.trim()
      if (!t || status !== 'connected') return

      const msgId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `msg-${Date.now()}`

      const payload = {
        type: 'relay_message',
        payload: {
          type: 'relay_message',
          message: {
            id: msgId,
            author: { role: 'user' },
            create_time: Date.now() / 1000,
            content: { content_type: 'text', parts: [t] },
            metadata: { serialization_metadata: { custom_symbol_offsets: [] } },
            clientMetadata: { isOptimistic: true }
          }
        }
      }

      sendDataMessage(payload)
      addMessage('user', t)
      setCurrentUserText(t)
    },
    [status, sendDataMessage, addMessage]
  )

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
    isAssistantSpeaking,
    messages,
    currentAssistantText,
    currentUserText,
    audioElRef,
    connect,
    disconnect,
    toggleMute,
    sendTextMessage
  }
}
