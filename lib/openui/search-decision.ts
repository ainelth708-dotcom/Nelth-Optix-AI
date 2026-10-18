import { generateText, type LanguageModel, type ModelMessage } from 'ai'

// ChatGPT-, Claude- and Gemini-style search routing: the model itself decides
// whether a turn needs fresh web information (Claude: "determines when to
// search based on the prompt"; Gemini: prompt analysis before grounding),
// instead of searching on every message.
const SEARCH_DECISION_TIMEOUT_MS = 5_000
const MAX_CONTEXT_MESSAGES = 6
const MAX_MESSAGE_CHARS = 600
const MAX_DECISION_TOKENS = 8

const SEARCH_DECISION_SYSTEM = `You route one chat turn to the web-search pipeline. Reply with exactly one word: "SEARCH" or "DIRECT".

SEARCH when fresh, external or verifiable information would improve the answer:
- news, current events, sports, markets, prices, weather, schedules, openings
- anything recent or likely after the model's training cutoff ("aujourd'hui", "cette semaine", "latest", "2026")
- specific people, companies, places, products, laws, releases, niche or little-known facts
- recommendations or comparisons where current data matters (shopping, travel, restaurants, gear)

DIRECT when the model's own knowledge and reasoning are enough:
- greetings, thanks, small talk, chit-chat
- math, coding, debugging, established science, definitions, explanations of how things work
- writing, rewriting, translating, summarizing or analyzing content the user provided
- opinions, brainstorming, plans, and personal advice that does not depend on fresh facts
- follow-up turns continuing the same topic when no new external facts are needed

When in doubt: prefer DIRECT for purely conversational, creative or reasoning turns, and SEARCH for claims about the current world that must be accurate.`

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
