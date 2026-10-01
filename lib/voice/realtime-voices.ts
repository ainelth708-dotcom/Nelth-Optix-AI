export interface RealtimeVoice {
  id: string
  name: string
  alias?: string
  description: string
  tag: string
}

export const REALTIME_VOICES: RealtimeVoice[] = [
  { id: 'cove', name: 'Cove', description: 'Calme, direct', tag: 'Calm & Direct' },
  { id: 'breeze', name: 'Breeze', description: 'Vif, sincère', tag: 'Brisk & Sincere' },
  { id: 'ember', name: 'Ember', description: 'Confiant, optimiste', tag: 'Confident & Optimistic' },
  { id: 'fathom', name: 'Fathom', alias: 'Arbor', description: 'Facile à vivre, polyvalent', tag: 'Easygoing & Versatile' },
  { id: 'glimmer', name: 'Glimmer', alias: 'Sol', description: 'Brillant, décontracté', tag: 'Bright & Relaxed' },
  { id: 'juniper', name: 'Juniper', description: 'Ouvert, large d\'esprit', tag: 'Open & Broad-minded' },
  { id: 'maple', name: 'Maple', description: 'Joyeux, franc', tag: 'Joyful & Candid' },
  { id: 'orbit', name: 'Orbit', alias: 'Spruce', description: 'Calme, résolu', tag: 'Calm & Resolute' },
  { id: 'vale', name: 'Vale', description: 'Intelligent, curieux', tag: 'Bright & Inquisitive' }
]

export const DEFAULT_REALTIME_VOICE = 'cove'
export const REALTIME_VOICE_STORAGE_KEY = 'nelth_realtime_voice'

export function getSavedRealtimeVoice(): string {
  if (typeof window === 'undefined') return DEFAULT_REALTIME_VOICE
  try {
    const saved = localStorage.getItem(REALTIME_VOICE_STORAGE_KEY)
    if (saved && REALTIME_VOICES.some(v => v.id === saved)) {
      return saved
    }
  } catch {
    /* ignore storage errors */
  }
  return DEFAULT_REALTIME_VOICE
}

export function saveRealtimeVoice(voiceId: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(REALTIME_VOICE_STORAGE_KEY, voiceId)
  } catch {
    /* ignore storage errors */
  }
}
