/**
 * Config de l'agent navigateur — reprise du template browser-agent-template.
 * Le runtime eve (`defineAgent`, `withEve`, `@browser_use/eve`) sera branché
 * ici quand les deps + clés seront ajoutées. En attendant, `/agent` utilise
 * le même design (chat + panneau live) sans dépendance cloud.
 */
export const BROWSER_AGENT_NAME = 'Nelth Agent'

export const BROWSER_AGENT_MODEL = 'anthropic/claude-opus-4.8'

export const BROWSER_AGENT_BETA_TERMS_HREF =
  'https://vercel.com/docs/release-phases/public-beta-agreement'

/** Hôte live autorisé (même garde que le template). */
export const LIVE_VIEW_HOST = 'live.browser-use.com'
