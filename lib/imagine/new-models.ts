// ---------------------------------------------------------------------------
// Reusable "New Model Announcement" system.
//
// Each entry describes a newly released generation model. The studio shows
// the announcement modal when:
//   isNewModel === true
//   AND tryNowClicked === false
//   AND (lastAnnouncementShownAt === null
//        OR now - lastAnnouncementShownAt >= ANNOUNCEMENT_INTERVAL_MS)
// When displayed, lastAnnouncementShownAt is stamped immediately. Closing
// keeps NOT TRIED (may reappear after the interval); "Try Now" sets
// tryNowClicked permanently for that model.
//
// Persistence is localStorage (per modelId): survives refresh + browser
// restarts. Swap loadNewModelState/saveNewModelState for server storage
// to also cover logout/login + multiple devices.
// ---------------------------------------------------------------------------

export interface NewModelAnnouncement {
  modelId: string
  modelName: string
  modelDescription: string
  modelImage: string
  badge: string
  features: string[]
  maxReferenceImages: number
  buttonText: string
  /** Only entries with isNew === true are eligible for announcement. */
  isNew: boolean
}

export interface NewModelState {
  tryNowClicked: boolean
  lastAnnouncementShownAt: number | null
}

/** Re-announcement interval: 5 hours, counted from the last display. */
export const ANNOUNCEMENT_INTERVAL_MS = 5 * 60 * 60 * 1000

const EMPTY_STATE: NewModelState = {
  tryNowClicked: false,
  lastAnnouncementShownAt: null
}

function storageKey(modelId: string): string {
  return `nelth-new-model:${modelId}`
}

export function loadNewModelState(modelId: string): NewModelState {
  if (typeof window === 'undefined') return { ...EMPTY_STATE }
  try {
    const raw = window.localStorage.getItem(storageKey(modelId))
    if (!raw) return { ...EMPTY_STATE }
    const parsed = JSON.parse(raw) as Partial<NewModelState>
    return {
      tryNowClicked: parsed.tryNowClicked === true,
      lastAnnouncementShownAt:
        typeof parsed.lastAnnouncementShownAt === 'number'
          ? parsed.lastAnnouncementShownAt
          : null
    }
  } catch {
    return { ...EMPTY_STATE }
  }
}

function saveNewModelState(modelId: string, state: NewModelState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(modelId), JSON.stringify(state))
  } catch {
    // Private mode / storage blocked: session-only announcement state.
  }
}

export function shouldShowAnnouncement(
  model: NewModelAnnouncement,
  now: number = Date.now()
): boolean {
  if (!model.isNew) return false
  const state = loadNewModelState(model.modelId)
  if (state.tryNowClicked) return false
  if (state.lastAnnouncementShownAt === null) return true
  return now - state.lastAnnouncementShownAt >= ANNOUNCEMENT_INTERVAL_MS
}

/** Stamp immediately when the modal is displayed (not on close). */
export function markAnnouncementShown(
  modelId: string,
  now: number = Date.now()
): void {
  const state = loadNewModelState(modelId)
  saveNewModelState(modelId, { ...state, lastAnnouncementShownAt: now })
}

/** Permanent opt-out for this model (never auto-show again). */
export function markTryNowClicked(modelId: string): void {
  const state = loadNewModelState(modelId)
  saveNewModelState(modelId, { ...state, tryNowClicked: true })
}

export const NEW_MODEL_ANNOUNCEMENTS: NewModelAnnouncement[] = [
  {
    modelId: 'v3',
    modelName: 'Nelth-Imagen_V3',
    modelDescription:
      'Nelth-Imagen_V3 — un nouveau modèle de génération d’images ultra-performant, conçu pour créer des images de haute qualité avec une vitesse exceptionnelle.',
    modelImage:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Futuristic%20Fashion%20Editorial%20with%20Seated%20Female%20Model.jpg',
    badge: 'New',
    features: [
      'Génération d’images très performante et rapide',
      'Prise en charge jusqu’à 8 images de référence',
      'Meilleure compréhension des images et des instructions',
      'Résultats photoréalistes et créatifs de haute qualité',
      'Idéal pour les transformations, créations et variations d’images',
      'Optimisé pour une génération rapide même avec plusieurs références'
    ],
    maxReferenceImages: 8,
    buttonText: 'Try Now',
    isNew: true
  }
]
