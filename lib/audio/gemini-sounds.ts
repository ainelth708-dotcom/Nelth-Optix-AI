// Synthesizes Gemini-style signature acoustic sound effects using the Web Audio API.
// 100% self-contained: zero external network asset dependencies, zero latency, runs offline.

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return null
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContextClass()
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
    return audioCtx
  } catch {
    return null
  }
}

/**
 * Gemini Live Connection Sound:
 * A pristine, futuristic 4-note ascending chord bloom with soft sine harmonics and gentle reverb tail.
 * Notes: Eb5 (622.25Hz) -> Bb5 (932.33Hz) -> Eb6 (1244.5Hz) -> G6 (1567.98Hz)
 */
export function playGeminiConnectSound() {
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const now = ctx.currentTime

    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0.85, now)
    masterGain.connect(ctx.destination)

    // Harmonics chord definition (ascending chime)
    const tones = [
      { freq: 622.25, start: 0.0, dur: 0.38, vol: 0.22 },
      { freq: 932.33, start: 0.08, dur: 0.44, vol: 0.26 },
      { freq: 1244.5, start: 0.16, dur: 0.52, vol: 0.22 },
      { freq: 1567.98, start: 0.24, dur: 0.65, vol: 0.2 }
    ]

    tones.forEach(({ freq, start, dur, vol }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + start)

      // Soft envelope: micro-attack to avoid click, smooth exponential decay
      gain.gain.setValueAtTime(0.0001, now + start)
      gain.gain.exponentialRampToValueAtTime(vol, now + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur)

      osc.connect(gain)
      gain.connect(masterGain)

      osc.start(now + start)
      osc.stop(now + start + dur + 0.05)
    })
  } catch (err) {
    console.warn('[GeminiSound] Failed to play connect sound:', err)
  }
}

/**
 * Gemini Live Disconnect Sound:
 * A gentle, warm descending 3-note resolution that softly fades out.
 * Notes: A5 (880Hz) -> D5 (587.33Hz) -> A4 (440Hz)
 */
export function playGeminiDisconnectSound() {
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const now = ctx.currentTime

    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0.8, now)
    masterGain.connect(ctx.destination)

    const tones = [
      { freq: 880.0, start: 0.0, dur: 0.28, vol: 0.24 },
      { freq: 587.33, start: 0.09, dur: 0.38, vol: 0.2 },
      { freq: 440.0, start: 0.18, dur: 0.48, vol: 0.16 }
    ]

    tones.forEach(({ freq, start, dur, vol }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + start)

      gain.gain.setValueAtTime(0.0001, now + start)
      gain.gain.exponentialRampToValueAtTime(vol, now + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur)

      osc.connect(gain)
      gain.connect(masterGain)

      osc.start(now + start)
      osc.stop(now + start + dur + 0.05)
    })
  } catch (err) {
    console.warn('[GeminiSound] Failed to play disconnect sound:', err)
  }
}
