import { generateText, type LanguageModel, type ModelMessage } from 'ai'

// ChatGPT-, Claude- and Gemini-style search routing: the model itself decides
// whether a turn needs fresh web information (Claude: "determines when to
// search based on the prompt"; Gemini: prompt analysis before grounding),
// instead of searching on every message. A deterministic first tier forces the
// search for unmistakably time-sensitive questions (news, releases, casting,
// weather, prices...) so the classifier can never let those slip through.
const SEARCH_DECISION_TIMEOUT_MS = 15_000
const MAX_CONTEXT_MESSAGES = 6
const MAX_MESSAGE_CHARS = 600
const MAX_DECISION_TOKENS = 32

const TIME_SENSITIVE_PATTERNS = [
  /\bactus?\b|\bactualit/i,
  /\brécente?s?\b|\bnouveautés?\b|\bmise à jour\b/i,
  /dernières? (nouvelles|infos|informations)/i,
  /\bnews\b|breaking news|latest (news|update|version)/i,
  /date de sortie|date de diffusion|sortie (au cinéma|prévue|confirmée)|release date/i,
  /\bcasting\b|bande[- ]annonce|\bteaser\b|\btrailer\b/i,
  /\bmétéo\b|weather (today|forecast|tomorrow)/i,
  /score (du match|final)|résultats? (du match|de l'élection|des élections)/i,
  /cours (de l'action|du bitcoin|de l'or|du dollar)|stock price|prix (actuel|actuels|du jour)/i,
  /combien coûte|quel est le prix (actuel|du jour)/i,
  /en direct\b/i,
  /qui est (le|la) (nouveau|nouvelle|actuel|actuelle)/i,
  /(élection|élections) (de|du) 20\d\d/i
]

/** Unmistakably asks for fresh, live facts — always route those to the web. */
export function isTimeSensitiveQuestion(text: string): boolean {
  return TIME_SENSITIVE_PATTERNS.some(pattern => pattern.test(text))
}

const SEARCH_DECISION_SYSTEM = `You route one chat turn to the web-search pipeline. Reply with exactly one word: "SEARCH" or "DIRECT".

SEARCH when fresh, external or verifiable information would improve the answer:
- news, current events, sports, markets, prices, weather, schedules, openings
- anything recent or likely after the model's training cutoff ("aujourd'hui", "cette semaine", "latest", "2026")
- specific people, companies, places, products, laws, releases, niche or little-known facts
- movies, series, anime, games, music and celebrities: casting, release dates, trailers, tours, awards
- recommendations or comparisons where current data matters (shopping, travel, restaurants, gear)

DIRECT when the model's own knowledge and reasoning are enough:
- greetings, thanks, small talk, chit-chat
- math, coding, debugging, established science, definitions, explanations of how things work
- writing, rewriting, translating, summarizing or analyzing content the user provided
- opinions, brainstorming, plans, and personal advice that does not depend on fresh facts
- follow-up turns continuing the same topic when no new external facts are needed

When in doubt: prefer DIRECT for purely conversational, creative or reasoning turns, and SEARCH for anything factual about the real world that could have changed or that you may not know well.`

export function buildSearchDecisionTranscript(
  messages: ModelMessage[]
): string {
  return messages
    .slice(-MAX_CONTEXT_MESSAGES)
    .map(message => {
      const content =
        typeof message.content === 'string' ? message.content.trim() : ''
      const clipped =
        content.length > MAX_MESSAGE_CHARS
          ? `${content.slice(0, MAX_MESSAGE_CHARS)}…`
          : content
      return `${message.role === 'user' ? 'User' : 'Assistant'}: ${clipped}`
    })
    .join('\n\n')
}

export async function decideWebSearch({
  model,
  messages
}: {
  model: LanguageModel
  messages: ModelMessage[]
}): Promise<boolean> {
  try {
    const { text } = await generateText({
      model,
      system: SEARCH_DECISION_SYSTEM,
      prompt: buildSearchDecisionTranscript(messages),
      maxOutputTokens: MAX_DECISION_TOKENS,
      abortSignal: AbortSignal.timeout(SEARCH_DECISION_TIMEOUT_MS)
    })
    const verdict = text.trim().toUpperCase()
    if (!verdict) {
      console.warn('[OpenUI] Search decision returned no verdict, using DIRECT')
      return false
    }
    const wantsSearch = verdict.startsWith('SEARCH')
    console.info(
      `[OpenUI] Search decision: ${wantsSearch ? 'SEARCH' : 'DIRECT'}`
    )
    return wantsSearch
  } catch (error) {
    console.warn(
      '[OpenUI] Search decision failed, answering without web search:',
      error instanceof Error ? error.message : error
    )
    return false
  }
}
